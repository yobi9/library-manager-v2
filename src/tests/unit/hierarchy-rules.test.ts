/**
 * اختبارات وحدة لقواعد اشتقاق الأنواع (HierarchyRules).
 *
 * الغاية: تأمين مصفوفة القرار `resolveType` عبر كل أنواع المكتبات:
 * - الصوتيات الهرمية (`music`/`singer`/`audio_deen`) تنتج `album`/`song` فقط
 *   ولا تنتج أبداً `season`/`episode`.
 * - الفيديو الهرمي ينتج `season`/`episode` فقط ولا ينتج أبداً `album`/`song`.
 * - تغطية المكتبات أحادية الملف والمسطحة وأقصى الأعماق وأنواع الوريقات.
 */
import { describe, expect, it } from "vitest";
import { HierarchyRules, AUDIO_LIBRARY_TYPES } from "@/backend/scanner/hierarchy-rules";
import type { LibraryType } from "@/backend/scanner/scanner-events";

const rules = new HierarchyRules();

const AUDIO_LIBS: LibraryType[] = [...AUDIO_LIBRARY_TYPES];
const VIDEO_LIBS: LibraryType[] = [
  "series",
  "series_anime",
  "series_sports",
  "series_deen",
  "series_ramadan",
  "series_tv",
  "series_learn",
  "series_kids",
  "series_doc",
];

describe("resolveType — مكتبات صوتية هرمية", () => {
  for (const lib of AUDIO_LIBS) {
    it(`${lib}: جذر → ألبوم → أغنية فقط`, () => {
      expect(rules.resolveType({ libraryType: lib, depth: 0, isFile: false })).toBe(lib);
      expect(rules.resolveType({ libraryType: lib, depth: 1, isFile: false })).toBe("album");
      expect(rules.resolveType({ libraryType: lib, depth: 1, isFile: true })).toBe("song");
      expect(rules.resolveType({ libraryType: lib, depth: 2, isFile: true })).toBe("song");
      expect(rules.resolveType({ libraryType: lib, depth: 1, isFile: false })).not.toBe("season");
      expect(rules.resolveType({ libraryType: lib, depth: 1, isFile: true })).not.toBe("episode");
    });
  }
});

describe("resolveType — مكتبات فيديو هرمية", () => {
  for (const lib of VIDEO_LIBS) {
    it(`${lib}: جذر → موسم → حلقة فقط`, () => {
      expect(rules.resolveType({ libraryType: lib, depth: 0, isFile: false })).toBe(lib);
      expect(rules.resolveType({ libraryType: lib, depth: 1, isFile: false })).toBe("season");
      expect(rules.resolveType({ libraryType: lib, depth: 1, isFile: true })).toBe("episode");
      expect(rules.resolveType({ libraryType: lib, depth: 2, isFile: true })).toBe("episode");
      expect(rules.resolveType({ libraryType: lib, depth: 1, isFile: false })).not.toBe("album");
      expect(rules.resolveType({ libraryType: lib, depth: 1, isFile: true })).not.toBe("song");
    });
  }
});

describe("resolveType — مكتبات أحادية الملف", () => {
  it("movie: ملفات عمق 0/1، مجلد جذر فقط", () => {
    expect(rules.resolveType({ libraryType: "movie", depth: 0, isFile: false })).toBe("movie");
    expect(rules.resolveType({ libraryType: "movie", depth: 0, isFile: true })).toBe("movie");
    expect(rules.resolveType({ libraryType: "movie", depth: 1, isFile: true })).toBe("movie");
    expect(rules.resolveType({ libraryType: "movie", depth: 1, isFile: false })).toBeNull();
  });
});

describe("resolveType — مكتبات مسطّحة", () => {
  it("vidsSameFolder: مجلد الجذر فقط ثم إهمال الملفات", () => {
    expect(rules.resolveType({ libraryType: "vidsSameFolder", depth: 0, isFile: false })).toBe(
      "vidsSameFolder",
    );
    expect(rules.resolveType({ libraryType: "vidsSameFolder", depth: 1, isFile: true })).toBeNull();
  });
});

describe("getMaxDepth", () => {
  it("يعيد 10 لجميع المكتبات الهرمية", () => {
    for (const lib of [...AUDIO_LIBS, ...VIDEO_LIBS]) {
      expect(rules.getMaxDepth(lib)).toBe(10);
    }
  });

  it("يعيد 1 للمكتبات أحادية الملف", () => {
    expect(rules.getMaxDepth("movie")).toBe(1);
    expect(rules.getMaxDepth("theater")).toBe(1);
  });

  it("يعيد 0 لنوع غير معرّف", () => {
    expect(rules.getMaxDepth("unknown")).toBe(0);
  });
});

describe("isLeafType", () => {
  it("يعرّف الوريقات ولا يعرّف track المحذوف", () => {
    expect(rules.isLeafType("song")).toBe(true);
    expect(rules.isLeafType("episode")).toBe(true);
    expect(rules.isLeafType("movie")).toBe(true);
    expect(rules.isLeafType("track")).toBe(false);
  });
});
