export type LibraryType =
  | "main"
  | "linked"
  | "movie"
  | "theater"
  | "series"
  | "series_anime"
  | "series_sports"
  | "series_deen"
  | "series_ramadan"
  | "series_tv"
  | "series_learn"
  | "series_kids"
  | "audio_deen"
  | "series_doc"
  | "music"
  | "singer"
  | "vidsSameFolder"
  | "appsSameFolder"
  | "audioSameFolder"
  | "imagesSameFolder"
  | "booksSameFolder"
  | "book"
  | "app"
  | "photo";

export const ROOT_TYPES = new Set<LibraryType>([
  "movie",
  "theater",
  "series",
  "series_anime",
  "series_sports",
  "series_deen",
  "series_doc",
  "series_ramadan",
  "series_tv",
  "series_learn",
  "series_kids",
  "audio_deen",
  "music",
  "singer",
  "book",
  "app",
  "main",
  "vidsSameFolder",
  "appsSameFolder",
  "audioSameFolder",
  "booksSameFolder",
]);

export type ScanStatus = "idle" | "scanning" | "paused" | "completed" | "failed" | "stopped";
export type ScanMode = "quick" | "deep";

export interface ScanStats {
  foldersScanned: number;
  foldersExcluded: number;
  mediaAdded: number;
  mediaUpdated: number;
  mediaSkipped: number;
  filesSkipped: number;
  errors: ScanError[];
}

export interface ScanError {
  type: "path" | "directory" | "file" | "hierarchy_creation" | "general";
  path?: string;
  item?: string;
  error: string;
  code?: string;
}

export interface ScanProgress {
  libraryId: number;
  libraryName: string;
  status: ScanStatus;
  currentActivity: string;
  currentRootFolder: string | null;
  currentRootType: string | null;
}

export interface ScanSnapshot {
  scanId: string;
  startTime: Date;
  endTime?: Date;
  libraryId: number;
  libraryName: string;
  stats: ScanStats;
}

export interface ScannerEventMap {
  "scan:started": { libraryId: number; libraryName: string; mode: ScanMode };
  "scan:completed": { libraryId: number; libraryName: string; stats: ScanStats; duration: number };
  "scan:failed": { libraryId: number; libraryName: string; error: string };
  "scan:paused": { libraryId: number; libraryName: string };
  "scan:resumed": { libraryId: number; libraryName: string };
  "scan:stopped": { libraryId: number; libraryName: string };
  "scan:error": { libraryId: number; error: string; path?: string; code?: string };
  "scan:item": {
    libraryId: number;
    libraryName: string;
    itemName: string;
    itemType: string;
    itemPath: string;
    isFile: boolean;
    isRootFolder: boolean;
  };
  "fs:event": { type: string; path: string; libraryId: number; timestamp: number };
  "fs:ready": { libraryId: number; paths: string[] };
  "fs:error": { libraryId: number; message: string; code?: string };
  "fs:stopped": { libraryId: number };
}

export interface WalkedItem {
  name: string;
  path: string;
  parentPath: string;
  depth: number;
  isFile: boolean;
  itemType: string | null;
  isRootFolder: boolean;
  parentMediaId: number | null;
}

export interface ScanOptions {
  deepScan?: boolean;
  forceRescan?: boolean;
  isChildScan?: boolean;
}

export interface WalkResult {
  foldersScanned: number;
  filesScanned: number;
  foldersSkipped: number;
  filesSkipped: number;
  foldersExcluded: number;
  excludedPaths: string[];
}

export interface SyncResult {
  mediaId: number;
  isNew: boolean;
  isUpdated: boolean;
}

export interface CleanupResult {
  deletedItems: number;
  deletedFiles: number;
  duration: number;
}

export interface LibraryRecord {
  library_id: number;
  name: string;
  type: LibraryType;
  paths: string | string[];
  is_container?: number | boolean;
  status?: string;
  parent_id?: number | null;
}

export interface MediaRecord {
  media_id: number;
  title: string;
  type: string;
  library_id: number;
  parent_media_id: number | null;
  directory_path: string | null;
  hierarchical_level: number;
  is_leaf: number;
  is_available: number;
  is_file: number;
  has_children: number;
  file_path: string | null;
  file_size: number | null;
  duration: number | null;
  mime_type: string | null;
  year: number | null;
  poster_path: string | null;
  backdrop_path: string | null;

  last_scan_id: string | null;
  unavailable_since: string | null;
  unavailable_reason: string | null;
  last_seen_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface HierarchyResult {
  allowed: boolean;
  type?: string | null;
  level?: number;
  leaf?: boolean;
  skip?: boolean;
  rule?: string;
  error?: string;
  violation?: Record<string, unknown>;
  timestamp: string;
}
