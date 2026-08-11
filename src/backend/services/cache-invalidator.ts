import type { CacheService } from "./cache-service";
import type { ErrorHandler } from "./error-handler";
import type { EventBus } from "./event-bus";
import { CachePrefixes } from "./cache-prefixes";
import type { CachePrefix } from "./cache-prefixes";

/** All prefixes that depend on a single media row (update/delete/enrich). */
const MEDIA_INVALIDATION_PREFIXES: readonly CachePrefix[] = [
  CachePrefixes.media,
  CachePrefixes.mediaDetail,
  CachePrefixes.recommendations,
  CachePrefixes.catalog,
  CachePrefixes.search,
  CachePrefixes.dashboard,
];

/** Media prefixes + global counts, invalidated after a completed library scan. */
const SCAN_INVALIDATION_PREFIXES: readonly CachePrefix[] = [
  ...MEDIA_INVALIDATION_PREFIXES,
  CachePrefixes.database,
];

/**
 * Maps a domain event to the cache prefixes it invalidates.
 *
 * @internal
 */
interface EventToPrefixMapping {
  /** EventBus event name to listen for. */
  event: string;
  /** Cache prefixes to purge when the event fires. */
  prefixes: readonly CachePrefix[];
  /**
   * Optional guard evaluated with the raw event payload.
   * When provided, invalidation only runs if it returns `true`.
   */
  shouldInvalidate?: (data: unknown) => boolean;
}

/** Guard used for enrichment events: only successful runs mutate media rows. */
const isSuccessfulEnrichment = (data: unknown): boolean =>
  (data as { success?: boolean } | null | undefined)?.success !== false;

const EVENT_PREFIX_MAP: readonly EventToPrefixMapping[] = [
  {
    event: "settings_updated",
    prefixes: [CachePrefixes.settings],
  },
  {
    event: "media_updated",
    prefixes: MEDIA_INVALIDATION_PREFIXES,
  },
  {
    event: "media_deleted",
    prefixes: MEDIA_INVALIDATION_PREFIXES,
  },
  {
    event: "metadata_completed",
    prefixes: MEDIA_INVALIDATION_PREFIXES,
    shouldInvalidate: isSuccessfulEnrichment,
  },
  {
    event: "scan_completed",
    prefixes: SCAN_INVALIDATION_PREFIXES,
  },
  {
    event: "user_created",
    prefixes: [CachePrefixes.users],
  },
  {
    event: "user_updated",
    prefixes: [CachePrefixes.users],
  },
  {
    event: "user_deleted",
    prefixes: [CachePrefixes.users],
  },
];

/**
 * Subscribes to domain events and purges affected cache prefixes.
 *
 * @remarks
 * This is the write path of the cache lifecycle: services own reads (via
 * `CacheService.withCache`), and this class owns invalidation. It is wired once at
 * the composition root (`createServices`) and receives its dependencies through the
 * constructor (D11) — it never imports the service locator.
 *
 * Invalidation is intentionally event-driven and coarse-grained: a full prefix purge
 * on mutation is correct at this scale and far safer than precise per-key deletes
 * that can drift from the read keys.
 */
export class CacheInvalidator {
  private readonly unsubscribers: Array<() => void> = [];

  /**
   * Creates and activates the invalidator — subscribing happens in the constructor.
   *
   * @param eventBus - Global domain event bus to subscribe on.
   * @param cache - CacheService whose prefixes will be purged.
   * @param errorHandler - ErrorHandler used to report invalidation failures without
   * crashing the originating request flow.
   */
  constructor(
    private readonly eventBus: EventBus,
    private readonly cache: CacheService,
    private readonly errorHandler: ErrorHandler,
  ) {
    for (const mapping of EVENT_PREFIX_MAP) {
      this.unsubscribers.push(
        this.eventBus.on(mapping.event, (data?: unknown) => {
          if (mapping.shouldInvalidate && !mapping.shouldInvalidate(data)) return;
          void this.invalidate(mapping.prefixes, mapping.event);
        }),
      );
    }
  }

  /**
   * Purges every prefix mapped to a fired event.
   *
   * @param prefixes - Cache prefixes to delete.
   * @param sourceEvent - Event name that triggered the purge (for error context).
   */
  private async invalidate(prefixes: readonly CachePrefix[], sourceEvent: string): Promise<void> {
    try {
      await Promise.all(prefixes.map((prefix) => this.cache.deleteByPrefix(prefix)));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      await this.errorHandler.logError(error, {
        module: "CacheInvalidator",
        sourceEvent,
      });
    }
  }

  /**
   * Unsubscribes every event listener registered by this instance.
   *
   * @remarks
   * Intended for tests / hot-reload teardown. After disposal the instance is inert.
   */
  dispose(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers.length = 0;
  }
}
