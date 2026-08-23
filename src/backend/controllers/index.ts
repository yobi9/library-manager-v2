import { getServices } from "../services";
import { AuthController } from "./auth-controller";
import { MediaController } from "./media-controller";
import { LibraryController } from "./library-controller";
import { UserController } from "./user-controller";
import { SettingsController } from "./settings-controller";
import { DashboardController } from "./dashboard-controller";
import { SearchController } from "./search-controller";
import { ProgressController } from "./progress-controller";
import { ReportController } from "./report-controller";
import { DatabaseController } from "./database-controller";
import { ImageController } from "./image-controller";
import { VisitorController } from "./visitor-controller";
import { EnrichmentController } from "./enrichment-controller";
import { TranslationController } from "./translation-controller";
import { NewsController } from "./news-controller";
import { MessagesController } from "./messages-controller";
import { ScanController } from "./scan-controller";
import { EventsController } from "./events-controller";
import { LiveStreamController } from "./live-stream-controller";
import { LicenseController } from "./license-controller";

/** نوع حاوية المتحكمات — وحيدة لكل عملية. */
interface Controllers {
  auth: AuthController;
  media: MediaController;
  library: LibraryController;
  user: UserController;
  settings: SettingsController;
  dashboard: DashboardController;
  search: SearchController;
  progress: ProgressController;
  report: ReportController;
  database: DatabaseController;
  image: ImageController;
  visitor: VisitorController;
  enrichment: EnrichmentController;
  translation: TranslationController;
  news: NewsController;
  messages: MessagesController;
  scan: ScanController;
  events: EventsController;
  liveStream: LiveStreamController;
  license: LicenseController;
}

/** مفتاح تخزين المتحكمات على `globalThis`. */
const CONTROLLERS_STATE_KEY = "__libraryManagerControllersState";

const globalControllersState = (globalThis as Record<string, unknown>)[CONTROLLERS_STATE_KEY] as
  Controllers | null | undefined;

let controllers: Controllers | null = globalControllersState ?? null;

/**
 * يُنشئ المتحكمات (مربوطة بالخدمات من `getServices()`) أو يسترجعها.
 *
 * تُحفظ على `globalThis` بدل حالة الوحدة (نفس سبب `getServices()`): إعادة تقييم
 * الوحدة في وضع التطوير كانت تُنشئ حاوية جديدة تعيد ضبط جداول جلسات الإثراء/
 * الترجمة في الذاكرة وتشغّل مؤقّتات تنظيف مكرّرة لكل إعادة ترجمة.
 *
 * @returns حاوية المتحكمات الوحيدة للعملية الحالية.
 */
export function getControllers() {
  if (controllers) return controllers;
  const s = getServices();
  controllers = {
    auth: new AuthController(s.auth),
    media: new MediaController(s.media, s.view),
    library: new LibraryController(s.library),
    user: new UserController(s.user),
    settings: new SettingsController(s.settings),
    dashboard: new DashboardController(s.dashboard),
    search: new SearchController(s.search),
    progress: new ProgressController(s.progress),
    report: new ReportController(s.report),
    database: new DatabaseController(s.database),
    image: new ImageController(s.image),
    visitor: new VisitorController(s.visitor),
    enrichment: new EnrichmentController(
      s.tmdbEnrichment,
      s.metadataService,
    ),
    translation: new TranslationController(s.translationService, s.translationCacheRepo, s.media),
    news: new NewsController(s.news),
    messages: new MessagesController(s.messages),
    scan: new ScanController(s.scanner, s.library, s.LibraryMonitor),
    events: new EventsController(s.activity, s.security),
    liveStream: new LiveStreamController(s.liveStream),
    license: new LicenseController(s.license),
  };
  (globalThis as Record<string, unknown>)[CONTROLLERS_STATE_KEY] = controllers;
  return controllers;
}

export { BaseController, type RequestContext, type ControllerResult } from "./base-controller";
export { AuthController } from "./auth-controller";
export { MediaController } from "./media-controller";
export { LibraryController } from "./library-controller";
export { UserController } from "./user-controller";
export { SettingsController } from "./settings-controller";
export { DashboardController } from "./dashboard-controller";
export { SearchController } from "./search-controller";
export { ProgressController } from "./progress-controller";
export { ReportController } from "./report-controller";
export { DatabaseController } from "./database-controller";
export { ImageController } from "./image-controller";
export { VisitorController } from "./visitor-controller";
export { EnrichmentController } from "./enrichment-controller";
export { TranslationController } from "./translation-controller";
export { NewsController } from "./news-controller";
export { MessagesController } from "./messages-controller";
export { EventsController } from "./events-controller";
export { LiveStreamController } from "./live-stream-controller";
export { LicenseController } from "./license-controller";
