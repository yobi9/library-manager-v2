import type { ScanStatus, ScanStats, ScanMode } from "./scanner-events";

export class ScanState {
  readonly libraryId: number;
  readonly libraryName: string;
  readonly libraryType: string;
  readonly scanId: string;
  readonly startTime: Date;
  readonly mode: ScanMode;

  endTime?: Date;
  status: ScanStatus = "idle";
  currentActivity = "Idle";
  currentRootFolder: string | null = null;
  currentRootType: string | null = null;
  currentRootPath: string | null = null;
  scannedPaths: string[] = [];

  stats: ScanStats = {
    foldersScanned: 0,
    foldersExcluded: 0,
    mediaAdded: 0,
    mediaUpdated: 0,
    mediaSkipped: 0,
    filesSkipped: 0,
    errors: [],
  };

  constructor(libraryId: number, libraryName: string, libraryType: string, mode: ScanMode) {
    this.libraryId = libraryId;
    this.libraryName = libraryName;
    this.libraryType = libraryType;
    this.scanId = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    this.startTime = new Date();
    this.mode = mode;
  }

  setScanning() {
    this.status = "scanning";
    this.currentActivity = "Scanning...";
  }
  setPaused() {
    this.status = "paused";
    this.currentActivity = "Paused";
  }
  setResumed() {
    this.status = "scanning";
    this.currentActivity = "Scanning...";
  }
  setStopped() {
    this.status = "stopped";
    this.currentActivity = "Stopped";
    this.endTime = new Date();
  }
  setFailed() {
    this.status = "failed";
    this.currentActivity = "Failed";
    this.endTime = new Date();
  }
  setCompleted() {
    this.status = "completed";
    this.currentActivity = "Completed";
    this.endTime = new Date();
  }

  get duration(): number {
    return (this.endTime?.getTime() ?? Date.now()) - this.startTime.getTime();
  }

  addError(error: ScanStats["errors"][number]) {
    this.stats.errors.push(error);
  }

  toProgress() {
    return {
      libraryId: this.libraryId,
      libraryName: this.libraryName,
      status: this.status,
      currentActivity: this.currentActivity,
      currentRootFolder: this.currentRootFolder,
      currentRootType: this.currentRootType,
    };
  }

  toSnapshot() {
    return {
      scanId: this.scanId,
      startTime: this.startTime,
      endTime: this.endTime,
      libraryId: this.libraryId,
      libraryName: this.libraryName,
      stats: { ...this.stats },
    };
  }
}
