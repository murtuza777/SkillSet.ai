INSERT OR IGNORE INTO skills (id, slug, name, category, description, is_active)
VALUES
  ('skill_python', 'python', 'Python', 'programming', 'General-purpose programming for automation, backend development, and data work.', 1),
  ('skill_react', 'react', 'React', 'frontend', 'Component-based frontend development with modern React.', 1),
  ('skill_typescript', 'typescript', 'TypeScript', 'programming', 'Typed JavaScript for scalable applications and tooling.', 1);

INSERT OR IGNORE INTO level_definitions (id, level_no, title, min_points)
VALUES
  ('level_1', 1, 'Starter', 0),
  ('level_2', 2, 'Builder', 100),
  ('level_3', 3, 'Collaborator', 250);

INSERT OR IGNORE INTO badge_definitions (id, code, name, description, rule_json, icon_url, rarity, is_active)
VALUES
  ('badge_first_task', 'first-task', 'First Task', 'Awarded when a learner completes the first task.', '{"event":"task_completed","count":1}', NULL, 'common', 1),
  ('badge_fast_starter', 'fast-starter', 'Fast Starter', 'Awarded after completing three tasks.', '{"event":"task_completed","count":3}', NULL, 'common', 1),
  ('badge_streak_7', '7-day-streak', '7-Day Streak', 'Awarded for maintaining a seven day activity streak.', '{"event":"daily_streak","count":7}', NULL, 'rare', 1),
  ('badge_project_finisher', 'project-finisher', 'Project Finisher', 'Awarded for completing a project.', '{"event":"project_completed","count":1}', NULL, 'rare', 1),
  ('badge_peer_mentor', 'peer-mentor', 'Peer Mentor', 'Awarded when a learner is recognized for helping a peer.', '{"event":"helpful_reply","count":1}', NULL, 'rare', 1),
  ('badge_consistency_master', 'consistency-master', 'Consistency Master', 'Awarded for maintaining a long activity streak.', '{"event":"daily_streak","count":30}', NULL, 'epic', 1);
