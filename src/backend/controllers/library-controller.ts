import { BaseController } from "./base-controller";
import type { LibraryService } from "../services/library-service";

export class LibraryController extends BaseController {
  constructor(private libraryService: LibraryService) {
    super();
  }

  async getAll() {
    try {
      const libraries = await this.libraryService.getAllActive();
      return this.ok(libraries);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getById(id: string) {
    try {
      const libraryId = this.parseId(id);
      const library = await this.libraryService.getLibraryById(libraryId);
      if (!library) return this.notFound("Library not found");
      return this.ok(library);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async create(data: Record<string, unknown>) {
    try {
      const library = await this.libraryService.createLibrary(data);
      return this.created(library, "Library created");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async update(id: string, data: Record<string, unknown>) {
    try {
      const libraryId = this.parseId(id);
      const library = await this.libraryService.updateLibrary(libraryId, data);
      return this.ok(library, "Library updated");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async delete(id: string) {
    try {
      const libraryId = this.parseId(id);
      await this.libraryService.deleteLibrary(libraryId);
      return this.ok(null, "Library deleted");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getGenres(id: string) {
    try {
      const libraryId = this.parseId(id);
      const genres = await this.libraryService.getLibraryGenres(libraryId);
      return this.ok(genres);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getAgeRatings(id: string) {
    try {
      const libraryId = this.parseId(id);
      const ratings = await this.libraryService.getLibraryAgeRatings(libraryId);
      return this.ok(ratings);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getStats(id: string) {
    try {
      const libraryId = this.parseId(id);
      const stats = await this.libraryService.getLibraryStats(libraryId);
      return this.ok(stats);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async refreshMediaCount(id: string) {
    try {
      const libraryId = this.parseId(id);
      await this.libraryService.refreshMediaCount(libraryId);
      return this.ok({ success: true }, "Media count refreshed");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getContainers() {
    try {
      const containers = await this.libraryService.getContainers();
      return this.ok(containers);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getByParentId(parentId: string) {
    try {
      const id = this.parseId(parentId);
      const libraries = await this.libraryService.getLibrariesByParentId(id);
      return this.ok(libraries);
    } catch (err) {
      return this.handleError(err);
    }
  }
}
