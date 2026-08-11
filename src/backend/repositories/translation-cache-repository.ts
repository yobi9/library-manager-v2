import { createHash } from "crypto";
import { getDatabase } from "../db/db";

export class TranslationCacheRepository {
  async get(text: string, targetLang = "ar"): Promise<string | null> {
    if (!text) return null;
    const hash = this._hash(text);
    try {
      const db = await getDatabase();
      const row = (await db.get(
        "SELECT translated_text FROM translation_cache WHERE source_hash = ? AND target_lang = ?",
        [hash, targetLang],
      )) as { translated_text: string } | undefined;
      return row?.translated_text ?? null;
    } catch {
      return null;
    }
  }

  async set(text: string, targetLang: string, translation: string) {
    if (!text || !translation) return;
    const hash = this._hash(text);
    try {
      const db = await getDatabase();
      await db.run(
        `INSERT OR REPLACE INTO translation_cache (source_hash, source_text, target_lang, translated_text)
         VALUES (?, ?, ?, ?)`,
        [hash, text.substring(0, 500), targetLang, translation.substring(0, 2000)],
      );
    } catch {
      // non-fatal
    }
  }

  async getBulk(texts: string[], targetLang = "ar"): Promise<Map<string, string>> {
    if (!texts.length) return new Map();
    const hashes = texts.map((t) => this._hash(t));
    try {
      const db = await getDatabase();
      const placeholders = hashes.map(() => "?").join(",");
      const rows = (await db.all(
        `SELECT source_hash, source_text, translated_text FROM translation_cache
         WHERE source_hash IN (${placeholders}) AND target_lang = ?`,
        [...hashes, targetLang],
      )) as {
        source_hash: string;
        source_text: string;
        translated_text: string;
      }[];
      const map = new Map<string, string>();
      for (const row of rows) {
        map.set(row.source_text, row.translated_text);
      }
      return map;
    } catch {
      return new Map();
    }
  }

  async stats(): Promise<{ cachedEntries: number }> {
    try {
      const db = await getDatabase();
      const row = (await db.get(
        "SELECT COUNT(*) as count FROM translation_cache",
      )) as { count: number } | undefined;
      return { cachedEntries: row?.count ?? 0 };
    } catch {
      return { cachedEntries: 0 };
    }
  }

  private _hash(text: string): string {
    return createHash("md5").update(text).digest("hex");
  }
}
