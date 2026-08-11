-- =====================================================
-- Library Manager V2 — Consolidated Database Schema
-- Based on library-manager77 migrations 001-020
-- Final state: 23 tables + FTS5 + triggers + indexes
-- =====================================================

PRAGMA foreign_keys = OFF;

-- =====================================================
-- 1. users
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  display_name TEXT,
  is_admin INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active DATETIME,
  created_by INTEGER,
  is_blocked INTEGER DEFAULT 0,
  email TEXT,
  full_name TEXT,
  date_of_birth TEXT,
  phone_number TEXT,
  about TEXT,
  facebook_url TEXT,
  twitter_url TEXT,
  instagram_url TEXT,
  whatsapp_url TEXT,
  telegram_url TEXT,
  youtube_url TEXT,
  progress INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 0,
  max_content_rating VARCHAR(20) DEFAULT 'R',
  can_enrich INTEGER DEFAULT 0,
  avatar TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active);

-- =====================================================
-- 2. user_sessions
-- =====================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  os TEXT,
  ip_address TEXT,
  user_agent TEXT,
  last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active_expires ON user_sessions(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_ip ON user_sessions(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, is_active);

-- =====================================================
-- 3. libraries
-- =====================================================
CREATE TABLE IF NOT EXISTS libraries (
  library_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  paths TEXT,
  media_count INTEGER DEFAULT 0,
  image TEXT,
  parent_id INTEGER,
  hide_section INTEGER DEFAULT 0,
  is_container INTEGER DEFAULT 0,
  is_watched INTEGER DEFAULT 0,
  language TEXT,
  created_at TEXT,
  updated_at TEXT,
  created_by TEXT,
  last_scanned TEXT,
  status TEXT DEFAULT 'active',
  is_pinned INTEGER DEFAULT 0,
  country TEXT,
  FOREIGN KEY (parent_id) REFERENCES libraries(library_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_libraries_name ON libraries(name);
CREATE INDEX IF NOT EXISTS idx_libraries_type ON libraries(type);
CREATE INDEX IF NOT EXISTS idx_libraries_parent_id ON libraries(parent_id);
CREATE INDEX IF NOT EXISTS idx_libraries_created_at ON libraries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_libraries_updated ON libraries(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_libraries_container_parent ON libraries(is_container, parent_id);
CREATE INDEX IF NOT EXISTS idx_libraries_container_status ON libraries(is_container, hide_section);
CREATE UNIQUE INDEX IF NOT EXISTS idx_libraries_paths_smart ON libraries(paths) WHERE paths IS NOT NULL AND paths != '' AND paths != '[]';

-- =====================================================
-- 4. media_items (rebuilt in 016, altered in 019)
-- =====================================================
CREATE TABLE IF NOT EXISTS media_items (
  media_id INTEGER PRIMARY KEY AUTOINCREMENT,
  library_id INTEGER,
  parent_media_id INTEGER,
  tmdb_id INTEGER,
  tvdb_id INTEGER,
  imdb_id TEXT,
  title TEXT,
  original_title TEXT,
  tagline TEXT,
  year INTEGER,
  type TEXT,
  imdb_rating REAL,
  certification TEXT,
  country TEXT,
  release_date TEXT,
  runtime INTEGER,
  metadata_status TEXT,
  metadata_source TEXT,
  metadata_version INTEGER,
  last_metadata_sync TEXT,
  enriched INTEGER DEFAULT 0,
  directory_path TEXT,
  logo_url TEXT,
  clearart_url TEXT,
  thumb_url TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
 enriched_poster TEXT,
  enriched_backdrop TEXT,
  artwork_saved_to_folder INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  hierarchical_level INTEGER DEFAULT 0,
  is_leaf INTEGER DEFAULT 0,
  has_children INTEGER DEFAULT 0,
  is_available INTEGER DEFAULT 1,
  unavailable_since TEXT,
  unavailable_reason TEXT,
  last_seen_path TEXT,
  created_at TEXT,
  updated_at TEXT,
  last_accessed TEXT,
  access_count INTEGER DEFAULT 0,
  last_scan_id TEXT,
  status TEXT,
  views INTEGER DEFAULT 0,
  images_last_checked TEXT,
  pinned_at TEXT,
  trailer_url TEXT,
  seasons_count INTEGER DEFAULT 0,
  episodes_count INTEGER DEFAULT 0,
  producers TEXT,
  production_companies TEXT,
  production_countries TEXT,
  imdb_votes INTEGER DEFAULT 0,
  deleted_at TEXT,
  normalized_title TEXT,
  identity_hash TEXT,
  origin_country TEXT,
  credits_last_sync TEXT,
  language TEXT,
  overview TEXT,
 
  FOREIGN KEY (library_id) REFERENCES libraries(library_id),
  FOREIGN KEY (parent_media_id) REFERENCES media_items(media_id)
);

CREATE INDEX IF NOT EXISTS idx_media_items_library ON media_items(library_id);
CREATE INDEX IF NOT EXISTS idx_media_items_type ON media_items(type);
CREATE INDEX IF NOT EXISTS idx_media_items_year ON media_items(year);
CREATE INDEX IF NOT EXISTS idx_media_items_tmdb ON media_items(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_media_items_parent ON media_items(parent_media_id);
CREATE INDEX IF NOT EXISTS idx_media_items_directory ON media_items(directory_path);
CREATE INDEX IF NOT EXISTS idx_media_items_enriched ON media_items(enriched);
CREATE INDEX IF NOT EXISTS idx_media_items_is_available ON media_items(is_available);
CREATE INDEX IF NOT EXISTS idx_media_items_metadata_status ON media_items(metadata_status);
CREATE INDEX IF NOT EXISTS idx_media_parent_avail ON media_items(parent_media_id, is_available);
CREATE INDEX IF NOT EXISTS idx_media_dedup ON media_items(library_id, type, normalized_title, parent_media_id);
CREATE INDEX IF NOT EXISTS idx_media_items_library_id ON media_items(library_id, is_available);
CREATE INDEX IF NOT EXISTS idx_media_items_lib_created ON media_items(library_id, created_at DESC);

-- =====================================================
-- 5. media_files
-- =====================================================
CREATE TABLE IF NOT EXISTS media_files (
  file_id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id INTEGER NOT NULL,
  library_id INTEGER NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  file_size INTEGER,
  mime_type TEXT,
  duration INTEGER,
  last_accessed DATETIME,
  access_count INTEGER DEFAULT 0,
  is_available INTEGER DEFAULT 1,
  last_scan_id INTEGER,
  unavailable_since DATETIME,
  unavailable_reason TEXT,
  last_seen_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (media_id) REFERENCES media_items(media_id) ON DELETE CASCADE,
  FOREIGN KEY (library_id) REFERENCES libraries(library_id)
);

CREATE INDEX IF NOT EXISTS idx_media_files_media_id ON media_files(media_id);
CREATE INDEX IF NOT EXISTS idx_media_files_library ON media_files(library_id);
CREATE INDEX IF NOT EXISTS idx_media_files_path ON media_files(file_path);
CREATE INDEX IF NOT EXISTS idx_media_files_library_path ON media_files(library_id, file_path);

-- =====================================================
-- 6. media_genres
-- =====================================================
CREATE TABLE IF NOT EXISTS media_genres (
  media_id INTEGER NOT NULL,
  genre TEXT NOT NULL,
  PRIMARY KEY (media_id, genre),
  FOREIGN KEY (media_id) REFERENCES media_items(media_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_media_genres_genre ON media_genres(genre);
CREATE INDEX IF NOT EXISTS idx_media_genres_media_id ON media_genres(media_id);

-- =====================================================
-- 7. media_people (rebuilt in 016)
-- =====================================================
CREATE TABLE IF NOT EXISTS media_people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id INTEGER NOT NULL,
  person_id INTEGER,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  character TEXT,
  department TEXT,
  profile_path TEXT,
  importance_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(media_id, person_id, role),
  FOREIGN KEY (media_id) REFERENCES media_items(media_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_media_people_media ON media_people(media_id);
CREATE INDEX IF NOT EXISTS idx_media_people_person ON media_people(person_id);
CREATE INDEX IF NOT EXISTS idx_media_people_role ON media_people(role);
CREATE INDEX IF NOT EXISTS idx_media_people_media_id ON media_people(media_id, role);

-- =====================================================
-- 8. media_search (FTS5)
-- =====================================================
CREATE VIRTUAL TABLE IF NOT EXISTS media_search USING fts5(
  media_id UNINDEXED,
  title,
  original_title,
  overview,
  genres,
  cast_names,
  keywords,
  phonetic_key,
  created_at UNINDEXED,
  enriched_data UNINDEXED,
  tokenize='unicode61 remove_diacritics 1'
);

-- =====================================================
-- 9. library_snapshots
-- =====================================================
CREATE TABLE IF NOT EXISTS library_snapshots (
  snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
  library_id INTEGER NOT NULL,
  scan_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('start','complete','interrupted')),
  media_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  accessible_paths TEXT,
  error_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  file_count INTEGER DEFAULT 0,
  folder_count INTEGER DEFAULT 0,
  total_size INTEGER DEFAULT 0,
  UNIQUE(library_id, scan_id, operation),
  FOREIGN KEY (library_id) REFERENCES libraries(library_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_library_snapshots_library_created ON library_snapshots(library_id, created_at DESC);

-- =====================================================
-- 10. settings
-- =====================================================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  category TEXT DEFAULT 'general',
  data_type TEXT DEFAULT 'string',
  description TEXT,
  is_secure INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed network settings
INSERT OR IGNORE INTO settings (key, value, category, data_type) VALUES
  ('listen_address', '0.0.0.0', 'network', 'string'),
  ('auto_restart_on_port_change', 'true', 'network', 'boolean'),
  ('app_port', '4000', 'network', 'string');

-- =====================================================
-- 11. settings_audit_log
-- =====================================================
CREATE TABLE IF NOT EXISTS settings_audit_log (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  setting_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  reason TEXT,
  ip_address TEXT,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- =====================================================
-- 12. translation_cache
-- =====================================================
CREATE TABLE IF NOT EXISTS translation_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_hash TEXT NOT NULL,
  source_text TEXT NOT NULL,
  target_lang TEXT NOT NULL DEFAULT 'ar',
  translated_text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_hash, target_lang)
);

-- =====================================================
-- 13. activities
-- =====================================================
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  module TEXT,
  status INTEGER DEFAULT 1,
  user_id INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  details TEXT,
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  device_id TEXT,
  severity TEXT DEFAULT 'info',
  target_id INTEGER,
  entity_type TEXT DEFAULT 'user',
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_action ON activities(action, module);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_device_id ON activities(device_id);
CREATE INDEX IF NOT EXISTS idx_activities_entity_type ON activities(entity_type);
CREATE INDEX IF NOT EXISTS idx_activities_module_severity ON activities(module, severity);
CREATE INDEX IF NOT EXISTS idx_activities_target ON activities(target_id, action);
CREATE INDEX IF NOT EXISTS idx_activities_user_created ON activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_user_date ON activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_action_date ON activities(action, created_at);

-- =====================================================
-- 14. security_events
-- =====================================================
CREATE TABLE IF NOT EXISTS security_events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  event_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  resolved INTEGER DEFAULT 0,
  resolved_at DATETIME,
  resolved_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id, resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user_resolved ON security_events(user_id, resolved);
CREATE INDEX IF NOT EXISTS idx_security_events_created_severity ON security_events(created_at DESC, severity);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_user_date ON security_events(user_id, created_at DESC);

-- =====================================================
-- 15. pending_enrichment_approvals (rebuilt in 016)
-- =====================================================
CREATE TABLE IF NOT EXISTS pending_enrichment_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id INTEGER NOT NULL UNIQUE,
  media_title TEXT NOT NULL,
  tmdb_id INTEGER NOT NULL,
  tmdb_title TEXT NOT NULL,
  similarity_score REAL NOT NULL,
  details_json TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (media_id) REFERENCES media_items(media_id) ON DELETE CASCADE
);

-- =====================================================
-- 16. user_progress
-- =====================================================
CREATE TABLE IF NOT EXISTS user_progress (
  progress_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  media_id INTEGER NOT NULL,
  last_position INTEGER DEFAULT 0,
  is_finished INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  progress_percent REAL DEFAULT 0,
  device_id TEXT,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (media_id) REFERENCES media_items(media_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_media_id ON user_progress(media_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_progress_user_media ON user_progress(user_id, media_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_updated_at ON user_progress(updated_at);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_finished ON user_progress(user_id, is_finished);
CREATE INDEX IF NOT EXISTS idx_user_progress_device_id ON user_progress(device_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_media_user ON user_progress(media_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_progress_unique ON user_progress(user_id, media_id);

-- =====================================================
-- 17. media_reports
-- =====================================================
CREATE TABLE IF NOT EXISTS media_reports (
  report_id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_type TEXT NOT NULL CHECK (report_type IN ('broken','abuse')),
  media_id INTEGER NOT NULL,
  media_title TEXT,
  media_type TEXT,
  library_id INTEGER,
  library_name TEXT,
  library_type TEXT,
  stream_url TEXT,
  violation_type TEXT,
  description TEXT,
  device_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (media_id) REFERENCES media_items(media_id) ON DELETE CASCADE
);

-- =====================================================
-- 18. visitors (rebuilt in 017)
-- =====================================================
CREATE TABLE IF NOT EXISTS visitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT UNIQUE,
  device_type TEXT,
  user_agent TEXT,
  ip_address TEXT,
  is_online INTEGER DEFAULT 0,
  is_blocked INTEGER DEFAULT 0,
  first_seen DATETIME,
  last_seen DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_visitors_device ON visitors(device_id);
CREATE INDEX IF NOT EXISTS idx_visitors_online ON visitors(is_online);
CREATE INDEX IF NOT EXISTS idx_visitors_last_seen ON visitors(last_seen DESC);

-- =====================================================
-- 19. visitor_events (created in 017)
-- =====================================================
CREATE TABLE IF NOT EXISTS visitor_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id INTEGER,
  event_type TEXT NOT NULL CHECK (event_type IN ('visit','request')),
  session_id TEXT,
  bandwidth_used INTEGER DEFAULT 0,
  message TEXT,
  reply TEXT,
  reply_created_at TEXT,
  status TEXT DEFAULT 'pending',
  user_id TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_visitor_events_visitor ON visitor_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitor_events_type ON visitor_events(event_type);
CREATE INDEX IF NOT EXISTS idx_visitor_events_created ON visitor_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_events_visitor_type ON visitor_events(visitor_id, event_type);
CREATE INDEX IF NOT EXISTS idx_visitor_events_session ON visitor_events(session_id);
CREATE INDEX IF NOT EXISTS idx_visitor_events_status ON visitor_events(status);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-log user creation
CREATE TRIGGER IF NOT EXISTS log_user_creation
AFTER INSERT ON users
BEGIN
  INSERT INTO activities (entity_type, user_id, action, module, details)
  VALUES ('user', NEW.user_id, 'user_created', 'auth', json_object('username', NEW.username));
END;

-- Auto-log user login
CREATE TRIGGER IF NOT EXISTS log_user_login
AFTER INSERT ON user_sessions
BEGIN
  INSERT INTO security_events (event_type, user_id, details, ip_address)
  VALUES ('login_success', NEW.user_id, json_object('session_id', NEW.id), NEW.ip_address);
END;

-- Auto-populate FTS search index on media insert (skip season/episode)
CREATE TRIGGER IF NOT EXISTS media_items_ai
AFTER INSERT ON media_items
BEGIN
  INSERT INTO media_search (media_id, title, original_title, overview, created_at, phonetic_key)
  SELECT new.media_id, new.title, new.original_title, new.overview, new.created_at, ''
  WHERE new.type NOT IN ('season', 'episode');
END;

-- Auto-update visitor online status on new event
CREATE TRIGGER IF NOT EXISTS update_visitor_online
AFTER INSERT ON visitor_events
BEGIN
  UPDATE visitors
  SET is_online = 1,
      last_seen = NEW.created_at
  WHERE id = NEW.visitor_id
    AND datetime(NEW.created_at) >= datetime('now', '-5 minutes');
END;

-- =====================================================
-- 20. news (News & Announcements)
-- =====================================================
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT NOT NULL,
  image_url TEXT,
  author TEXT,
  is_published INTEGER DEFAULT 0,
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_news_published ON news(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_created ON news(created_at DESC);

-- =====================================================
-- 21. messages (Support/Tickets/Broadcasts)
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'support' CHECK(type IN ('support', 'ticket', 'broadcast')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'read', 'resolved')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- =====================================================
-- 22. ads (Banner Ads)
-- =====================================================
CREATE TABLE IF NOT EXISTS ads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  position TEXT NOT NULL DEFAULT 'banner' CHECK(position IN ('banner', 'sidebar', 'popup', 'inline')),
  is_active INTEGER DEFAULT 1,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  start_date DATETIME,
  end_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ads_active ON ads(is_active);
CREATE INDEX IF NOT EXISTS idx_ads_position ON ads(position);
CREATE INDEX IF NOT EXISTS idx_ads_dates ON ads(start_date, end_date);

-- =====================================================
-- 23. store_products (Shop/Store Items)
-- =====================================================
CREATE TABLE IF NOT EXISTS store_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  image_url TEXT,
  category TEXT,
  stock INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_store_products_active ON store_products(is_active);
CREATE INDEX IF NOT EXISTS idx_store_products_category ON store_products(category);
CREATE INDEX IF NOT EXISTS idx_store_products_name ON store_products(name);

PRAGMA foreign_keys = ON;
