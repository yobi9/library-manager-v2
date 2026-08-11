#!/usr/bin/env node
/**
 * normalize-person-images.mjs — توحيد مسارات صور الأشخاص في media_people
 *
 * المشكلة:
 *   profile_path مكرر في صفوف media_people (صف لكل عمل) وقد تتضارب قيمه عبر
 *   الصفوف (هاشات قديمة/جديدة) أو تشير لملف مفقود على القرص. الاختيار الحالي
 *   MAX(profile_path) (مقارنة نصية) قد يختار مساراً مكسوراً.
 *
 * الحل (بلا أي حقل/مخطط جديد):
 *   لكل شخص، تحديد "القيمة الموحّدة" عبر أولوية فعلية:
 *     1) أحدث مسار محلي (أعلى MAX(id)) يوجد ملفه فعلاً على القرص
 *     2) المرجع الخام TMDB (يُجلب من CDN) — إن لم يوجد أي ملف محلي
 *     3) NULL — لا صورة قابلة للعرض
 *   ثم كتابة القيمة نفسها في كل صفوف الشخص. بعدها يصبح MAX(profile_path)
 *   صحيحاً تلقائياً، وتزول التعارضات (2+ قيمة) والمسارات المكسورة.
 *
 * الاستخدام:
 *   node scripts/normalize-person-images.mjs                 # dry-run (تقرير فقط)
 *   node scripts/normalize-person-images.mjs --apply         # نسخة احتياطية + كتابة
 *   node scripts/normalize-person-images.mjs --root E:\img\enriched --db data\media_library.db
 *
 * ملاحظة التخزين الخارجي:
 *   المسار المخزَّن في القاعدة يبقى web-relative (/assets/images/enriched/...)
 *   ويُربط بالجذر الخارجي عبر بادئة ENRICHED_WEB_PREFIX (مطابقةً لسلوك
 *   image-service.resolveImagePath).
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/** بادئة الويب القديمة لصور الإثراء (مطابقة image-service.ENRICHED_WEB_PREFIX). */
const ENRICHED_WEB_PREFIX = "/assets/images/enriched";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
};
const ROOT = argValue("--root") ?? "D:\\assets\\images\\enriched";
const DB_PATH = argValue("--db") ?? path.join(process.cwd(), "data", "media_library.db");
const PERSONS_DIR = path.join(ROOT, "persons");
const PROJECT_ROOT = process.cwd();

/** مرجع TMDB خام: مقطع واحد عند جذر الويب (مثل /abc123.jpg). */
const isTmdbRaw = (p) => p.startsWith("/") && !p.slice(1).includes("/");

/** تعيين مسار مخزّن (web-relative أو نسبي) إلى مسار قرص تحت الجذر. */
const toDiskPath = (storedPath) => {
  const rel = storedPath.startsWith(ENRICHED_WEB_PREFIX)
    ? storedPath.slice(ENRICHED_WEB_PREFIX.length)
    : storedPath;
  return path.join(ROOT, rel.replace(/^[/\\]+/, ""));
};

const fileExists = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

/**
 * يختار القيمة الموحّدة لشخص من قائمة مساراته المميزة.
 *
 * @param {Array<{ profile_path: string, max_id: number }>} variants - المسارات المميزة للشخص.
 * @returns {string | null} القيمة الموحّدة (أو null عند غياب أي صورة قابلة للعرض).
 */
function resolveBest(variants) {
  const localExisting = variants
    .filter((v) => !isTmdbRaw(v.profile_path) && fileExists(toDiskPath(v.profile_path)))
    .sort((a, b) => b.max_id - a.max_id);
  if (localExisting.length) return localExisting[0].profile_path;

  const raw = variants.filter((v) => isTmdbRaw(v.profile_path)).sort((a, b) => b.max_id - a.max_id);
  if (raw.length) return raw[0].profile_path;

  return null;
}

/** نسخة احتياطية للقاعدة قبل الكتابة. */
function backupDb() {
  const backupsDir = path.join(PROJECT_ROOT, "data", "backups");
  fs.mkdirSync(backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(backupsDir, `normalize-person-images-${stamp}`);
  fs.mkdirSync(target, { recursive: true });
  for (const suffix of ["", "-wal", "-shm"]) {
    const src = `${DB_PATH}${suffix}`;
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(target, path.basename(src)));
  }
  return target;
}

// ---------------------------------------------------------------------------
// مرحلة 1: فتح القاعدة وجمع البيانات
// ---------------------------------------------------------------------------
const db = new DatabaseSync(DB_PATH, APPLY ? {} : { readOnly: true });
if (APPLY) db.exec("PRAGMA busy_timeout = 15000;");

const variantsRows = db
  .prepare(
    `SELECT person_id, profile_path, MAX(id) AS max_id
     FROM media_people
     WHERE person_id IS NOT NULL AND profile_path IS NOT NULL
     GROUP BY person_id, profile_path`,
  )
  .all();

const byPerson = new Map();
for (const r of variantsRows) {
  if (!byPerson.has(r.person_id)) byPerson.set(r.person_id, []);
  byPerson.get(r.person_id).push({ profile_path: r.profile_path, max_id: r.max_id });
}

const currentRows = db
  .prepare(
    `SELECT person_id, MAX(profile_path) AS cur FROM media_people
     WHERE person_id IS NOT NULL GROUP BY person_id`,
  )
  .all();
const current = new Map(currentRows.map((r) => [r.person_id, r.cur]));

// أعداد قبلية للتقرير
const brokenBefore = (() => {
  const localRefs = new Set(
    variantsRows
      .map((r) => r.profile_path)
      .filter((p) => !isTmdbRaw(p) && p.startsWith(ENRICHED_WEB_PREFIX)),
  );
  return [...localRefs].filter((p) => !fileExists(toDiskPath(p)));
})();

const personsDirFiles = fs.existsSync(PERSONS_DIR) ? fs.readdirSync(PERSONS_DIR).length : 0;

// ---------------------------------------------------------------------------
// مرحلة 2: حساب القيمة الموحّدة لكل شخص
// ---------------------------------------------------------------------------
// plan: خريطة (personId → best) لكل شخص لديه صفوف profile_path — تُوحَّد
// كل صفوفه إلى هذه القيمة (وليست فقط الأشخاص الذين يظهر تغيير في MAX).
const plan = new Map();
for (const [personId, variants] of byPerson) {
  plan.set(personId, resolveBest(variants));
}

// changes: الأشخاص الذين يتغيّر MAX(profile_path) لديهم (أثر ظاهر للمستخدم).
const changes = [];
for (const [personId, best] of plan) {
  const cur = current.get(personId);
  if (best !== cur)
    changes.push({ personId, variants: byPerson.get(personId).length, from: cur, to: best });
}

const withConflicts = [...byPerson.values()].filter((v) => v.length > 1).length;
const setToNull = changes.filter((c) => c.to === null).length;

// ---------------------------------------------------------------------------
// مرحلة 3: تطبيق أو تقرير فقط
// ---------------------------------------------------------------------------
let rowsUpdated = 0;
if (APPLY) {
  const backupDir = backupDb();
  db.exec("BEGIN");
  for (const [personId, best] of plan) {
    if (best === null) {
      const stmt = db.prepare(
        `UPDATE media_people SET profile_path = NULL
         WHERE person_id = ? AND profile_path IS NOT NULL`,
      );
      rowsUpdated += Number(stmt.run(personId).changes);
    } else {
      const stmt = db.prepare(
        `UPDATE media_people SET profile_path = ?
         WHERE person_id = ? AND (profile_path IS NULL OR profile_path <> ?)`,
      );
      rowsUpdated += Number(stmt.run(best, personId, best).changes);
    }
  }
  db.exec("COMMIT");

  // أعداد بعدية
  const countBrokenLocal = () => {
    const afterLocal = db
      .prepare(
        `SELECT DISTINCT profile_path FROM media_people
         WHERE profile_path IS NOT NULL AND profile_path LIKE ?`,
      )
      .all(`${ENRICHED_WEB_PREFIX}%`);
    return afterLocal.filter((r) => !fileExists(toDiskPath(r.profile_path))).length;
  };
  const brokenAfter = countBrokenLocal();

  console.log("=== نتيجة التطبيق (--apply) ===");
  console.log(`النسخة الاحتياطية: ${backupDir}`);
  console.log(`الأشخاص المغيَّرون: ${changes.length}`);
  console.log(`الصفوف المحدَّثة: ${rowsUpdated}`);
  console.log(`منهم أصبحوا بلا صورة (null): ${setToNull}`);
  console.log(`مسارات محلية مكسورة بعد التطبيق: ${brokenAfter} (يجب أن تكون 0)`);
} else {
  console.log("=== تقرير جاف (--dry-run، لا كتابة) ===");
  console.log(`الجذر الخارجي: ${ROOT}`);
  console.log(`ملفات مجلد persons: ${personsDirFiles}`);
  console.log(`أشخاص لديهم profile_path: ${byPerson.size}`);
  console.log(`أشخاص بمسارات متضاربة (2+ قيمة): ${withConflicts}`);
  console.log(`مسارات محلية مكسورة (مذكورة بلا ملف): ${brokenBefore.length}`);
  console.log(`سيتغيّرون إلى قيمة موحّدة: ${changes.length}  (منهم null: ${setToNull})`);
  console.log(`الصفوف المتأثرة: ${changes.reduce((s, c) => s + c.variants, 0)}`);
  console.log("");
  console.log("عيّنة التغييرات:");
  for (const c of changes.slice(0, 5)) {
    console.log(
      `  person ${c.personId}: ${String(c.from ?? "(null)")
        .split("/")
        .pop()} → ${String(c.to ?? "(null)")
        .split("/")
        .pop()}`,
    );
  }
  console.log("");
  console.log(
    "للتطبيق الفعلي (مع نسخة احتياطية): node scripts/normalize-person-images.mjs --apply",
  );
}

db.close();
