import * as googleTranslateApi from "google-translate-api-x";

/** شكل دالة الترجمة الذي يخزّنه المزوّد (نصّ + خيارات) */
type TranslateFn = (text: string, opts: Record<string, unknown>) => Promise<{ text: string }>;

export class GoogleTranslateProvider {
  private _translateFn: TranslateFn | null = null;

  constructor() {
    this._load();
  }

  /**
   * يثبّت دالة الترجمة من الحزمة بشكل متزامن مع الحفاظ على منطق الـ fallback القديم
   * (يدعم أشكال الإخراج ESM و CJS على حد سواء).
   */
  private _load(): void {
    try {
      const mod = googleTranslateApi as unknown as {
        translate?: TranslateFn;
        default?: TranslateFn | { translate?: TranslateFn };
      };
      const defaultCtx = mod.default;
      const viaTranslate =
        mod.translate ??
        (typeof defaultCtx === "object" && defaultCtx !== null ? defaultCtx.translate : undefined);
      if (viaTranslate) {
        this._translateFn = viaTranslate;
        return;
      }
      const fallback = defaultCtx ?? (googleTranslateApi as unknown as TranslateFn);
      this._translateFn = typeof fallback === "function" ? fallback : null;
    } catch {
      // provider not available
    }
  }

  get isAvailable(): boolean {
    return this._translateFn !== null;
  }

  get name(): string {
    return "google-translate-api";
  }

  async translate(text: string, targetLang: string, signal?: AbortSignal): Promise<string> {
    if (!this._translateFn) throw new Error("Translation provider not available");
    const result = await this._translateFn(text, {
      to: targetLang,
      fetchOptions: signal ? { signal } : undefined,
    });
    return typeof result === "string" ? result : (result as { text: string }).text;
  }

  async translateBatch(texts: string[], targetLang: string, signal?: AbortSignal): Promise<(string | null)[]> {
    if (!this._translateFn) throw new Error("Translation provider not available");
    const combined = texts.join("\n");
    const result = await this._translateFn(combined, {
      to: targetLang,
      fetchOptions: signal ? { signal } : undefined,
    });
    const text = typeof result === "string" ? result : (result as { text: string }).text;
    const translatedLines = text.split("\n");
    return texts.map((_, idx) => translatedLines[idx] || null);
  }
}

export function createProvider(): GoogleTranslateProvider {
  return new GoogleTranslateProvider();
}
