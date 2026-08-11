/**
 * اختبارات وحدة متجوّل الدلائل (DirectoryWalker) لعلامات الاستثناء.
 *
 * الغاية: تأمين سلوك `.ignore` / `.nomedia` — أي مجلد (بما فيه جذر المكتبة)
 * يحوي إحدى العلامتين يُتخطى كلياً: لا يُضاف ولا يُزاح (traversal) داخله.
 * المطابقة غير حساسة لحالة الأحرف، والعلامة لا تمس العناصر المفهرسة سابقاً.
 */
import { describe, expect, it, afterEach } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { DirectoryWalker, isExclusionMarker } from "@/backend/scanner/directory-walker";
import { HierarchyRules } from "@/backend/scanner/hierarchy-rules";
import { PathValidationService } from "@/backend/scanner/path-validation.service";
import type { LibraryRecord, WalkResult, WalkedItem } from "@/backend/scanner/scanner-events";

function buildWalker(): DirectoryWalker {
  return new DirectoryWalker(new HierarchyRules(), new PathValidationService(), {
    maxDepth: 6,
    batchDelayMs: 0,
    enableFileScan: true,
  });
}

/**
 * يمسح مجلد مكتبة سلسلة ويعيد المسارات التي زارها علىItem والنتيجة الكاملة.
 *
 * @param rootPath - مسار مجلد جذر مكتبة مؤقت.
 * @returns المسارات المزارة بالترتيب ونتيجة الـ walk (عدّادات/استثناءات).
 */
async function walkCollect(rootPath: string): Promise<{ visited: string[]; result: WalkResult }> {
  const walker = buildWalker();
  const visited: string[] = [];
  const onItem = async (item: WalkedItem) => {
    visited.push(item.path);
    return undefined;
  };
  const library: LibraryRecord = { library_id: 1, name: "test", type: "series", paths: [rootPath] };
  const result = await walker.walk(library, onItem);
  return { visited, result };
}

describe("isExclusionMarker", () => {
  it("يعرّف العلامتين المتعرفتين", () => {
    expect(isExclusionMarker(".ignore")).toBe(true);
    expect(isExclusionMarker(".nomedia")).toBe(true);
  });

  it("يطابق بحالة أحرف غير حساسة", () => {
    expect(isExclusionMarker(".IGNORE")).toBe(true);
    expect(isExclusionMarker(".NoMedia")).toBe(true);
  });

  it("يرفض الأسماء الأخرى والفارغ", () => {
    expect(isExclusionMarker("ignore")).toBe(false);
    expect(isExclusionMarker("media")).toBe(false);
    expect(isExclusionMarker("")).toBe(false);
  });
});

describe("DirectoryWalker — exclusion markers", () => {
  let roots: string[] = [];

  afterEach(async () => {
    for (const root of roots) {
      await fs.rm(root, { recursive: true, force: true });
    }
    roots = [];
  });

  /** ينشئ مجلد جذر مؤقتاً ويتتبع تنظيفه. */
  async function makeRoot(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lbm-walker-"));
    roots.push(dir);
    return dir;
  }

  /** ينشئ شجرة مجلدات تحت الجذر ويعيد مسار آخر مجلد. */
  async function mkdirTree(root: string, rel: string): Promise<string> {
    const p = path.join(root, rel);
    await fs.mkdir(p, { recursive: true });
    return p;
  }

  /** ينشئ ملفاً (بمجلداته الوسيطة) تحت الجذر ويعيد مساره. */
  async function writeFile(root: string, rel: string): Promise<string> {
    const p = path.join(root, rel);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, "x");
    return p;
  }

  it("يتجاهل مجلداً فرعياً يحوي .ignore ولا يزور محتواه", async () => {
    const root = await makeRoot();
    await mkdirTree(root, "normal-series/Season 1");
    await writeFile(root, "normal-series/Season 1/ep01.mp4");
    await mkdirTree(root, "ignored-series/Season 1");
    await writeFile(root, "ignored-series/Season 1/ep02.mp4");
    await writeFile(root, "ignored-series/.ignore");

    const { visited, result } = await walkCollect(root);

    expect(result.foldersExcluded).toBe(1);
    expect(result.excludedPaths).toContain(path.join(root, "ignored-series"));
    expect(result.foldersScanned).toBe(2);
    expect(result.filesScanned).toBe(1);
    expect(visited).toContain(path.join(root, "normal-series"));
    expect(visited).not.toContain(path.join(root, "ignored-series"));
    expect(visited).not.toContain(path.join(root, "ignored-series", "Season 1"));
    expect(visited).not.toContain(path.join(root, "ignored-series", "Season 1", "ep02.mp4"));
  });

  it("يتجاهل مجلدات تحوي .nomedia أو .NOMEDIA (حالة أحرف)", async () => {
    const root = await makeRoot();
    await mkdirTree(root, "a-series/Season 1");
    await writeFile(root, "a-series/Season 1/ep01.mp4");
    await writeFile(root, "nomedia-series/.nomedia");
    await mkdirTree(root, "nomedia-series/Season 1");
    await writeFile(root, "nomedia-series/Season 1/ep02.mp4");
    await writeFile(root, "upper-series/.NOMEDIA");
    await mkdirTree(root, "upper-series/Season 1");
    await writeFile(root, "upper-series/Season 1/ep03.mp4");

    const { visited, result } = await walkCollect(root);

    expect(result.foldersExcluded).toBe(2);
    expect(visited).not.toContain(path.join(root, "nomedia-series"));
    expect(visited).not.toContain(path.join(root, "upper-series"));
    expect(visited).not.toContain(path.join(root, "nomedia-series", "Season 1"));
    expect(visited).not.toContain(path.join(root, "upper-series", "Season 1"));
  });

  it("يتجاهل جذر مكتبة يحوي علامة استثناء بالكامل", async () => {
    const root = await makeRoot();
    await writeFile(root, ".ignore");
    await mkdirTree(root, "anything/Season 1");
    await writeFile(root, "anything/Season 1/ep01.mp4");

    const { visited, result } = await walkCollect(root);

    expect(result.foldersExcluded).toBe(1);
    expect(result.excludedPaths).toContain(root);
    expect(result.foldersScanned).toBe(0);
    expect(result.filesScanned).toBe(0);
    expect(visited).toHaveLength(0);
  });

  it("يمسح مجلداً عادياً دون علامات دون استثناءات", async () => {
    const root = await makeRoot();
    await mkdirTree(root, "series/Season 1");
    await writeFile(root, "series/Season 1/ep01.mp4");

    const { visited, result } = await walkCollect(root);

    expect(result.foldersExcluded).toBe(0);
    expect(result.excludedPaths).toHaveLength(0);
    expect(result.foldersScanned).toBe(2);
    expect(result.filesScanned).toBe(1);
    expect(visited).toHaveLength(3);
  });
});
