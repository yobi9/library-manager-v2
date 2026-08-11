import { getDatabase } from "../db/db";

export class ImageRepository {
  async getLibraryImage(libraryId: number) {
    const db = await getDatabase();
    const lib = (await db.get("SELECT image FROM libraries WHERE library_id = ?", [libraryId])) as
      { image: string } | undefined;
    return lib?.image ?? null;
  }

  async getMediaImage(mediaId: number, column: "poster_path" | "backdrop_path") {
    const db = await getDatabase();
    const media = (await db.get(`SELECT ${column} FROM media_items WHERE media_id = ?`, [
      mediaId,
    ])) as Record<string, string> | undefined;
    return media?.[column] ?? null;
  }

  /**
   * Fetches all image-related fields for a media item, including its parent reference
   * to enable cascading fallback lookups up the hierarchy.
   *
   * @param mediaId - The media item ID.
   * @returns An object with poster, backdrop, enriched paths and parent_media_id,
   *          or null if the item does not exist.
   */
  async getMediaImageData(mediaId: number): Promise<{
    poster_path: string | null;
    backdrop_path: string | null;
    enriched_poster: string | null;
    enriched_backdrop: string | null;
    parent_media_id: number | null;
  } | null> {
    const db = await getDatabase();
    const row = (await db.get(
      `SELECT poster_path, backdrop_path, enriched_poster, enriched_backdrop, parent_media_id
       FROM media_items WHERE media_id = ?`,
      [mediaId],
    )) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      poster_path: (row["poster_path"] as string) ?? null,
      backdrop_path: (row["backdrop_path"] as string) ?? null,
      enriched_poster: (row["enriched_poster"] as string) ?? null,
      enriched_backdrop: (row["enriched_backdrop"] as string) ?? null,
      parent_media_id: (row["parent_media_id"] as number) ?? null,
    };
  }

  /**
   * Retrieves the distinct candidate profile paths for a person.
   *
   * A person can have multiple `media_people` rows (one per role) that may carry
   * different `profile_path` values — e.g. an imported local enriched reference
   * (`/assets/images/enriched/persons/...`) on older rows and a TMDB-relative
   * reference (`/abc123.jpg`) on newer ones. The paths are returned newest-first
   * so the most recent enrichment wins when several are valid.
   *
   * @param personId - The person ID (TMDB person id) to look up.
   * @returns The distinct stored profile_path values, newest-first; empty when
   *          the person has no image.
   */
  async getPersonImages(personId: number): Promise<string[]> {
    const db = await getDatabase();
    const rows = (await db.all(
      `SELECT profile_path
       FROM media_people
       WHERE person_id = ? AND profile_path IS NOT NULL
       GROUP BY profile_path
       ORDER BY MAX(id) DESC`,
      [personId],
    )) as Array<{ profile_path: string }>;
    return rows.map((row) => row.profile_path);
  }
}
