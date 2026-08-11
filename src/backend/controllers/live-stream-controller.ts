import { BaseController } from "./base-controller";
import type { LiveStreamService } from "../services/live-stream-service";

/**
 * Handles requests for the live-stream viewer page. It proxies the external
 * live-stream system's channel list through the server so the browser never
 * talks to the foreign origin directly.
 */
export class LiveStreamController extends BaseController {
  constructor(private liveStreamService: LiveStreamService) {
    super();
  }

  /**
   * Returns the normalized channel list for the viewer page.
   *
   * @returns `ok(channels)` on success, or the mapped error on failure.
   */
  async getChannels() {
    try {
      const channels = await this.liveStreamService.fetchChannels();
      return this.ok(channels);
    } catch (err) {
      return this.handleError(err);
    }
  }
}
