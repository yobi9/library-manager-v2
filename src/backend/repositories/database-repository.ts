import { getDatabase, resolveDbPath, runInWriterContext } from "../db/db";
import fs from "fs/promises";

export class DatabaseRepository {
  /**
   * يحدد المسار الحالي لقاعدة البيانات عبر مصدر الحقيقة الوحيد `resolveDbPath`
   * (الأولوية: DATABASE_URL ثم DB_PATH ثم data/media_library.db افتراضياً).
   *
   * مهم للنسخ الاحتياطي والاستعادة: قبل هذا الإصلاح كان `getDbPath` يتجاهل
   * `DATABASE_URL` فيكتب الاستعادة على ملف خاطئ عند النشر بمتغير مخصص.
   *
   * @returns مسار ملف SQLite النشط.
   */
  getDbPath(): string {
    return resolveDbPath();
  }

  async getDbSize() {
    const dbPath = this.getDbPath();
    let fileSizeBytes = 0;
    try {
      const stat = await fs.stat(dbPath);
      fileSizeBytes = stat.size;
    } catch {
      // file may not exist yet
    }
    const size =
      fileSizeBytes > 1048576
        ? `${(fileSizeBytes / 1048576).toFixed(2)} MB`
        : `${(fileSizeBytes / 1024).toFixed(2)} KB`;
    return { bytes: fileSizeBytes, formatted: size };
  }

  /**
   * يجلب قائمة جداول القاعدة مع عدد الصفوف لكل جدول.
   *
   * تُنفَّذ على اتصال الكاتب (`runInWriterContext`) بحيث لا تحبس القراءات
   * عمليات العملاء على الاتصال الرئيسي أثناء إحصاءات `COUNT(*)` — جزء من
   * خطة العزل 3.5.3.
   *
   * @returns مصفوفة عناصر `{ name, rows, size }` مرتبة أبجدياً حسب اسم الجدول.
   */
  async getTables() {
    return runInWriterContext(async () => {
      const db = await getDatabase();
      const rows = (await db.all(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      )) as { name: string }[];
      const tables: { name: string; rows: number; size: string }[] = [];
      for (const row of rows) {
        const cnt = (await db.get(`SELECT COUNT(*) as cnt FROM "${row.name}"`)) as
          { cnt: number } | undefined;
        tables.push({ name: row.name, rows: cnt?.cnt ?? 0, size: "-" });
      }
      return tables;
    });
  }

  async getTotalRecords(): Promise<number> {
    const tables = await this.getTables();
    return tables.reduce((sum, t) => sum + t.rows, 0);
  }

  /**
   * ينشئ نسخة احتياطية متسقة من القاعدة عبر `VACUUM INTO`.
   *
   * تُنفَّذ على اتصال الكاتب (`runInWriterContext`) بدل الاتصال الرئيسي حتى
   * لا ينتظر عملاء HTTP خلف النسخ الكامل — جزء من خطة العزل 3.5.1. القارئون
   * على الاتصال الرئيسي لا يتأثرون (WAL)، والمنافسة الوحيدة المتبقية هي مع
   * أي كاتب آخر (الماسح) وتُدار بواسطة SQLite `busy_timeout`.
   *
   * @param backupPath - المسار الكامل لملف النسخة الاحتياطية الناتجة.
   * @returns لا تُرجع قيمة (void).
   */
  async backup(backupPath: string) {
    return runInWriterContext(async () => {
      const db = await getDatabase();
      await db.run("VACUUM INTO ?", [backupPath]);
    });
  }

  async optimize() {
    const db = await getDatabase();
    await db.run("PRAGMA optimize;");
    await db.run("PRAGMA analysis_limit=400;");
    await db.run("PRAGMA shrink_memory;");
  }

  /**
   * يُفرغ جميع جداول القاعدة ما عدا سجل الترحيلات (`_migrations`).
   *
   * تُنفَّذ بالكامل على اتصال الكاتب (`runInWriterContext`) — `getTables`
   * أصبح يعمل على الكاتب بعد خطة العزل 3.5.3، وكل `DELETE` هنا يُنفَّذ على
   * نفس الاتصال — بحيث لا تُحبس طلبات HTTP أثناء إعادة ضبط المصنع.
   *
   * قيود المفاتيح الأجنبية تُعطَّل مؤقتاً للسماح بتفريغ الجداول بأي ترتيب
   * دون انتهاك قيود الأبناء، ثم تُعاد قبل مغادرة الدالة.
   *
   * @returns لا تُرجع قيمة (void).
   */
  async truncateAll() {
    return runInWriterContext(async () => {
      const tables = await this.getTables();
      const db = await getDatabase();
      // FK constraints are temporarily disabled so tables can be cleared in any
      // order without hitting child-row violations during the factory reset.
      await db.run("PRAGMA foreign_keys = OFF;");
      try {
        for (const table of tables) {
          // Keep migration history so migrations are NOT re-applied on restart.
          if (table.name === "_migrations") continue;
          await db.run(`DELETE FROM "${table.name}"`);
        }
      } finally {
        await db.run("PRAGMA foreign_keys = ON;");
      }
    });
  }
}
