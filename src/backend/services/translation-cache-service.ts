import { TranslationCacheRepository } from "../repositories/translation-cache-repository";

export class TranslationCacheService {
  constructor(private cacheRepo: TranslationCacheRepository) {}

  async get(text: string, targetLang = "ar") {
    return this.cacheRepo.get(text, targetLang);
  }

  async set(text: string, targetLang: string, translation: string) {
    return this.cacheRepo.set(text, targetLang, translation);
  }

  async getBulk(texts: string[], targetLang = "ar") {
    return this.cacheRepo.getBulk(texts, targetLang);
  }

  async stats() {
    return this.cacheRepo.stats();
  }
}
