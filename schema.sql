PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'mentor', 'admin')),
  status TEXT NOT NULL,
  email_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  timezone TEXT,
  language TEXT,
  experience_level TEXT,
  weekly_hours INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS user_skills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('have', 'want')),
  proficiency_level TEXT,
  target_level TEXT,
  priority INTEGER,
  UNIQUE (user_id, skill_id, direction),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS learning_paths (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  difficulty TEXT,
  goal_type TEXT,
  estimated_hours INTEGER,
  source_strategy TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (skill_id) REFERENCES skills(id)
);

CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  learning_path_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  sequence_no INTEGER NOT NULL,
  estimated_minutes INTEGER,
  unlock_rule_json TEXT,
  FOREIGN KEY (learning_path_id) REFERENCES learning_paths(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  title TEXT NOT NULL,
  lesson_type TEXT,
  summary TEXT,
  content_ref_json TEXT,
  sequence_no INTEGER NOT NULL,
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  title TEXT NOT NULL,
  task_type TEXT,
  instructions TEXT NOT NULL,
  difficulty TEXT,
  points_reward INTEGER NOT NULL DEFAULT 0,
  acceptance_criteria_json TEXT,
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_learning_paths (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  learning_path_id TEXT NOT NULL,
  status TEXT NOT NULL,
  progress_pct REAL NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  current_module_id TEXT,
  UNIQUE (user_id, learning_path_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (learning_path_id) REFERENCES learning_paths(id) ON DELETE CASCADE,
  FOREIGN KEY (current_module_id) REFERENCES modules(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS task_attempts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  submission_text TEXT,
  submission_url TEXT,
  score REAL,
  status TEXT NOT NULL,
  feedback_json TEXT,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  learning_path_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL,
  visibility TEXT NOT NULL,
  repo_url TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (learning_path_id) REFERENCES learning_paths(id) ON DELETE SET NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content_sources (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  source_type TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  external_id TEXT,
  title TEXT NOT NULL,
  author_name TEXT,
  license TEXT,
  language TEXT,
  published_at TEXT,
  quality_score REAL NOT NULL DEFAULT 0,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS content_chunks (
  id TEXT PRIMARY KEY,
  content_source_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  vector_id TEXT,
  keywords_json TEXT,
  summary TEXT,
  UNIQUE (content_source_id, chunk_index),
  FOREIGN KEY (content_source_id) REFERENCES content_sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_rooms (
  id TEXT PRIMARY KEY,
  room_type TEXT NOT NULL CHECK (room_type IN ('peer_room', 'project_room', 'module_room', 'cohort_room')),
  name TEXT NOT NULL,
  related_project_id TEXT,
  related_module_id TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (related_project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (related_module_id) REFERENCES modules(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  message_type TEXT NOT NULL,
  body TEXT NOT NULL,
  attachments_json TEXT,
  reply_to_message_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  edited_at TEXT,
  deleted_at TEXT,
  FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reply_to_message_id) REFERENCES messages(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS chat_room_members (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_read_message_id TEXT,
  UNIQUE (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (last_read_message_id) REFERENCES messages(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS peer_matches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  matched_user_id TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  reason_codes_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (matched_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS point_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  points_delta INTEGER NOT NULL,
  source_entity TEXT,
  source_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS badge_definitions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  rule_json TEXT,
  icon_url TEXT,
  rarity TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS user_badges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  awarded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, badge_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES badge_definitions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS level_definitions (
  id TEXT PRIMARY KEY,
  level_no INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  min_points INTEGER NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id TEXT PRIMARY KEY,
  board_type TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT,
  period_type TEXT NOT NULL,
  rankings_json TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  owner_user_id TEXT,
  scope_json TEXT,
  last_used_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_skills_user_direction ON user_skills (user_id, direction);
CREATE INDEX IF NOT EXISTS idx_modules_learning_path_sequence ON modules (learning_path_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_tasks_module_id ON tasks (module_id);
CREATE INDEX IF NOT EXISTS idx_messages_room_created_at ON messages (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_peer_matches_user_score ON peer_matches (user_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created_at ON activity_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_ledger_user_created_at ON point_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_sources_provider_external ON content_sources (provider, external_id);
CREATE INDEX IF NOT EXISTS idx_content_sources_canonical_url ON content_sources (canonical_url);
CREATE INDEX IF NOT EXISTS idx_content_chunks_source_chunk ON content_chunks (content_source_id, chunk_index);
