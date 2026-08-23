import { UserRepository } from "../repositories/user-repository";
import { UserSessionRepository } from "../repositories/session-repository";
import { LibraryRepository } from "../repositories/library-repository";
import { MediaRepository } from "../repositories/media-repository";
import { SearchRepository } from "../repositories/search-repository";
import { SettingsRepository } from "../repositories/settings-repository";
import { ActivityRepository } from "../repositories/activity-repository";
import { SecurityEventRepository } from "../repositories/security-repository";
import { LoginAttemptRepository } from "../repositories/login-attempt-repository";
import { ProgressRepository } from "../repositories/progress-repository";
import { ReportRepository } from "../repositories/report-repository";
import { VisitorRepository } from "../repositories/visitor-repository";
import { DashboardRepository } from "../repositories/dashboard-repository";
import { NewsRepository } from "../repositories/news-repository";
import { MessagesRepository } from "../repositories/messages-repository";
import { TranslationCacheRepository } from "../repositories/translation-cache-repository";
import { ImageRepository } from "../repositories/image-repository";
import { EnrichmentMediaRepository } from "../repositories/enrichment-media-repository";
import { EnrichmentApprovalRepository } from "../repositories/enrichment-repository";
import { SnapshotRepository } from "../repositories/snapshot-repository";

import { AuthService } from "./auth-service";
import { UserService } from "./user-service";
import { LibraryService } from "./library-service";
import { MediaService } from "./media-service";
import { SearchService } from "./search-service";
import { SettingsService } from "./settings-service";
import { ActivityService } from "./activity-service";
import { SecurityService } from "./security-service";
import { VisitorService } from "./visitor-service";
import { ViewerAccessService } from "./viewer-access-service";
import { ProgressService } from "./progress-service";
import { ReportService } from "./report-service";
import { DashboardService } from "./dashboard-service";
import { TranslationCacheService } from "./translation-cache-service";
import { TranslationService } from "./translation-service";
import { DatabaseService } from "./database-service";
import { ImageService } from "./image-service";
import { NewsService } from "./news-service";
import { MessagesService } from "./messages-service";
import { EventBus, getEventBus } from "./event-bus";
import { getDatabase, runInWriterContext } from "../db/db";
import { CacheService, getCacheService } from "./cache-service";
import { CacheInvalidator } from "./cache-invalidator";
import { RetryManager, getRetryManager } from "./retry-manager";
import { ErrorHandler, getErrorHandler } from "./error-handler";
import { TmdbEnrichmentService } from "./tmdb-enrichment-service";
import { MetadataService } from "./metadata-service";
import { ScanOrchestrator } from "../scanner/scan-orchestrator";
import { LibraryMonitor } from "../scanner/LibraryMonitor";
import { trackBackgroundJob } from "../observability/operations";
import { logger } from "../observability/logger";
import { ViewTrackerService } from "./view-tracker";
import { ViewEventPublisher } from "./view-publisher";
import { ViewService } from "./view-service";
import { AutoBackupScheduler } from "./auto-backup-scheduler";
import { RetentionScheduler } from "./retention-scheduler";
import { LiveStreamService } from "./live-stream-service";
import { LicenseService } from "./license-service";

/** مفتاح تخزين حالة الخدمات على `globalThis`. */
const SERVICES_STATE_KEY = "__libraryManagerServicesState";

const globalServicesState = (globalThis as Record<string, unknown>)[SERVICES_STATE_KEY] as
  ReturnType<typeof createServices> | null | undefined;

let _services: ReturnType<typeof createServices> | null = globalServicesState ?? null;

/**
 * إنشاء/استرجاع حالة الخدمات المشتركة.
 *
 * تُحفظ على `globalThis` بدل حالة الوحدة لأن Turbopack (وضع التطوير) يعيد
 * تقييم الوحدة عند كل إعادة ترجمة (نفس السبب الموثّق في `db.ts`). لو بقيت
 * الحالة على مستوى الوحدة لاستُدعيت `createServices()` مرة لكل إعادة تقييم
 * فتتضاعف المجدوِلات ومؤقّتات الخلفية (`RetentionScheduler` كل 5 دقائق + 24
 * ساعة، `AutoBackupScheduler`، مؤقّتات `AuthService` و`CacheService` وخدمة
 * الإثراء) وتبدأ كلها بالعمل معاً في دفعات — مصدر تكرار
 * `background_job.started ... jobName=retentionCleanup` في السجلات.
 *
 * @remarks
 * أثر جانبي مقصود: تغييرات كود الخدمات في وضع التطوير لن تُطبَّق قبل إعادة
 * تشغيل الخادم كاملة (سلوك مقبول سلفاً لطبقة قاعدة البيانات في هذا المشروع).
 *
 * @returns كائن الخدمات الوحيد للعملية الحالية.
 */
export function getServices() {
  if (!_services) {
    _services = createServices();
    (globalThis as Record<string, unknown>)[SERVICES_STATE_KEY] = _services;
  }
  return _services;
}

function createServices() {
  const userRepo = new UserRepository();
  const sessionRepo = new UserSessionRepository();
  const libraryRepo = new LibraryRepository();
  const mediaRepo = new MediaRepository();
  const searchRepo = new SearchRepository();
  const settingsRepo = new SettingsRepository();
  const activityRepo = new ActivityRepository();
  const securityRepo = new SecurityEventRepository();
  const loginAttemptRepo = new LoginAttemptRepository();
  const progressRepo = new ProgressRepository();
  const reportRepo = new ReportRepository();
  const visitorRepo = new VisitorRepository();
  const dashboardRepo = new DashboardRepository();
  const translationCacheRepo = new TranslationCacheRepository();
  const imageRepo = new ImageRepository();
  const enrichmentMediaRepo = new EnrichmentMediaRepository();
  const enrichmentApprovalRepo = new EnrichmentApprovalRepository();
  const newsRepo = new NewsRepository();
  const messagesRepo = new MessagesRepository();

  const eventBus = getEventBus();
  const cacheService = getCacheService(activityRepo);
  const errorHandler = getErrorHandler();
  const retryManager = getRetryManager();
  const cacheInvalidator = new CacheInvalidator(eventBus, cacheService, errorHandler);

  // حالة المسح النشط: الوظائف الخلفية (تنظيف محاولات الدخول، تنظيف الاحتفاظ)
  // تتخطى عملها أثناء مسح نشط لتجنب التنافس مع كاتب الماسح على قفل كتابة WAL
  // (مصدر `SQLITE_BUSY`). يُربط كائن الحالة بالـ `scanner` بعد إنشائه أدناه.
  const scanActivity = { isActive: (): boolean => false };

  const authService = new AuthService(
    userRepo,
    sessionRepo,
    activityRepo,
    securityRepo,
    loginAttemptRepo,
    () => scanActivity.isActive(),
  );
  const userService = new UserService(userRepo, sessionRepo, activityRepo, securityRepo);
  const libraryService = new LibraryService(libraryRepo, mediaRepo, activityRepo);
  const settingsService = new SettingsService(settingsRepo, cacheService);
  const mediaService = new MediaService(
    mediaRepo,
    libraryRepo,
    cacheService,
    settingsService,
    activityRepo,
    searchRepo,
  );
  const searchService = new SearchService(searchRepo, cacheService, settingsService, () => scanActivity.isActive());
  const activityService = new ActivityService(activityRepo);
  const securityService = new SecurityService(securityRepo);
  const visitorService = new VisitorService(visitorRepo, activityRepo);
  const viewerAccessService = new ViewerAccessService(
    settingsService,
    authService,
    visitorService,
  );
  const progressService = new ProgressService(progressRepo);
  const reportService = new ReportService(reportRepo, activityRepo);
  const dashboardService = new DashboardService(
    dashboardRepo,
    visitorRepo,
    activityRepo,
    cacheService,
  );
  const translationCacheService = new TranslationCacheService(translationCacheRepo);
  const databaseService = new DatabaseService(activityRepo, cacheService, () =>
    scanActivity.isActive(),
  );
  const imageService = new ImageService(imageRepo, settingsService);
  const newsService = new NewsService(newsRepo, activityRepo);
  const messagesService = new MessagesService(messagesRepo, activityRepo);
  const translationService = new TranslationService(mediaRepo, translationCacheRepo, activityRepo);
  const tmdbEnrichmentService = new TmdbEnrichmentService(
    enrichmentMediaRepo,
    mediaRepo,
    libraryRepo,
    enrichmentApprovalRepo,
    searchRepo,
    "",
    {},
    activityRepo,
    settingsService,
    () => scanActivity.isActive(),
  );
  const metadataService = new MetadataService(
    mediaRepo,
    enrichmentMediaRepo,
    searchRepo,
    activityRepo,
  );
  // تحميل مفتاح TMDB المحفوظ في الإعدادات عند بدء الخدمة (J4) — بدونه يفقد
  // المفتاح بعد إعادة تشغيل الخادم لأنه كان يُضبط في الذاكرة فقط. يُشغَّل
  // كخلفية فلا يحجب اكتمال تهيئة باقي الخدمات.
  void tmdbEnrichmentService.loadApiKeyFromSettings().catch((err: Error) => {
    void errorHandler.logError(err, { module: "EnrichmentApiKey" });
  });
  const snapshotRepo = new SnapshotRepository();
  const scanner = new ScanOrchestrator(
    mediaRepo,
    libraryRepo,
    snapshotRepo,
    {
      maxDepth: 8,
      batchDelayMs: 0,
      enableFileScan: true,
      batchSize: 50, // ← was 200
      strictHierarchy: false,
    },
    undefined,
    undefined,
    settingsService,
  );
  scanActivity.isActive = () => scanner.isScanning();
  const libraryMonitor = new LibraryMonitor(libraryRepo);

  // تسجيل دورة المسح في سجل الأحداث (النظام) حتى تظهر أحداث المسح في صفحة
  // الأحداث — دون حجب تدفق البث الذي يغذي الماسح في الواجهة.
  const logScanActivity =
    (action: string, severity = "info") =>
    (data: unknown) => {
      void activityRepo
        .logActivity({ entityType: "system", action, module: "scanner", severity, details: data })
        .catch((err: Error) => {
          console.error(`[Events] Failed to log ${action}:`, err.message);
        });
    };

  scanner.on("scan:started", (data) => {
    eventBus.emit("scan_started", data);
    logScanActivity("scan_started")(data);
  });
  scanner.on("scan:completed", (data) => {
    eventBus.emit("scan_completed", data);
    logScanActivity("scan_completed", "success")(data);
  });
  scanner.on("scan:failed", (data) => {
    eventBus.emit("scan_failed", data);
    logScanActivity("scan_failed", "error")(data);
  });
  scanner.on("scan:paused", (data) => {
    eventBus.emit("scan_paused", data);
    logScanActivity("scan_paused")(data);
  });
  scanner.on("scan:resumed", (data) => {
    eventBus.emit("scan_resumed", data);
    logScanActivity("scan_resumed")(data);
  });
  scanner.on("scan:stopped", (data) => {
    eventBus.emit("scan_stopped", data);
    logScanActivity("scan_stopped")(data);
  });
  scanner.on("scan:error", (data) => eventBus.emit("scan_error", data));
  scanner.on("scan:item", (data) => eventBus.emit("scan_item", data));

  // بعد كل مسح ناجح: املأ صفوف FTS5 الناقصة/بلا مفتاح صوتي حتى تكون العناصر
  // الجديدة قابلة للبحث صوتياً دون إعادة بناء كاملة للفهرس. يُشغَّل ضمن سياق
  // اتصال الكتابة حتى لا يكتب على اتصال القراءة فيتنازع مع كاتب الماسح.
  eventBus.on("scan_completed", () => {
    void runInWriterContext(async () => {
      // الوظيفة الخلفية تُسجَّل في شجرة العمليات (`background_job`) بنوع
      // `fts_backfill` حتى يظهر تداخلها الزمني مع المسح في تقرير الاختناقات.
      const jobId = `backfill_${Date.now().toString(36)}`;
      try {
        await trackBackgroundJob(
          "background_job",
          "backfillSearchIndex",
          () => searchService.backfillSearchIndex(),
          { id: jobId, component: "SearchBackfill" },
        );
        // الـ FTS backfill كتب بشكل مكثف على اتصال الكاتب (writer) المعطَّل
        // `wal_autocheckpoint` لديه، فينمو WAL أكثر بعد checkpoint نهاية المسح.
        // checkpoint سلمي هنا يضمّه ويمنع تراكمه حتى المسح التالي. `getDatabase()`
        // داخل هذا السياق يُرجع اتصال الكاتب (AsyncLocalStorage).
        await (await getDatabase()).run("PRAGMA wal_checkpoint(PASSIVE);");
      } catch (err) {
        if (err instanceof Error) {
          await errorHandler.logError(err, { module: "SearchBackfill" });
        }
      }
    }).catch((err: Error) => {
      void errorHandler.logError(err, { module: "SearchBackfill" });
    });
  });

  const viewTracker = new ViewTrackerService();
  const viewEventPublisher = new ViewEventPublisher(activityRepo, eventBus, mediaRepo);
  const viewService = new ViewService(viewTracker, viewEventPublisher);

  const autoBackupScheduler = new AutoBackupScheduler(databaseService, settingsService, () =>
    scanActivity.isActive(),
  );
  void autoBackupScheduler.start().catch((err) => {
    logger.error("autobackup.start_failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  });

  const retentionScheduler = new RetentionScheduler(
    activityService,
    securityService,
    visitorService,
    settingsService,
    snapshotRepo,
    () => scanner.isScanning(),
  );
  retentionScheduler.start();

  const liveStreamService = new LiveStreamService();
  const licenseService = new LicenseService(activityRepo);

  return {
    auth: authService,
    user: userService,
    library: libraryService,
    media: mediaService,
    search: searchService,
    settings: settingsService,
    activity: activityService,
    security: securityService,
    visitor: visitorService,
    viewerAccess: viewerAccessService,
    progress: progressService,
    report: reportService,
    dashboard: dashboardService,
    translationCache: translationCacheService,
    translationCacheRepo,
    translationService,
    database: databaseService,
    image: imageService,
    news: newsService,
    messages: messagesService,
    enrichmentMediaRepo,
    enrichmentApproval: enrichmentApprovalRepo,
    tmdbEnrichment: tmdbEnrichmentService,
    metadataService,
    scanner,
    LibraryMonitor: libraryMonitor,
    viewTracker,
    viewEventPublisher,
    view: viewService,
    eventBus,
    cache: cacheService,
    cacheInvalidator,
    retryManager,
    errorHandler,
    autoBackupScheduler,
    retentionScheduler,
    liveStream: liveStreamService,
    license: licenseService,
  };
}

export type Services = ReturnType<typeof getServices>;
