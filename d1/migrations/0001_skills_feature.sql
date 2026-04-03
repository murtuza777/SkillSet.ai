-- Skills feature: squads, per-skill progress, lesson completion, XP audit trail
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS squads (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  room_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS squad_members (
  id TEXT PRIMARY KEY,
  squad_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (squad_id, user_id),
  FOREIGN KEY (squad_id) REFERENCES squads(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_progress (
  user_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  completed_lessons INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_activity_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, skill_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_completed_lessons (
  user_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, lesson_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS xp_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  lesson_id TEXT,
  reason TEXT NOT NULL,
  xp_delta INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_squads_skill_created_at ON squads (skill_id, created_at);
CREATE INDEX IF NOT EXISTS idx_squad_members_squad_user ON squad_members (squad_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_skill_user ON user_progress (skill_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_completed_lessons_skill_user ON user_completed_lessons (skill_id, user_id);
CREATE INDEX IF NOT EXISTS idx_xp_logs_user_skill_created ON xp_logs (user_id, skill_id, created_at DESC);
