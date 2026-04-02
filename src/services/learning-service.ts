import { allRows, firstRow, placeholders, runStatement } from '../db/client';
import { isoNow, randomId, safeJsonParse } from '../lib/crypto';
import type { AppBindings } from '../types';
import { generateJsonWithAi } from './ai-service';
import { discoverContent, ingestSourceById, semanticContentLookup } from './content-service';
import { enqueueGamificationEvent, logActivity } from './gamification-service';

interface GeneratedLesson {
  title: string;
  lessonType: string;
  summary: string;
  contentRefs: Array<{ sourceId: string; title: string; canonicalUrl: string }>;
}

interface GeneratedTask {
  title: string;
  taskType: string;
  instructions: string;
  difficulty: string;
  pointsReward: number;
  acceptanceCriteria: string[];
}

interface GeneratedModule {
  title: string;
  summary: string;
  estimatedMinutes: number;
  unlockRule?: Record<string, unknown> | null;
  lessons: GeneratedLesson[];
  tasks: GeneratedTask[];
}

interface GeneratedPath {
  title: string;
  description: string;
  difficulty: string;
  modules: GeneratedModule[];
}

const fallbackPath = (
  skillName: string,
  difficulty: string,
  content: Array<{
    sourceId: string;
    title: string;
    canonicalUrl: string;
    summary: string;
  }>,
): GeneratedPath => ({
  title: `${skillName} Guided Learning Path`,
  description: `A structured path for learning ${skillName} using curated documentation and videos.`,
  difficulty,
  modules: content.slice(0, 3).map((item, index) => ({
    title: `${skillName} Module ${index + 1}: ${item.title}`,
    summary: item.summary || `Build practical understanding using ${item.title}.`,
    estimatedMinutes: 90,
    lessons: [
      {
        title: `${skillName} Lesson ${index + 1}`,
        lessonType: 'reading',
        summary: item.summary || `Study ${item.title} and capture the key concepts.`,
        contentRefs: [
          {
            sourceId: item.sourceId,
            title: item.title,
            canonicalUrl: item.canonicalUrl,
          },
        ],
      },
    ],
    tasks: [
      {
        title: `${skillName} Practice ${index + 1}`,
        taskType: 'challenge',
        instructions: `Review ${item.title}, summarize the key concepts, and create a practical artifact that proves understanding.`,
        difficulty,
        pointsReward: 10,
        acceptanceCriteria: [
          'Share a concise summary of what was learned',
          'Produce a working example or practical note',
          'Reflect on blockers and next steps',
        ],
      },
    ],
  })),
});

const generatePathWithAi = async (
  env: AppBindings,
  payload: {
    skillName: string;
    difficulty: string;
    goalType?: string;
    targetRole?: string;
    preferredContentType?: string;
    targetDeadline?: string;
    timePerWeek?: number;
    content: Array<{
      sourceId: string;
      title: string;
      canonicalUrl: string;
      summary: string;
    }>;
  },
) =>
  generateJsonWithAi<GeneratedPath>(env, {
    systemPrompt:
      'You generate structured learning paths in strict JSON with keys title, description, difficulty, and modules. Each module must include title, summary, estimatedMinutes, lessons, and tasks. Do not include markdown.',
    userPrompt: JSON.stringify(payload),
  });

const generateSubmissionFeedback = async (
  env: AppBindings,
  payload: {
    taskTitle: string;
    instructions: string;
    submissionText?: string;
    submissionUrl?: string;
  },
) => {
  const generated = await generateJsonWithAi<{
    summary?: string;
    suggestions?: string[];
  }>(env, {
    systemPrompt:
      'You review learner submissions. Return strict JSON with keys summary and suggestions, where suggestions is an array of short strings.',
    userPrompt: JSON.stringify(payload),
  });

  return (
    generated ?? {
      summary: 'Submission received successfully.',
      suggestions: ['Review the acceptance criteria and refine your solution before the next task.'],
    }
  );
};

const persistLearningPath = async (
  db: D1Database,
  payload: {
    skillId: string;
    goalType?: string;
    sourceStrategy: string;
    path: GeneratedPath;
  },
) => {
  const learningPathId = randomId();
  await runStatement(
    db,
    `INSERT INTO learning_paths
      (id, skill_id, title, description, difficulty, goal_type, estimated_hours, source_strategy, version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      learningPathId,
      payload.skillId,
      payload.path.title,
      payload.path.description,
      payload.path.difficulty,
      payload.goalType ?? null,
      Math.ceil(payload.path.modules.length * 1.5),
      payload.sourceStrategy,
      isoNow(),
    ],
  );

  for (const [moduleIndex, module] of payload.path.modules.entries()) {
    const moduleId = randomId();
    await runStatement(
      db,
      `INSERT INTO modules
        (id, learning_path_id, title, summary, sequence_no, estimated_minutes, unlock_rule_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        moduleId,
        learningPathId,
        module.title,
        module.summary,
        moduleIndex + 1,
        module.estimatedMinutes,
        JSON.stringify(module.unlockRule ?? null),
      ],
    );

    for (const [lessonIndex, lesson] of module.lessons.entries()) {
      await runStatement(
        db,
        `INSERT INTO lessons
          (id, module_id, title, lesson_type, summary, content_ref_json, sequence_no)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          randomId(),
          moduleId,
          lesson.title,
          lesson.lessonType,
          lesson.summary,
          JSON.stringify(lesson.contentRefs),
          lessonIndex + 1,
        ],
      );
    }

    for (const task of module.tasks) {
      await runStatement(
        db,
        `INSERT INTO tasks
          (id, module_id, title, task_type, instructions, difficulty, points_reward, acceptance_criteria_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomId(),
          moduleId,
          task.title,
          task.taskType,
          task.instructions,
          task.difficulty,
          task.pointsReward,
          JSON.stringify(task.acceptanceCriteria),
        ],
      );
    }
  }

  return learningPathId;
};

export const generateLearningPath = async (
  env: AppBindings,
  db: D1Database,
  userId: string,
  payload: {
    skillId?: string;
    skillSlug?: string;
    difficulty?: string;
    goalType?: string;
    targetRole?: string;
    preferredContentType?: string;
    targetDeadline?: string;
    timePerWeek?: number;
  },
) => {
  const skill = payload.skillId
    ? await firstRow<{ id: string; slug: string; name: string }>(
        db,
        `SELECT id, slug, name FROM skills WHERE id = ? LIMIT 1`,
        [payload.skillId],
      )
    : await firstRow<{ id: string; slug: string; name: string }>(
        db,
        `SELECT id, slug, name FROM skills WHERE slug = ? LIMIT 1`,
        [payload.skillSlug ?? ''],
      );

  if (!skill) {
    return null;
  }

  let chunkMatches = await semanticContentLookup(env, db, {
    skillId: skill.id,
    skillSlug: skill.slug,
    query: `${skill.name} ${payload.goalType ?? ''} ${payload.difficulty ?? 'beginner'}`.trim(),
    topK: 8,
  });

  if (chunkMatches.length === 0) {
    const discovery = await discoverContent(env, db, {
      skillId: skill.id,
      skillSlug: skill.slug,
      level: payload.difficulty,
      goal: payload.goalType,
    });

    for (const source of discovery.sources) {
      await ingestSourceById(env, db, source.id);
    }

    chunkMatches = await semanticContentLookup(env, db, {
      skillId: skill.id,
      skillSlug: skill.slug,
      query: `${skill.name} ${payload.goalType ?? ''} ${payload.difficulty ?? 'beginner'}`.trim(),
      topK: 8,
    });
  }

  const sourceIds = Array.from(new Set(chunkMatches.map((item) => item.contentSourceId)));
  const sources =
    sourceIds.length > 0
      ? await allRows<{
          id: string;
          title: string;
          canonical_url: string;
        }>(
          db,
          `SELECT id, title, canonical_url
           FROM content_sources
           WHERE id IN (${placeholders(sourceIds.length)})`,
          sourceIds,
        )
      : [];

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const contentContext = chunkMatches.map((item) => ({
    sourceId: item.contentSourceId,
    title: sourceById.get(item.contentSourceId)?.title ?? 'Source',
    canonicalUrl: sourceById.get(item.contentSourceId)?.canonical_url ?? '',
    summary: item.summary ?? item.text.slice(0, 180),
  }));

  const difficulty = payload.difficulty ?? 'beginner';
  const aiPath =
    (await generatePathWithAi(env, {
      skillName: skill.name,
      difficulty,
      goalType: payload.goalType,
      targetRole: payload.targetRole,
      preferredContentType: payload.preferredContentType,
      targetDeadline: payload.targetDeadline,
      timePerWeek: payload.timePerWeek,
      content: contentContext,
    })) ?? fallbackPath(skill.name, difficulty, contentContext);


  const learningPathId = await persistLearningPath(db, {
    skillId: skill.id,
    goalType: payload.goalType,
    sourceStrategy: 'workers_ai_generated',
    path: aiPath,
  });

  await logActivity(db, {
    userId,
    eventType: 'learning_path_generated',
    entityType: 'learning_path',
    entityId: learningPathId,
    metadata: { skillId: skill.id },
  });

  return getLearningPath(db, learningPathId, userId);
};

export const getLearningPath = async (db: D1Database, learningPathId: string, userId?: string) => {
  const path = await firstRow<{
    id: string;
    skill_id: string;
    title: string;
    description: string | null;
    difficulty: string | null;
    goal_type: string | null;
    estimated_hours: number | null;
    source_strategy: string | null;
    version: number;
    created_at: string;
  }>(
    db,
    `SELECT id, skill_id, title, description, difficulty, goal_type, estimated_hours, source_strategy, version, created_at
     FROM learning_paths
     WHERE id = ?
     LIMIT 1`,
    [learningPathId],
  );

  if (!path) {
    return null;
  }

  const modules = await allRows<{
    id: string;
    title: string;
    summary: string | null;
    sequence_no: number;
    estimated_minutes: number | null;
    unlock_rule_json: string | null;
  }>(
    db,
    `SELECT id, title, summary, sequence_no, estimated_minutes, unlock_rule_json
     FROM modules
     WHERE learning_path_id = ?
     ORDER BY sequence_no ASC`,
    [learningPathId],
  );

  const moduleIds = modules.map((module) => module.id);
  const lessons =
    moduleIds.length > 0
      ? await allRows<{
          id: string;
          module_id: string;
          title: string;
          lesson_type: string | null;
          summary: string | null;
          content_ref_json: string | null;
          sequence_no: number;
        }>(
          db,
          `SELECT id, module_id, title, lesson_type, summary, content_ref_json, sequence_no
           FROM lessons
           WHERE module_id IN (${placeholders(moduleIds.length)})
           ORDER BY sequence_no ASC`,
          moduleIds,
        )
      : [];

  const tasks =
    moduleIds.length > 0
      ? await allRows<{
          id: string;
          module_id: string;
          title: string;
          task_type: string | null;
          instructions: string;
          difficulty: string | null;
          points_reward: number;
          acceptance_criteria_json: string | null;
        }>(
          db,
          `SELECT id, module_id, title, task_type, instructions, difficulty, points_reward, acceptance_criteria_json
           FROM tasks
           WHERE module_id IN (${placeholders(moduleIds.length)})`,
          moduleIds,
        )
      : [];

  const enrollment = userId
    ? await firstRow<{
        id: string;
        status: string;
        progress_pct: number;
        started_at: string | null;
        completed_at: string | null;
        current_module_id: string | null;
      }>(
        db,
        `SELECT id, status, progress_pct, started_at, completed_at, current_module_id
         FROM user_learning_paths
         WHERE user_id = ?
           AND learning_path_id = ?
         LIMIT 1`,
        [userId, learningPathId],
      )
    : null;

  return {
    id: path.id,
    skillId: path.skill_id,
    title: path.title,
    description: path.description,
    difficulty: path.difficulty,
    goalType: path.goal_type,
    estimatedHours: path.estimated_hours,
    sourceStrategy: path.source_strategy,
    version: path.version,
    createdAt: path.created_at,
    enrollment: enrollment
      ? {
          id: enrollment.id,
          status: enrollment.status,
          progressPct: enrollment.progress_pct,
          startedAt: enrollment.started_at,
          completedAt: enrollment.completed_at,
          currentModuleId: enrollment.current_module_id,
        }
      : null,
    modules: modules.map((module) => ({
      id: module.id,
      title: module.title,
      summary: module.summary,
      sequenceNo: module.sequence_no,
      estimatedMinutes: module.estimated_minutes,
      unlockRule: safeJsonParse(module.unlock_rule_json, null),
      lessons: lessons
        .filter((lesson) => lesson.module_id === module.id)
        .map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          lessonType: lesson.lesson_type,
          summary: lesson.summary,
          contentRef: safeJsonParse(lesson.content_ref_json, []),
          sequenceNo: lesson.sequence_no,
        })),
      tasks: tasks
        .filter((task) => task.module_id === module.id)
        .map((task) => ({
          id: task.id,
          title: task.title,
          taskType: task.task_type,
          instructions: task.instructions,
          difficulty: task.difficulty,
          pointsReward: task.points_reward,
          acceptanceCriteria: safeJsonParse(task.acceptance_criteria_json, []),
        })),
    })),
  };
};

export const enrollInLearningPath = async (db: D1Database, userId: string, learningPathId: string) => {
  const existing = await firstRow<{ id: string }>(
    db,
    `SELECT id
     FROM user_learning_paths
     WHERE user_id = ?
       AND learning_path_id = ?
     LIMIT 1`,
    [userId, learningPathId],
  );

  if (!existing) {
    const firstModule = await firstRow<{ id: string }>(
      db,
      `SELECT id
       FROM modules
       WHERE learning_path_id = ?
       ORDER BY sequence_no ASC
       LIMIT 1`,
      [learningPathId],
    );

    await runStatement(
      db,
      `INSERT INTO user_learning_paths
        (id, user_id, learning_path_id, status, progress_pct, started_at, completed_at, current_module_id)
       VALUES (?, ?, ?, 'enrolled', 0, ?, NULL, ?)`,
      [randomId(), userId, learningPathId, isoNow(), firstModule?.id ?? null],
    );
  }

  return getLearningPath(db, learningPathId, userId);
};

export const getModule = async (db: D1Database, moduleId: string) => {
  const module = await firstRow<{
    id: string;
    learning_path_id: string;
    title: string;
    summary: string | null;
    sequence_no: number;
    estimated_minutes: number | null;
    unlock_rule_json: string | null;
  }>(
    db,
    `SELECT id, learning_path_id, title, summary, sequence_no, estimated_minutes, unlock_rule_json
     FROM modules
     WHERE id = ?
     LIMIT 1`,
    [moduleId],
  );

  if (!module) {
    return null;
  }

  const lessons = await allRows<{
    id: string;
    title: string;
    lesson_type: string | null;
    summary: string | null;
    content_ref_json: string | null;
    sequence_no: number;
  }>(
    db,
    `SELECT id, title, lesson_type, summary, content_ref_json, sequence_no
     FROM lessons
     WHERE module_id = ?
     ORDER BY sequence_no ASC`,
    [moduleId],
  );

  const tasks = await allRows<{
    id: string;
    title: string;
    task_type: string | null;
    instructions: string;
    difficulty: string | null;
    points_reward: number;
    acceptance_criteria_json: string | null;
  }>(
    db,
    `SELECT id, title, task_type, instructions, difficulty, points_reward, acceptance_criteria_json
     FROM tasks
     WHERE module_id = ?`,
    [moduleId],
  );

  return {
    id: module.id,
    learningPathId: module.learning_path_id,
    title: module.title,
    summary: module.summary,
    sequenceNo: module.sequence_no,
    estimatedMinutes: module.estimated_minutes,
    unlockRule: safeJsonParse(module.unlock_rule_json, null),
    lessons: lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      lessonType: lesson.lesson_type,
      summary: lesson.summary,
      contentRef: safeJsonParse(lesson.content_ref_json, []),
      sequenceNo: lesson.sequence_no,
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      taskType: task.task_type,
      instructions: task.instructions,
      difficulty: task.difficulty,
      pointsReward: task.points_reward,
      acceptanceCriteria: safeJsonParse(task.acceptance_criteria_json, []),
    })),
  };
};

const updateProgressForUserLearningPath = async (db: D1Database, userId: string, taskId: string) => {
  const pathInfo = await firstRow<{ learning_path_id: string; module_id: string }>(
    db,
    `SELECT m.learning_path_id, t.module_id
     FROM tasks t
     JOIN modules m ON m.id = t.module_id
     WHERE t.id = ?
     LIMIT 1`,
    [taskId],
  );

  if (!pathInfo) {
    return;
  }

  const totals = await firstRow<{ total_tasks: number }>(
    db,
    `SELECT COUNT(*) AS total_tasks
     FROM tasks t
     JOIN modules m ON m.id = t.module_id
     WHERE m.learning_path_id = ?`,
    [pathInfo.learning_path_id],
  );

  const completed = await firstRow<{ completed_tasks: number }>(
    db,
    `SELECT COUNT(DISTINCT ta.task_id) AS completed_tasks
     FROM task_attempts ta
     JOIN tasks t ON t.id = ta.task_id
     JOIN modules m ON m.id = t.module_id
     WHERE ta.user_id = ?
       AND m.learning_path_id = ?
       AND ta.status = 'completed'`,
    [userId, pathInfo.learning_path_id],
  );

  const totalTasks = totals?.total_tasks ?? 0;
  const completedTasks = completed?.completed_tasks ?? 0;
  const progress = totalTasks > 0 ? Number(((completedTasks / totalTasks) * 100).toFixed(2)) : 0;

  const nextModule = await firstRow<{ id: string }>(
    db,
    `SELECT m.id
     FROM modules m
     WHERE m.learning_path_id = ?
       AND EXISTS (
         SELECT 1
         FROM tasks t
         WHERE t.module_id = m.id
           AND t.id NOT IN (
             SELECT task_id
             FROM task_attempts
             WHERE user_id = ?
               AND status = 'completed'
           )
       )
     ORDER BY m.sequence_no ASC
     LIMIT 1`,
    [pathInfo.learning_path_id, userId],
  );

  await runStatement(
    db,
    `UPDATE user_learning_paths
     SET progress_pct = ?, current_module_id = ?, completed_at = ?, status = ?
     WHERE user_id = ?
       AND learning_path_id = ?`,
    [
      progress,
      nextModule?.id ?? pathInfo.module_id,
      progress >= 100 ? isoNow() : null,
      progress >= 100 ? 'completed' : 'enrolled',
      userId,
      pathInfo.learning_path_id,
    ],
  );
};

export const submitTaskAttempt = async (
  env: AppBindings,
  db: D1Database,
  payload: {
    userId: string;
    taskId: string;
    submissionText?: string;
    submissionUrl?: string;
  },
) => {
  const task = await firstRow<{
    id: string;
    title: string;
    instructions: string;
  }>(
    db,
    `SELECT id, title, instructions
     FROM tasks
     WHERE id = ?
     LIMIT 1`,
    [payload.taskId],
  );

  if (!task) {
    return null;
  }

  const feedback = await generateSubmissionFeedback(env, {
    taskTitle: task.title,
    instructions: task.instructions,
    submissionText: payload.submissionText,
    submissionUrl: payload.submissionUrl,
  });

  const attemptId = randomId();

  await runStatement(
    db,
    `INSERT INTO task_attempts
      (id, task_id, user_id, submission_text, submission_url, score, status, feedback_json, submitted_at)
     VALUES (?, ?, ?, ?, ?, NULL, 'completed', ?, ?)`,
    [
      attemptId,
      payload.taskId,
      payload.userId,
      payload.submissionText ?? null,
      payload.submissionUrl ?? null,
      JSON.stringify(feedback),
      isoNow(),
    ],
  );

  await logActivity(db, {
    userId: payload.userId,
    eventType: 'task_completed',
    entityType: 'task',
    entityId: payload.taskId,
    metadata: { attemptId },
  });

  await enqueueGamificationEvent(env, {
    type: 'task_completed',
    userId: payload.userId,
    taskId: payload.taskId,
    attemptId,
    idempotencyKey: `task_completed:${payload.userId}:${payload.taskId}`,
  });

  await updateProgressForUserLearningPath(db, payload.userId, payload.taskId);

  return {
    id: attemptId,
    taskId: payload.taskId,
    userId: payload.userId,
    submissionText: payload.submissionText ?? null,
    submissionUrl: payload.submissionUrl ?? null,
    status: 'completed',
    feedback,
  };
};
