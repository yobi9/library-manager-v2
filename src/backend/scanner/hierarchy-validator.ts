import { getDatabase } from "../db/db";
import type { MediaRepository } from "../repositories/media-repository";
import type { LibraryRepository } from "../repositories/library-repository";
import { HierarchyRules } from "./hierarchy-rules";

interface Violation {
  type: string;
  media_id?: number;
  title?: string;
  message: string;
  severity?: string;
}

interface ValidationResult {
  passed: number;
  failed: number;
  violations: Violation[];
}

export class HierarchyValidator {
  constructor(
    private mediaRepo: MediaRepository,
    private libraryRepo: LibraryRepository,
    private rules: HierarchyRules,
  ) {}

  async validateAll(): Promise<ValidationResult> {
    const db = await getDatabase();
    const totalCount = await db.get("SELECT COUNT(*) as count FROM media_items") as { count: number };

    const violations: Violation[] = [];

    violations.push(...await this.validateDepths());
    violations.push(...await this.validateLeafTypes());
    violations.push(...await this.validateRelationships());
    violations.push(...await this.validatePathConsistency());

    return {
      passed: (totalCount.count ?? 0) - violations.length,
      failed: violations.length,
      violations,
    };
  }

  private async validateDepths(): Promise<Violation[]> {
    const db = await getDatabase();
    const items = await db.all(
      "SELECT media_id, title, type, hierarchical_level, library_id FROM media_items",
    ) as Array<{ media_id: number; title: string; type: string; hierarchical_level: number; library_id: number }>;

    const libIds = [...new Set(items.map((i) => i.library_id).filter(Boolean))];
    const libs = libIds.length > 0
      ? await this.libraryRepo.getByIds?.(libIds) ?? []
      : [];
    const libMap = new Map((libs as Array<{ library_id: number; type: string }>).map((l) => [l.library_id, l]));

    const violations: Violation[] = [];
    for (const item of items) {
      const library = libMap.get(item.library_id);
      if (!library) continue;
      const maxDepth = this.rules.getMaxDepth(library.type);
      if (maxDepth !== undefined && item.hierarchical_level > maxDepth) {
        violations.push({
          type: "DEPTH_EXCEEDED",
          media_id: item.media_id,
          title: item.title,
          message: `${item.type} at level ${item.hierarchical_level} exceeds max depth ${maxDepth} for ${library.type}`,
        });
      }
    }
    return violations;
  }

  private async validateLeafTypes(): Promise<Violation[]> {
    const db = await getDatabase();
    const items = await db.all(`
      SELECT m.media_id, m.title, m.type, m.is_leaf,
        (SELECT COUNT(*) FROM media_items c WHERE c.parent_media_id = m.media_id) as child_count
      FROM media_items m
    `) as Array<{ media_id: number; title: string; type: string; is_leaf: number; child_count: number }>;

    const violations: Violation[] = [];
    for (const item of items) {
      if (this.rules.isLeafType(item.type) && item.child_count > 0) {
        violations.push({
          type: "LEAF_TYPE_HAS_CHILDREN",
          media_id: item.media_id,
          title: item.title,
          message: `${item.type} is leaf but has ${item.child_count} children`,
        });
      }
    }
    return violations;
  }

  private async validateRelationships(): Promise<Violation[]> {
    const db = await getDatabase();
    const rels = await db.all(`
      SELECT child.media_id as child_id, child.title as child_title, child.type as child_type,
             parent.media_id as parent_id, parent.title as parent_title, parent.type as parent_type
      FROM media_items child
      JOIN media_items parent ON child.parent_media_id = parent.media_id
    `) as Array<{ child_id: number; child_title: string; child_type: string; parent_id: number; parent_title: string; parent_type: string }>;

    const violations: Violation[] = [];
    for (const rel of rels) {
      const parentRule = this.rules.rules.relationships[rel.parent_type];
      if (!parentRule) {
        violations.push({
          type: "UNKNOWN_PARENT_TYPE",
          media_id: rel.child_id,
          title: rel.child_title,
          message: `Parent type '${rel.parent_type}' has no defined rules`,
        });
        continue;
      }
      const isFile = rel.child_type === "episode" || rel.child_type === "song";
      const allowed = isFile ? parentRule.files : parentRule.directories;
      if (!allowed.includes(rel.child_type)) {
        violations.push({
          type: "ILLEGAL_RELATIONSHIP",
          media_id: rel.child_id,
          title: rel.child_title,
          message: `${rel.child_type} cannot be child of ${rel.parent_type}`,
        });
      }
    }
    return violations;
  }

  private async validatePathConsistency(): Promise<Violation[]> {
    const db = await getDatabase();
    const items = await db.all(`
      SELECT child.media_id, child.title, child.type,
             child.directory_path as child_path,
             parent.directory_path as parent_path
      FROM media_items child
      JOIN media_items parent ON child.parent_media_id = parent.media_id
      WHERE child.directory_path IS NOT NULL AND parent.directory_path IS NOT NULL
    `) as Array<{ media_id: number; title: string; type: string; child_path: string; parent_path: string }>;

    const violations: Violation[] = [];
    for (const item of items) {
      const expected = item.parent_path.replace(/[\\/]$/, "");
      const child = item.child_path.replace(/[\\/]$/, "");
      if (!child.startsWith(expected)) {
        violations.push({
          type: "PATH_CONSISTENCY_VIOLATION",
          media_id: item.media_id,
          title: item.title,
          message: `Child path "${child}" does not start with parent "${expected}"`,
        });
      }
    }
    return violations;
  }
}
