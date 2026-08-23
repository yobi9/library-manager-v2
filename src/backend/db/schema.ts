// =====================================================
// Database Row Types — All 23 tables
// These represent the raw shape returned by SQLite queries.
// =====================================================

// ---- 1. users ----
export interface DbUser {
  user_id: number;
  username: string;
  password: string;
  display_name: string | null;
  is_admin: number;
  created_at: string;
  updated_at: string;
  last_active: string | null;
  created_by: number | null;
  is_blocked: number;
  email: string | null;
  full_name: string | null;
  date_of_birth: string | null;
  phone_number: string | null;
  about: string | null;
  facebook_url: string | null;
  twitter_url: string | null;
  instagram_url: string | null;
  whatsapp_url: string | null;
  telegram_url: string | null;
  youtube_url: string | null;
  progress: number;
  is_active: number;
  max_content_rating: string;
  can_enrich: number;
  avatar: string | null;
}

// ---- 2. user_sessions ----
export interface DbUserSession {
  id: number;
  user_id: number;
  os: string | null;
  ip_address: string | null;
  user_agent: string | null;
  last_active: string;
  expires_at: string | null;
  is_active: number;
  created_at: string;
}

// ---- 3. libraries ----
export interface DbLibrary {
  library_id: number;
  name: string;
  type: string;
  paths: string | null;
  media_count: number;
  image: string | null;
  parent_id: number | null;
  hide_section: number;
  is_container: number;
  is_watched: number;
  language: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  last_scanned: string | null;
  status: string;
  is_pinned: number;
  country: string | null;
  linked_library_id: number | null;
}

// ---- 4. media_items ----
export interface DbMediaItem {
  media_id: number;
  library_id: number | null;
  parent_media_id: number | null;
  tmdb_id: number | null;
  tvdb_id: number | null;
  imdb_id: string | null;
  title: string | null;
  original_title: string | null;
  tagline: string | null;
  year: number | null;
  type: string | null;
  imdb_rating: number | null;
  certification: string | null;
  country: string | null;
  release_date: string | null;
  runtime: number | null;
  metadata_status: string | null;
  metadata_source: string | null;
  metadata_version: number | null;
  last_metadata_sync: string | null;
  enriched: number;
  directory_path: string | null;
  logo_url: string | null;
  clearart_url: string | null;
  thumb_url: string | null;
  poster_path: string | null;
  backdrop_path: string | null;

  artwork_saved_to_folder: number;
  is_pinned: number;
  sort_order: number;
  hierarchical_level: number;
  is_leaf: number;
  has_children: number;
  is_available: number;
  unavailable_since: string | null;
  unavailable_reason: string | null;
  last_seen_path: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_accessed: string | null;
  access_count: number;
  last_scan_id: string | null;
  status: string | null;
  views: number;
  images_last_checked: string | null;
  pinned_at: string | null;
  trailer_url: string | null;
  seasons_count: number;
  episodes_count: number;
  producers: string | null;
  production_companies: string | null;
  production_countries: string | null;
  imdb_votes: number;
  deleted_at: string | null;
  normalized_title: string | null;
  identity_hash: string | null;
  origin_country: string | null;
  credits_last_sync: string | null;
  language: string | null;
  overview: string | null;
  enriched_poster: string | null;
  enriched_backdrop: string | null;
}

// ---- 5. media_files ----
export interface DbMediaFile {
  file_id: number;
  media_id: number;
  library_id: number;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  duration: number | null;
  last_accessed: string | null;
  access_count: number;
  is_available: number;
  last_scan_id: number | null;
  unavailable_since: string | null;
  unavailable_reason: string | null;
  last_seen_path: string | null;
  created_at: string;
  updated_at: string;
}

// ---- 6. media_genres ----
export interface DbMediaGenre {
  media_id: number;
  genre: string;
}

// ---- 7. media_people ----
export interface DbMediaPerson {
  id: number;
  media_id: number;
  person_id: number | null;
  name: string;
  role: string;
  character: string | null;
  department: string | null;
  profile_path: string | null;
  importance_order: number;
  created_at: string;
}

// ---- 8. media_search (FTS5 virtual table — no row type, queried via FTS5 syntax) ----

// ---- 9. library_snapshots ----
export interface DbLibrarySnapshot {
  snapshot_id: number;
  library_id: number;
  scan_id: string;
  operation: "start" | "complete" | "interrupted";
  media_count: number;
  duration_ms: number | null;
  accessible_paths: string | null;
  error_count: number;
  created_at: string;
  file_count: number;
  folder_count: number;
  total_size: number;
}

// ---- 10. settings ----
export interface DbSetting {
  key: string;
  value: string | null;
  category: string;
  data_type: string;
  description: string | null;
  is_secure: number;
  created_at: string;
  updated_at: string;
}

// ---- 11. settings_audit_log ----
export interface DbSettingsAuditLog {
  log_id: number;
  user_id: number | null;
  setting_key: string;
  old_value: string | null;
  new_value: string;
  reason: string | null;
  ip_address: string | null;
  changed_at: string;
}

// ---- 12. translation_cache ----
export interface DbTranslationCache {
  id: number;
  source_hash: string;
  source_text: string;
  target_lang: string;
  translated_text: string;
  created_at: string;
}

// ---- 13. activities ----
export interface DbActivity {
  id: number;
  action: string;
  module: string | null;
  status: number;
  user_id: number | null;
  ip_address: string | null;
  user_agent: string | null;
  details: string | null;
  duration_ms: number | null;
  created_at: string;
  device_id: string | null;
  severity: string;
  target_id: number | null;
  entity_type: string;
  actor_user_id: number | null;
}

// ---- 14. security_events ----
export interface DbSecurityEvent {
  event_id: number;
  user_id: number | null;
  event_type: string;
  severity: string;
  details: string | null;
  ip_address: string | null;
  user_agent: string | null;
  resolved: number;
  resolved_at: string | null;
  resolved_by: number | null;
  created_at: string;
}

// ---- 15. pending_enrichment_approvals ----
export interface DbPendingEnrichmentApproval {
  id: number;
  media_id: number;
  media_title: string;
  tmdb_id: number;
  tmdb_title: string;
  similarity_score: number;
  details_json: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// ---- 16. user_progress ----
export interface DbUserProgress {
  progress_id: number;
  user_id: number;
  media_id: number;
  last_position: number;
  is_finished: number;
  updated_at: string;
  created_at: string;
  progress_percent: number;
  device_id: string | null;
}

// ---- 17. media_reports ----
export interface DbMediaReport {
  report_id: number;
  report_type: "broken" | "abuse";
  media_id: number;
  media_title: string | null;
  media_type: string | null;
  library_id: number | null;
  library_name: string | null;
  library_type: string | null;
  stream_url: string | null;
  violation_type: string | null;
  description: string | null;
  device_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: "pending" | "resolved" | "dismissed";
  resolved_at: string | null;
  created_at: string;
}

// ---- 19. visitors ----
export interface DbVisitor {
  id: number;
  device_id: string | null;
  device_type: string | null;
  user_agent: string | null;
  ip_address: string | null;
  is_online: number;
  is_blocked: number;
  first_seen: string | null;
  last_seen: string | null;
  created_at: string;
}

// ---- 20. visitor_events ----
export interface DbVisitorEvent {
  id: number;
  visitor_id: number | null;
  event_type: "visit" | "request";
  session_id: string | null;
  bandwidth_used: number;
  message: string | null;
  reply: string | null;
  reply_created_at: string | null;
  status: string;
  user_id: string | null;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
}

// ---- 21. news ----
export interface DbNews {
  id: number;
  title: string;
  summary: string | null;
  content: string;
  image_url: string | null;
  author: string | null;
  is_published: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---- 22. messages ----
export interface DbMessage {
  id: number;
  user_id: number | null;
  title: string;
  body: string;
  type: "support" | "ticket" | "broadcast";
  status: "pending" | "read" | "resolved";
  created_at: string;
  updated_at: string;
}



// ---- 25. login_attempts ----
export interface DbLoginAttempt {
  username: string;
  attempt_count: number;
  locked_at: number;
  last_failed_at: number;
  updated_at: string;
}
