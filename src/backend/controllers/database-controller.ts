import { BaseController } from "./base-controller";
import type { DatabaseService } from "../services/database-service";
import fs from "fs/promises";

export class DatabaseController extends BaseController {
  constructor(private databaseService: DatabaseService) {
    super();
  }

  async getStats() {
    try {
      const stats = await this.databaseService.getStats();
      return this.ok(stats);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createBackup() {
    try {
      const result = await this.databaseService.createBackup();
      return this.ok(result, "Backup created");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async optimize() {
    try {
      await this.databaseService.optimize();
      return this.ok(null, "Database optimized");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getBackups() {
    try {
      const backups = await this.databaseService.getBackupsList();
      return this.ok({ backups });
    } catch (err) {
      return this.handleError(err);
    }
  }

  async restore(file: File | null) {
    try {
      if (!file) return this.error("لم يتم اختيار ملف");
      await this.databaseService.restoreBackup(file);
      return this.ok(null, "تمت استعادة قاعدة البيانات بنجاح، يرجى إعادة تشغيل التطبيق");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async factoryReset() {
    try {
      await this.databaseService.performFactoryReset();
      return this.ok(null, "تم تصفير البيانات بنجاح");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async downloadBackup(filename: string) {
    try {
      if (
        !filename ||
        filename.includes("..") ||
        filename.includes("/") ||
        filename.includes("\\")
      ) {
        return this.error("Invalid filename", 400);
      }
      const filePath = this.databaseService.getBackupPath(filename);
      let content: Buffer;
      try {
        content = await fs.readFile(filePath);
      } catch {
        return this.notFound("الملف غير موجود");
      }
      const response = new Response(content as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
      return this.ok(response);
    } catch (err) {
      return this.handleError(err);
    }
  }
}
