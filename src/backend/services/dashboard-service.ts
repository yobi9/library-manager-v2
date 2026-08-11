import { DashboardRepository } from "../repositories/dashboard-repository";
import { VisitorRepository } from "../repositories/visitor-repository";
import { ActivityRepository } from "../repositories/activity-repository";
import { CacheService } from "./cache-service";
import { CachePrefixes } from "./cache-prefixes";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes > 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

/**
 * عمر الكاش بالثواني لقراءات لوحة التحكم المجمّعة (Phase 3).
 *
 * @remarks القيمة `60` تحقق توازناً بين تخفيف استعلامات التجميع الثقيلة على
 *          SQLite وبين طزاجة مقبولة للوحة إدارية تُعرض للأدمن. يُبطَل الكاش
 *          فوراً عند تغيّر المحتوى عبر `CacheInvalidator` (أحداث `scan_completed`
 *          وتعديل/حذف/إثراء العناصر) — لذلك الـ TTL شبكة أمان وليس مصدر طزاجة.
 */
const DASHBOARD_CACHE_TTL_SECONDS = 60;

export class DashboardService {
  constructor(
    private dashboardRepo: DashboardRepository,
    private visitorRepo: VisitorRepository,
    private activityRepo: ActivityRepository,
    private cache: CacheService,
  ) {}

  /**
   * الإحصاءات الرئيسية للوحة التحكم (عدد الوسائط، التخزين، المشاهدات،
   * المستخدمون، البث المباشر، إحصاءات الوسائط والأقسام).
   *
   * @remarks قراءة ثقيلة (6 استعلامات تجميع) — تُخزَّن مؤقتاً بدالة `withCache`
   *          لتفادي تكرارها عند كل استفتاء للوحة التحكم.
   */
  async getDashboardStats() {
    return this.cache.withCache(
      CachePrefixes.dashboard,
      { type: "dashboard-stats" },
      async () => {
        const [totalMedia, totalStorage, totalViews, totalUsers, activeStreams, generalStats] =
          await Promise.all([
            this.dashboardRepo.countAvailableMedia(),
            this.dashboardRepo.getTotalStorageUsedBytes(),
            this.dashboardRepo.getTotalViewSum(),
            this.dashboardRepo.countUsers(),
            this.visitorRepo.getOnlineCount(),
            this.dashboardRepo.getGeneralStats(),
          ]);

        return {
          totalMedia,
          totalStorage,
          totalStorageFormatted: formatBytes(totalStorage),
          totalViews,
          totalUsers,
          activeStreams,
          mediaStats: generalStats.mediaStats,
          sectionsCount: generalStats.sectionsCount,
        };
      },
      DASHBOARD_CACHE_TTL_SECONDS,
    );
  }

  async getDailyViews(days: number) {
    return this.cache.withCache(
      CachePrefixes.dashboard,
      { type: "daily-views", days },
      () => this.dashboardRepo.getDailyViewsFromActivities(days),
      DASHBOARD_CACHE_TTL_SECONDS,
    );
  }

  async getMostWatchedLibraries(limit: number) {
    return this.cache.withCache(
      CachePrefixes.dashboard,
      { type: "most-watched-libraries", limit },
      () => this.dashboardRepo.getMostWatchedLibraries(limit),
      DASHBOARD_CACHE_TTL_SECONDS,
    );
  }

  async getLeastWatchedLibraries(limit: number) {
    return this.cache.withCache(
      CachePrefixes.dashboard,
      { type: "least-watched-libraries", limit },
      () => this.dashboardRepo.getLeastWatchedLibraries(limit),
      DASHBOARD_CACHE_TTL_SECONDS,
    );
  }

  async getMostWatchedItems(limit: number) {
    return this.cache.withCache(
      CachePrefixes.dashboard,
      { type: "most-watched-items", limit },
      () => this.dashboardRepo.getMostWatchedItems(limit),
      DASHBOARD_CACHE_TTL_SECONDS,
    );
  }

  async getLeastWatchedItems(limit: number) {
    return this.cache.withCache(
      CachePrefixes.dashboard,
      { type: "least-watched-items", limit },
      () => this.dashboardRepo.getLeastWatchedItems(limit),
      DASHBOARD_CACHE_TTL_SECONDS,
    );
  }

  async getOldUnwatched(daysOld: number, limit: number, onlyAvailable: boolean) {
    return this.cache.withCache(
      CachePrefixes.dashboard,
      { type: "old-unwatched", daysOld, limit, onlyAvailable },
      () => this.dashboardRepo.getOldUnwatchedItems(daysOld, limit, onlyAvailable),
      DASHBOARD_CACHE_TTL_SECONDS,
    );
  }

  /**
   * بيانات شبه لحظية (متصلون حالياً، توزيع الأجهزة) — لا تُخزَّن مؤقتاً
   * لأنها تُستفتى بشكل متكرر وتفقد قيمتها إن تأخرت.
   */
  async getLiveData() {
    const [totalStorage, onlineVisitors, deviceBreakdown, totalViews] = await Promise.all([
      this.dashboardRepo.getTotalStorageUsedBytes(),
      this.visitorRepo.getOnlineCount(),
      this.visitorRepo.getDeviceBreakdown(),
      this.dashboardRepo.getTotalViewSum(),
    ]);

    return {
      storageGB: (totalStorage / 1073741824).toFixed(2),
      storageFormatted: formatBytes(totalStorage),
      onlineVisitors,
      deviceBreakdown,
      totalViews,
    };
  }

  async getSummary() {
    return this.cache.withCache(
      CachePrefixes.dashboard,
      { type: "summary" },
      async () => {
        const [totalMedia, totalStorage, totalViews] = await Promise.all([
          this.dashboardRepo.countAvailableMedia(),
          this.dashboardRepo.getTotalStorageUsedBytes(),
          this.dashboardRepo.getTotalViewSum(),
        ]);

        return {
          totalMedia,
          totalStorage: formatBytes(totalStorage),
          totalViews,
        };
      },
      DASHBOARD_CACHE_TTL_SECONDS,
    );
  }

  /**
   * آخر الأنشطة (سجل متغير باستمرار) — لا يُخزَّن مؤقتاً.
   */
  async getRecentActivities(limit = 10) {
    return this.activityRepo.getRecentActivities(limit);
  }

  async getGeneralStats() {
    return this.cache.withCache(
      CachePrefixes.dashboard,
      { type: "general-stats" },
      () => this.dashboardRepo.getGeneralStats(),
      DASHBOARD_CACHE_TTL_SECONDS,
    );
  }
}
