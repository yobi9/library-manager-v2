import { initializeDatabase, getDatabase } from "./db";
import { logger } from "../observability/logger";

export async function migrate(): Promise<void> {
  await initializeDatabase();
  const db = await getDatabase();
  const row = (await db.get(
    "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name NOT IN ('_migrations','sqlite_sequence')",
  )) as { cnt: number } | undefined;
  logger.info("db.migrate_ready", { tables: row?.cnt ?? 0 });
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("db.migrate_failed", {
        message: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    });
}
