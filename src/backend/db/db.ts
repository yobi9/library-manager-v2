import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { AsyncLocalStorage } from "node:async_hooks";
import { logger, currentOperationId } from "../observability/logger";
import { recordDbObservation, recordExclusiveWait } from "../observability/db-stats";

/**
 * سياق مراقبة اختياري يُنسب إليه عمل قاعدة البيانات (المسح/الوظيفة الخلفية).
 * الهدف: ربط عبارات SQL بمرحلة/معرف عملية حتى تظهر أحداث `db.*` في تقرير
 * الاختناقات ضمن العملية الصحيحة. لا يُكتب في قاعدة البيانات أبداً.
 */
interface DbOperationContext {
  /** تسمية مرحلة/مسؤولية (مثل `walk` أو `cleanupOrphanedItems`). */
  label: string;
  /** معرف العملية المرتبط (scanId / jobId) إن وُجد. */
  operationId: string | null;
}

/**
 * حالة التشغيل الكاملة لطبقة قاعدة البيانات: الاتصالات، وعدا التهيئة،
 * طابور معاملات SAVEPOINT، عداد عبارات الكاتب، وأزميلا `AsyncLocalStorage`.
 *
 * تُحفظ على `globalThis` بدل حالة الوحدة لأن Turbopack (وضع التطوير) يعيد
 * تقييم وحدة `db.ts` عند كل إعادة ترجمة. لو بقيت الحالة على مستوى الوحدة
 * لافتُتح اتصال جديد وأُعيد تشغيل الهجرات (DDL) أثناء مسح قيد التنفيذ
 * فتنازعت مع كاتب الماسح وأخفقت (`SQLITE_BUSY` / `db.init_failed`). إبقاؤها
 * على `globalThis` يجعل إعادة التقييم تعيد استخدام الاتصال القائم وأزميل
 * السياق نفسه دون تغيير سلوك الإنتاج.
 */
interface DbRuntimeState {
  /** اتصال القراءات الرئيسي (كل طلبات HTTP). */
  db: Database | null;
  /** وعد تهيئة الاتصال الرئيسي (يمنع التهيئة المزدوجة). */
  initializationPromise: Promise<Database> | null;
  /** اتصال الكتابة المخصص للماسح. */
  writerDb: Database | null;
  /** وعد تهيئة اتصال الكتابة. */
  writerInitializationPromise: Promise<Database> | null;
  /** طابور معاملات SAVEPOINT الحصري (انظر {@link withExclusiveTransaction}). */
  transactionQueue: Promise<void>;
  /** عداد عبارات SQL على اتصال الكاتب (قياس المرحلة 0). */
  scannerDbStatementCount: number;
  /** أزميل سياق اتصال الكاتب. */
  writerContext: AsyncLocalStorage<Database>;
  /** أزميل سياق مراقبة قاعدة البيانات. */
  dbContextStore: AsyncLocalStorage<DbOperationContext | null>;
  /**
   * سجل العبارات قيد التنفيذ على كل اتصال (المفتاح: `main`|`writer`).
   * أداة تشخيص لتحديد الحامل المرجّح لقفل الكتابة لحظة رصد `SQLITE_BUSY`.
   */
  inflightStatements: Map<string, InflightStatement>;
  /**
   * سجل المعاملة المفتوحة على كل اتصال (SAVEPOINT/BEGIN).
   * المعاملة المفتوحة على اتصال تعني أنه يمسك قفل الكتابة WAL حتى إغلاقها.
   */
  openTransactions: Map<string, OpenTransaction>;
}

/** مفتاح تخزين حالة قاعدة البيانات على `globalThis`. */
const RUNTIME_STATE_KEY = "__libraryManagerDbRuntimeState";

const globalRuntimeState = (globalThis as Record<string, unknown>)[RUNTIME_STATE_KEY] as
  DbRuntimeState | undefined;

/** حالة التشغيل المشتركة (وحيدة عبر إعادة تقييم الوحدة). */
const runtimeState: DbRuntimeState =
  globalRuntimeState ??
  ((globalThis as Record<string, unknown>)[RUNTIME_STATE_KEY] = {
    db: null,
    initializationPromise: null,
    writerDb: null,
    writerInitializationPromise: null,
    transactionQueue: Promise.resolve(),
    scannerDbStatementCount: 0,
    writerContext: new AsyncLocalStorage<Database>(),
    dbContextStore: new AsyncLocalStorage<DbOperationContext | null>(),
    inflightStatements: new Map<string, InflightStatement>(),
    openTransactions: new Map<string, OpenTransaction>(),
  });

/** أزميل سياق اتصال الكاتب الحالي (يُقرأ من الحالة المشتركة). */
const writerContext = runtimeState.writerContext;

/** أزميل سياق مراقبة قاعدة البيانات الحالي. */
const dbContextStore = runtimeState.dbContextStore;

/**
 * بيان SQL واحد قيد التنفيذ على أحد الاتصالين؛ يُستخدم في أدلة `db.busy_detected`
 * لتحديد العبارة التي ربما تمسك قفل الكتابة لحظة تصادم عبارة أخرى معها.
 */
interface InflightStatement {
  /** الاتصال الذي تعمل عليه العبارة. */
  connection: "main" | "writer";
  /** نص SQL (بدون المعاملات — لا تُسجَّل القيم أبداً). */
  sql: string;
  /** وقت بدء العبارة (`performance.now`). */
  startedAt: number;
  /** معرف العملية المرتبط إن وُجد. */
  operationId: string | null;
  /** تسمية سياق مراقبة قاعدة البيانات إن وُجدت. */
  context: string | null;
}

/**
 * معاملة مفتوحة (SAVEPOINT/BEGIN) على أحد الاتصالين؛ وجودها يعني أن الاتصال
 * يمسك قفل الكتابة WAL من أول كتابة داخل المعاملة حتى إغلاقها — وهو الحامل
 * المرجّح للقفل عند رصد `SQLITE_BUSY` من الاتصال الآخر.
 */
interface OpenTransaction {
  /** الاتصال الذي تحمل عليه المعاملة. */
  connection: "main" | "writer";
  /** الكلمة المفتاحية الافتتاحية (`SAVEPOINT`|`BEGIN`). */
  keyword: string;
  /** نص العبارة الافتتاحية (بدون المعاملات). */
  sql: string;
  /** وقت فتح المعاملة (`performance.now`). */
  openedAt: number;
  /** معرف العملية المرتبط إن وُجد. */
  operationId: string | null;
  /** تسمية سياق مراقبة قاعدة البيانات إن وُجدت. */
  context: string | null;
  /** عمق تعشيش SAVEPOINT داخل بعضها (لا يُغلق إلا عند بلوغ الصفر). */
  depth: number;
}

/**
 * يستخرج الكلمة المفتاحية الأولى من SQL وتصنيفها كعبارة معاملة.
 *
 * `ROLLBACK TO SAVEPOINT` يُعيد إلى نقطة داخلية ولا يُغلق المعاملة، لذا يُصنَّف
 * `null` (لا فتح ولا إغلاق).
 *
 * @param sql - نص العبارة.
 * @returns `open`/`close` لعبارات فتح/إغلاق المعاملة، أو `null` لغيرها.
 */
function classifyTxnSql(sql: string): "open" | "close" | null {
  const keyword = sql.trim().split(/\s+/, 1)[0]?.toUpperCase() ?? "";
  if (keyword === "SAVEPOINT" || keyword === "BEGIN") return "open";
  if (keyword === "COMMIT") return "close";
  if (keyword === "RELEASE") return "close";
  if (keyword === "ROLLBACK") {
    if (/TO\s+SAVEPOINT/i.test(sql)) return null;
    return "close";
  }
  return null;
}

/**
 * يستخرج الكلمة المفتاحية الأولى من SQL للتسجيل الآمن (لا يُسجَّل نص كامل).
 *
 * @param sql - نص العبارة.
 * @returns الكلمة المفتاحية بالأحرف الكبيرة أو `unknown`.
 */
function sqlKeyword(sql: string): string {
  return sql.trim().split(/\s+/, 1)[0]?.toUpperCase() ?? "unknown";
}

/**
 * يحدّث سجل المعاملات المفتوحة بعد نجاح عبارة معاملة على أحد الاتصالين.
 *
 * يفتح عند `SAVEPOINT`/`BEGIN` (مع عمق التعشيش) ويغلق عند `COMMIT`/`RELEASE`/
 * `ROLLBACK` عندما يصل العمق إلى الصفر، بحيث يبقى السجل يمثّل «هل يمسك هذا
 * الاتصال قفل الكتابة الآن» بدقة.
 *
 * @param connection - الاتصال الذي نُفِّذت عليه العبارة.
 * @param sql - نص العبارة المنفَّذة.
 * @param operationId - معرف العملية الحالي.
 * @param context - تسمية سياق مراقبة قاعدة البيانات الحالي.
 */
function trackTxnAfterSuccess(
  connection: "main" | "writer",
  sql: string,
  operationId: string | null,
  context: string | null,
): void {
  const classification = classifyTxnSql(sql);
  if (classification === "open") {
    const current = runtimeState.openTransactions.get(connection);
    if (current) {
      current.depth++;
      return;
    }
    runtimeState.openTransactions.set(connection, {
      connection,
      keyword: sqlKeyword(sql),
      sql,
      openedAt: performance.now(),
      operationId,
      context,
      depth: 1,
    });
    return;
  }
  if (classification === "close") {
    const current = runtimeState.openTransactions.get(connection);
    if (!current) return;
    if (current.depth > 1) {
      current.depth--;
      return;
    }
    runtimeState.openTransactions.delete(connection);
  }
}

/**
 * يسجّل دليل تصادم قفل (`SQLITE_BUSY`) للعبارة الحالية مع صورة لحظية عن
 * الاتصال الآخر: العبارة قيد التنفيذ والمعاملة المفتوحة عليه (الحامل المرجّح
 * لقفل الكتابة) — لإغلاق فجوة أدلة «مَن يمسك القفل ≥30 ثانية».
 *
 * تُستدعى من داخل حلقة إعادة المحاولة عند كل اكتشاف `SQLITE_BUSY` على أي من
 * الاتصالين، ويبقى التسجيل مقصوراً على ما يسمح به الـ logger (dev فقط).
 *
 * @param connection - اتصال العبارة المتصادمة.
 * @param sql - نص العبارة المتصادمة.
 * @param attempt - رقم المحاولة الحالي.
 * @param elapsedMs - المدة المنقضية منذ بدء العبارة حتى رصد التصادم.
 * @param operationId - معرف العملية الحالي.
 * @param context - تسمية سياق مراقبة قاعدة البيانات الحالي.
 */
function emitBusyDetected(
  connection: "main" | "writer",
  sql: string,
  attempt: number,
  elapsedMs: number,
  operationId: string | null,
  context: string | null,
): void {
  const other: "main" | "writer" = connection === "main" ? "writer" : "main";
  const inflight = runtimeState.inflightStatements.get(other);
  const openTxn = runtimeState.openTransactions.get(other);
  logger.warn("db.busy_detected", {
    operationId,
    context: context ?? "",
    connection,
    keyword: sqlKeyword(sql),
    sql: sql.slice(0, 120),
    attempt,
    elapsedMs: Math.round(elapsedMs),
    otherConnection: other,
    otherInflight:
      inflight == null
        ? null
        : {
            keyword: sqlKeyword(inflight.sql),
            sql: inflight.sql.slice(0, 120),
            startedAgoMs: Math.round(performance.now() - inflight.startedAt),
            operationId: inflight.operationId,
            context: inflight.context,
          },
    otherOpenTxn:
      openTxn == null
        ? null
        : {
            keyword: openTxn.keyword,
            sql: openTxn.sql.slice(0, 120),
            ageMs: Math.round(performance.now() - openTxn.openedAt),
            operationId: openTxn.operationId,
            context: openTxn.context,
          },
  });
}

/**
 * ينفّذ `fn` ضمن سياق مراقبة لقاعدة البيانات: كل عبارات SQL أثناءه (على
 * اتصال الكاتب) تُنسب إلى `label` وتُربط بـ `operationId`. السياقات المتداخلة
 * تدمج التسميات (`walk > syncFile`).
 *
 * @param label - تسمية المرحلة/المسؤولية.
 * @param fn - العمل غير المتزامن.
 * @param operationId - معرف العملية المرتبط (افتراضياً: معرف العملية الحالي).
 * @returns نتيجة `fn`.
 */
export function withDbOperationContext<T>(
  label: string,
  fn: () => Promise<T>,
  operationId?: string | null,
): Promise<T> {
  const previous = dbContextStore.getStore();
  const nextOperationId = operationId !== undefined ? operationId : (previous?.operationId ?? null);
  const nextLabel = previous ? `${previous.label} > ${label}` : label;
  return dbContextStore.run({ label: nextLabel, operationId: nextOperationId }, fn);
}

/**
 * يعيد سياق مراقبة قاعدة البيانات الحالي (أو `null` خارجه).
 *
 * @returns سياق المراقبة الحالي أو `null`.
 */
function getDbOperationContext(): DbOperationContext | null {
  return dbContextStore.getStore() ?? null;
}

/**
 * تحديد مسار ملف قاعدة البيانات من البيئة.
 *
 * يُفضّل `DATABASE_URL` (القيمة الموثقة في `.env.example`) مع دعم `DB_PATH`
 * للتوافق القديم، ثم المسار الافتراضي ضمن مجلد `data`.
 *
 * @returns المسار المطلق/النسبي لملف SQLite.
 */
export function resolveDbPath(): string {
  const envPath = process.env["DATABASE_URL"] || process.env["DB_PATH"];
  if (envPath) return envPath;

  // في حالة ويندوز، استخدم ProgramData
  if (process.platform === "win32") {
    return path.join(
      process.env.PROGRAMDATA || "D:\\ProgramData",
      "LibraryManager",
      "media_library.db",
    );
  }

  // في لينكس/ماك، استخدم المسار الافتراضي (أو غيره)
  return path.join(process.cwd(), "data", "media_library.db");
}

const SQLITE_BUSY_CODES = new Set(["SQLITE_BUSY", "SQLITE_LOCKED"]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 100;

/** عتبة (بالملي ثانية) لرصد العبارات البطيئة عبر `db.slow_statement`؛ 0 = معطّل. */
const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS || 0);

/**
 * Serializes savepoint-transaction blocks across the shared singleton SQLite
 * connection.
 *
 * WHY: several async operations (scan walk items, orphan cleanup, FTS backfill)
 * open SAVEPOINTs on the SAME connection handle. If two such blocks interleave
 * at an `await` boundary, the savepoint stack corrupts: `RELEASE` (or
 * `ROLLBACK TO`) of an outer savepoint silently destroys any nested inner
 * savepoint, and the inner `RELEASE` then fails with `no such savepoint`.
 *
 * This lock guarantees at most ONE savepoint transaction is open at any time;
 * the queue is FIFO and never blocks non-savepoint statements.
 *
 * @param fn - The savepoint-transaction block to run exclusively.
 * @returns The block's resolved value; the lock is always released afterwards.
 */
export async function withExclusiveTransaction<T>(fn: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const previous = runtimeState.transactionQueue;
  runtimeState.transactionQueue = previous.then(() => gate);
  const waitStarted = performance.now();
  await previous;
  const waitMs = performance.now() - waitStarted;
  const context = getDbOperationContext();
  recordExclusiveWait(waitMs, context?.operationId ?? currentOperationId());
  try {
    return await fn();
  } finally {
    release();
  }
}

function isSqliteBusy(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  const code = typeof e.code === "string" ? e.code : "";
  const message = typeof e.message === "string" ? e.message : "";
  const errno = typeof e.errno === "number" ? e.errno : -1;
  return (
    SQLITE_BUSY_CODES.has(code) ||
    message.includes("SQLITE_BUSY") ||
    message.includes("SQLITE_LOCKED") ||
    message.includes("database is locked") ||
    errno === 5 ||
    errno === 6
  );
}

function wrapDbMethods(database: Database): Database {
  const methods = ["all", "get", "run", "exec"] as const;
  for (const method of methods) {
    const original = database[method].bind(database);
    (database as unknown as Record<string, unknown>)[method] = async function (...args: unknown[]) {
      // قياس المرحلة 0: عدّ عبارة منطقية واحدة لكل استدعاء على اتصال الكاتب داخل
      // سياق كاتب. يُستثنى `exec` (هجرات/DDL) فهو لا يمثّل عبء المسح لكل عنصر.
      const isWriter = writerContext.getStore() === database;
      if (method !== "exec" && isWriter) {
        runtimeState.scannerDbStatementCount++;
      }

      const connection: "main" | "writer" = isWriter ? "writer" : "main";
      const observe = logger.enabled;
      const slowQueryMs = SLOW_QUERY_MS;
      const started = observe || slowQueryMs > 0 ? performance.now() : 0;
      let attempts = 0;
      let busyOccurrences = 0;
      let lockWaitMs = 0;

      const opContext = getDbOperationContext();
      const operationId = opContext?.operationId ?? currentOperationId();

      if (observe) {
        runtimeState.inflightStatements.set(connection, {
          connection,
          sql: typeof args[0] === "string" ? args[0] : "",
          startedAt: performance.now(),
          operationId,
          context: opContext?.label ?? null,
        });
      }

      try {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          attempts = attempt;
          try {
            const result = await (original as (...a: unknown[]) => Promise<unknown>)(...args);
            const durationMs = performance.now() - started;
            if (observe) {
              const changes =
                result && typeof result === "object" && "changes" in result
                  ? (result as { changes: number }).changes
                  : undefined;
              recordDbObservation(
                {
                  connection,
                  method,
                  sql: typeof args[0] === "string" ? args[0] : "",
                  durationMs,
                  attempts,
                  rowsAffected: changes,
                  busyOccurrences,
                  lockWaitMs,
                  context: opContext?.label,
                },
                operationId,
              );
              trackTxnAfterSuccess(
                connection,
                String(args[0] ?? ""),
                operationId,
                opContext?.label ?? null,
              );
            }
            if (slowQueryMs > 0 && durationMs >= slowQueryMs) {
              logger.warn("db.slow_statement", {
                connection,
                method,
                sql: (typeof args[0] === "string" ? args[0] : "").slice(0, 300),
                durationMs: Math.round(durationMs),
                attempts,
              });
            }
            return result;
          } catch (err) {
            const busy = isSqliteBusy(err);
            if (busy && observe) {
              busyOccurrences++;
              emitBusyDetected(
                connection,
                typeof args[0] === "string" ? args[0] : "",
                attempt,
                performance.now() - started,
                operationId,
                opContext?.label ?? null,
              );
            }
            if (busy && attempt < MAX_RETRIES) {
              const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
              if (observe) {
                lockWaitMs += delay;
              }
              await new Promise((r) => setTimeout(r, delay));
              continue;
            }
            throw err;
          }
        }
      } finally {
        if (observe) {
          runtimeState.inflightStatements.delete(connection);
        }
      }
    };
  }
  return database;
}

async function runMigrations(database: Database): Promise<void> {
  const migDir = path.join(process.cwd(), "src", "backend", "db", "migrations");

  await database.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const files = fs
    .readdirSync(migDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const row = (await database.get("SELECT COUNT(*) as cnt FROM _migrations")) as
    { cnt: number } | undefined;
  const registered = row?.cnt ?? 0;

  const tableRow = (await database.get(
    "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name NOT IN ('_migrations','sqlite_sequence')",
  )) as { cnt: number } | undefined;
  const existingTables = tableRow?.cnt ?? 0;

  if (registered === 0 && existingTables > 0) {
    for (const file of files) {
      await database.run("INSERT OR IGNORE INTO _migrations (filename) VALUES (?)", file);
    }
    logger.info("db.migrations_pre_registered", { files: files.length });
    return;
  }

  for (const file of files) {
    const migRow = (await database.get("SELECT id FROM _migrations WHERE filename = ?", file)) as
      { id: number } | undefined;
    if (migRow) continue;

    const sql = fs.readFileSync(path.join(migDir, file), "utf8");
    await database.exec(sql);
    await database.run("INSERT INTO _migrations (filename) VALUES (?)", file);
    logger.info("db.migration_applied", { file });
  }
}

/**
 * يفتح اتصال SQLite جديد لنفس ملف قاعدة البيانات ويطبّق إعدادات الاتصال
 * (WAL, busy_timeout, mmap, foreign_keys...). عند `runMigrationsFlag` يشغّل
 * الهجرات على هذا الاتصال.
 *
 * ملاحظة: في وضع `:memory:` (الاختبارات) كل اتصال قاعدة مستقلة، لذا يجب
 * تشغيل الهجرات على الاتصالين كي يملك كلاهما المخطط نفسه.
 *
 * @param runMigrationsFlag - هل تُشغَّل الهجرات على هذا الاتصال؟
 * @param isWriter - هل هذا اتصال الكاتب؟ عندها يُعطَّل `wal_autocheckpoint`
 *   ليمنع الـ checkpoint الدوري (كل ~8MB) أثناء المسح فيبقى نمو WAL خطّياً
 *   ويُفلتَر checkpoints على نهاية المسح صراحة (انظر scan-orchestrator).
 * @returns الاتصال المغلف بطبقة إعادة المحاولة على SQLITE_BUSY.
 */
/**
 * معرّف قاعدة ذاكرة مشتركة واحدة لجميع اتصالات الاختبار. في وضع `:memory:`
 * كل اتصال يملك قاعدة مستقلة، لكن الإنتاج يعتمد على أن اتصالي الرئيسي
 * والكاتب يريان البيانات نفسها (ملف واحد). عبر `cache=shared` نشبه ذلك في
 * الاختبارات: اتصالان بنفس الـ URI يتشاركان قاعدة واحدة في الذاكرة.
 */
const SHARED_MEMORY_URI = "file:library_manager_shared?mode=memory&cache=shared";

async function openDatabase(runMigrationsFlag: boolean, isWriter = false): Promise<Database> {
  const dbPath = resolveDbPath();
  const isMemory = dbPath === ":memory:";
  const filename = isMemory ? SHARED_MEMORY_URI : dbPath;

  if (!isMemory) {
    const dbDir = path.dirname(dbPath);
    await fsp.mkdir(dbDir, { recursive: true });
  }

  const database = await open({
    filename,
    // `OPEN_URI` مطلوب ليتفسّر sqlite3 الـ URI (وإلا عومل `file:...` كاسم ملف
    // حرفي ويفشل على ويندوز). لمسارات الملفات العادية لا يُغيّر OPEN_URI
    // شيئاً — النصوص غير المسبوقة بـ `file:` تُعامَل كمسارات عادية.
    ...(isMemory ? { mode: sqlite3.OPEN_URI | sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE } : {}),
    driver: sqlite3.Database,
  });

  await database.run("PRAGMA journal_mode = WAL;");
  await database.run("PRAGMA synchronous = NORMAL;");
  await database.run("PRAGMA busy_timeout = 30000;");
  await database.run("PRAGMA mmap_size = 536870912;");
  await database.run("PRAGMA page_size = 8192;");
  await database.run("PRAGMA cache_size = -64000;");
  await database.run("PRAGMA temp_store = MEMORY;");
  await database.run(
    isWriter ? "PRAGMA wal_autocheckpoint = 0;" : "PRAGMA wal_autocheckpoint = 1000;",
  );
  await database.run("PRAGMA journal_size_limit = 65536;");
  await database.run("PRAGMA foreign_keys = OFF;");

  if (runMigrationsFlag) {
    await runMigrations(database);
  }

  await database.run("PRAGMA foreign_keys = ON;");
  await database.run("PRAGMA optimize;");

  return wrapDbMethods(database);
}

export async function initializeDatabase(): Promise<Database> {
  if (runtimeState.db) return runtimeState.db;
  if (runtimeState.initializationPromise) return runtimeState.initializationPromise;

  runtimeState.initializationPromise = (async () => {
    try {
      runtimeState.db = await openDatabase(true);
      logger.info("db.ready", { message: "Database ready — WAL mode + Auto-Retry SQLITE_BUSY" });
      return runtimeState.db;
    } catch (error) {
      logger.error("db.init_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      runtimeState.initializationPromise = null;
    }
  })();

  return runtimeState.initializationPromise;
}

/**
 * يفتح اتصال SQLite الثاني (المخصص للكاتب) لنفس الملف. في وضع WAL يسمح
 * للقراء على الاتصال الرئيسي بعدم الانتظار خلف عبارات الماسح (كاتب واحد +
 * قراء متزامنون). في وضع `:memory:` يملك مخططاً كاملاً عبر تشغيل الهجرات.
 *
 * @returns اتصال الكتابة المغلف بطبقة إعادة المحاولة.
 */
export async function initializeWriterDatabase(): Promise<Database> {
  if (runtimeState.writerDb) return runtimeState.writerDb;
  if (runtimeState.writerInitializationPromise) return runtimeState.writerInitializationPromise;

  runtimeState.writerInitializationPromise = (async () => {
    try {
      runtimeState.writerDb = await openDatabase(true, true);
      return runtimeState.writerDb;
    } catch (error) {
      logger.error("db.writer_init_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      runtimeState.writerInitializationPromise = null;
    }
  })();

  return runtimeState.writerInitializationPromise;
}

export async function getWriterDatabase(): Promise<Database> {
  if (!runtimeState.writerDb) await initializeWriterDatabase();
  return runtimeState.writerDb!;
}

/**
 * ينفّذ `fn` داخل سياق اتصال الكتابة: كل استدعاءات `getDatabase()` أثناءه
 * (بما فيها الـ await المتداخلة) تعيد اتصال الكتابة، فينفصل عمل الماسح عن
 * اتصال القراءات الرئيسي.
 *
 * مسار سريع متزامن: عندما يكون اتصال الكتابة مفتوحاً أصلاً (الإنتاج بعد أول
 * استخدام، والاختبارات بعد تهيئة أول اختبار) ينطلق `fn` فوراً داخل
 * `AsyncLocalStorage.run` دون إرجاء مايكروتاسك. هذا يحفظ "عقد البداية
 * المتزامنة" الذي تعتمد عليه الاختبارات (بوابة الـ walker تُسجَّل قبل عودة
 * `runScan`) ويُبقي سلوك الإنتاج مطابقاً للسلوك السابق.
 *
 * @param fn - العمل غير المتزامن الذي يجب أن يعمل على اتصال الكتابة.
 * @returns نتيجة `fn` مهما كان نوعها.
 */
export function runInWriterContext<T>(fn: () => Promise<T>): Promise<T> {
  const existing = runtimeState.writerDb;
  if (existing) return writerContext.run(existing, fn);
  return getWriterDatabase().then((wdb) => writerContext.run(wdb, fn));
}

export async function getDatabase(): Promise<Database> {
  const scoped = writerContext.getStore();
  if (scoped) return scoped;
  if (!runtimeState.db) await initializeDatabase();
  return runtimeState.db!;
}

/**
 * Closes the singleton database connection and resets the module state so the
 * next {@link getDatabase} call re-initializes a fresh connection.
 *
 * Used by the backup-restore flow, which replaces the database file on disk
 * and therefore must not keep the previous connection open (SQLite holds the
 * file while a connection is active). After a restore the app is expected to
 * restart so migrations run against the restored file.
 */
export async function closeDatabase(): Promise<void> {
  if (runtimeState.db) {
    const current = runtimeState.db;
    runtimeState.db = null;
    await current.close();
  }
  if (runtimeState.writerDb) {
    const current = runtimeState.writerDb;
    runtimeState.writerDb = null;
    await current.close();
  }
  runtimeState.initializationPromise = null;
  runtimeState.writerInitializationPromise = null;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const d = await getDatabase();
  return d.all(sql, params) as Promise<T[]>;
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const d = await getDatabase();
  return d.get(sql, params) as Promise<T | undefined>;
}

export async function run(
  sql: string,
  params: unknown[] = [],
): Promise<{ lastID: number; changes: number }> {
  const d = await getDatabase();
  return d.run(sql, params) as Promise<{ lastID: number; changes: number }>;
}

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options?: { maxRetries?: number; baseDelay?: number },
): Promise<T> {
  const maxRetries = options?.maxRetries ?? MAX_RETRIES;
  const baseDelay = options?.baseDelay ?? BASE_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (isSqliteBusy(err) && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * يعيد تصفير عداد عبارات اتصال الكاتب إلى الصفر.
 *
 * يُستخدم في الاختبارات لتأسيس نقطة انطلاق. الماسح يعتمد فرق لقطة
 * (`getScannerDbStatementCount`) بدل إعادة التصفير ليتوافق مع المسح المتوازي
 * (حِزَم الحاويات المتزامنة) فلا يتلوث العد بين الأشقاء.
 */
export function resetScannerDbStatementCount(): void {
  runtimeState.scannerDbStatementCount = 0;
}

/**
 * يعيد عدد عبارات SQL المنفَّذة على اتصال الكاتب داخل سياق كاتب منذ آخر
 * لقطة/تصفير (قياس المرحلة 0). يُستثنى `exec`.
 *
 * @returns عدد العبارات المحسوبة.
 */
export function getScannerDbStatementCount(): number {
  return runtimeState.scannerDbStatementCount;
}

/**
 * يعيد الحجم الحالي لملف WAL (بالبايت) عبر فحص ملف `-wal` على القرص.
 *
 * القياس غير تدخّلي تماماً (لا ينفّذ checkpoint) ويستخدم لقياس نمو WAL حول
 * المسح وتضمينه في تقرير الاختناقات (`scanner.bottlenecks`).
 *
 * @returns حجم ملف WAL بالبايت، أو 0 إن لم يوجد/تعذّر قراءته.
 */
export async function getWalBytes(): Promise<number> {
  const dbPath = resolveDbPath();
  try {
    const stats = await fsp.stat(`${dbPath}-wal`);
    return stats.size;
  } catch {
    return 0;
  }
}

export { isSqliteBusy };
