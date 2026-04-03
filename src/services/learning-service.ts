import { allRows, firstRow, runStatement } from '../db/client';
import { randomId, safeJsonParse } from '../lib/crypto';
import { generateJsonWithAi } from './ai-service';
import { semanticContentLookup } from './content-service';
import {
  enqueueGamificationEvent,
  logActivity,
  processGamificationQueueMessage,
} from './gamification-service';
import type { AppBindings } from '../types';

interface GenerateLearningPathPayload {
  skillId: string;
  goalType?: string;
  difficulty?: string;
  preferredContentType?: string;
}

interface GeneratedModule {
  title: string;
  summary: string;
  estimatedMinutes: number;
  lessons: Array<{
    title: string;
    lessonType: string;
    summary: string;
    contentRef: Array<{
      sourceId: string;
      title: string;
      canonicalUrl: string;
    }>;
  }>;
  tasks: Array<{
    title: string;
    taskType: string;
    instructions: string;
    difficulty: string;
    pointsReward: number;
    acceptanceCriteria: string[];
  }>;
}

const getSkillById = async (db: D1Database, skillId: string) =>
  firstRow<{ id: string; slug: string; name: string }>(
    db,
    `SELECT id, slug, name
     FROM skills
     WHERE id = ?
       AND is_active = 1
     LIMIT 1`,
    [skillId],
  );

const getSourceMap = async (db: D1Database, sourceIds: string[]) => {
  if (sourceIds.length === 0) {
    return new Map<string, { id: string; title: string; canonical_url: string }>();
  }

  const rows = await allRows<{ id: string; title: string; canonical_url: string }>(
    db,
    `SELECT id, title, canonical_url
     FROM content_sources
     WHERE id IN (${sourceIds.map(() => '?').join(', ')})`,
    sourceIds,
  );

  return new Map(rows.map((row) => [row.id, row]));
};

const fallbackModules = (
  skillName: string,
  difficulty: string,
  references: Array<{
    sourceId: string;
    title: string;
    canonicalUrl: string;
  }>,
): GeneratedModule[] => {
  const firstRef = references.slice(0, 2);
  const secondRef = references.slice(2, 5);
  const thirdRef = references.slice(5, 8);

  return [
    {
      title: `${skillName} foundations`,
      summary: `Build a strong ${skillName} base with core concepts and examples.`,
      estimatedMinutes: 90,
      lessons: [
        {
          title: `Core ${skillName} concepts`,
          lessonType: 'reading',
          summary: `Understand the key principles behind ${skillName}.`,
          contentRef: firstRef,
        },
      ],
      tasks: [
        {
          title: `Complete a ${skillName} fundamentals challenge`,
          taskType: 'exercise',
          instructions: `Summarize core ${skillName} concepts and apply them in a short practical exercise.`,
          difficulty,
          pointsReward: 10,
          acceptanceCriteria: [
            'Covers the main concepts in your own words',
            'Includes one practical implementation example',
          ],
        },
      ],
    },
    {
      title: `${skillName} applied practice`,
      summary: `Practice real-world usage with guided exercises and scoped deliverables.`,
      estimatedMinutes: 120,
      lessons: [
        {
          title: `${skillName} in practical workflows`,
          lessonType: 'mixed',
          summary: `Learn pragmatic techniques and implementation patterns.`,
          contentRef: secondRef.length > 0 ? secondRef : firstRef,
        },
      ],
      tasks: [
        {
          title: `Build a small ${skillName} project milestone`,
          taskType: 'project',
          instructions: `Implement a scoped milestone that demonstrates practical ${skillName} skills.`,
          difficulty,
          pointsReward: 20,
          acceptanceCriteria: [
            'Project milestone is functional',
            'Explains architectural/implementation choices',
            'Includes testing or validation notes',
          ],
        },
      ],
    },
    {
      title: `${skillName} consolidation`,
      summary: `Consolidate your learning with a capstone-style review and polish pass.`,
      estimatedMinutes: 90,
      lessons: [
        {
          title: `Review and optimization`,
          lessonType: 'review',
          summary: `Reinforce concepts and identify quality improvements.`,
          contentRef: thirdRef.length > 0 ? thirdRef : secondRef.length > 0 ? secondRef : firstRef,
        },
      ],
      tasks: [
        {
          title: `Deliver and reflect on your ${skillName} capstone`,
          taskType: 'assessment',
          instructions: `Submit a final deliverable and a brief reflection on trade-offs and lessons learned.`,
          difficulty,
          pointsReward: 30,
          acceptanceCriteria: [
            'Final deliverable is complete',
            'Reflection explains decisions and trade-offs',
            'Lists at least two next-step improvements',
          ],
        },
      ],
    },
  ];
};

const generateModules = async (
  env: AppBindings,
  payload: {
    skillName: string;
    goalType: string;
    difficulty: string;
    preferredContentType: string;
    references: Array<{
      sourceId: string;
      title: string;
      canonicalUrl: string;
    }>;
  },
) => {
  const aiResponse = await generateJsonWithAi<{
    modules?: GeneratedModule[];
  }>(env, {
    systemPrompt:
      'You generate concise learning curricula. Return strictly valid JSON with the key "modules". Each module requires: title, summary, estimatedMinutes, lessons[], tasks[]. Keep 2-4 modules.',
    userPrompt: JSON.stringify(
      {
        skillName: payload.skillName,
        goalType: payload.goalType,
        difficulty: payload.difficulty,
        preferredContentType: payload.preferredContentType,
        references: payload.references,
      },
      null,
      2,
    ),
  });

  if (aiResponse?.modules && Array.isArray(aiResponse.modules) && aiResponse.modules.length > 0) {
    const validModules = aiResponse.modules.filter(
      (module): module is GeneratedModule =>
        Boolean(
          module &&
            typeof module.title === 'string' &&
            typeof module.summary === 'string' &&
            Number.isFinite(module.estimatedMinutes) &&
            Array.isArray(module.lessons) &&
            Array.isArray(module.tasks),
        ),
    );

    if (validModules.length > 0) {
      return validModules;
    }
  }

  return fallbackModules(payload.skillName, payload.difficulty, payload.references);
};

const mapModuleTree = async (db: D1Database, moduleIds: string[]) => {
  if (moduleIds.length === 0) {
    return {
      lessonsByModule: new Map<
        string,
        Array<{
          id: string;
          module_id: string;
          title: string;
          lesson_type: string | null;
          summary: string | null;
          content_ref_json: string | null;
          sequence_no: number;
        }>
      >(),
      tasksByModule: new Map<
        string,
        Array<{
          id: string;
          module_id: string;
          title: string;
          task_type: string | null;
          instructions: string;
          difficulty: string | null;
          points_reward: number;
          acceptance_criteria_json: string | null;
        }>
      >(),
    };
  }

  const lessons = await allRows<{
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
     WHERE module_id IN (${moduleIds.map(() => '?').join(', ')})
     ORDER BY sequence_no ASC`,
    moduleIds,
  );

  const tasks = await allRows<{
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
     WHERE module_id IN (${moduleIds.map(() => '?').join(', ')})
     ORDER BY title ASC`,
    moduleIds,
  );

  const lessonsByModule = new Map<string, typeof lessons>();
  const tasksByModule = new Map<string, typeof tasks>();

  for (const lesson of lessons) {
    const bucket = lessonsByModule.get(lesson.module_id) ?? [];
    bucket.push(lesson);
    lessonsByModule.set(lesson.module_id, bucket);
  }

  for (const task of tasks) {
    const bucket = tasksByModule.get(task.module_id) ?? [];
    bucket.push(task);
    tasksByModule.set(task.module_id, bucket);
  }

  return { lessonsByModule, tasksByModule };
};

export const getLearningPathById = async (db: D1Database, userId: string, learningPathId: string) => {
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

  const enrollment = await firstRow<{
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
  );

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
  const { lessonsByModule, tasksByModule } = await mapModuleTree(db, moduleIds);

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
      unlockRule: safeJsonParse<Record<string, unknown> | null>(module.unlock_rule_json, null),
      lessons: (lessonsByModule.get(module.id) ?? []).map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        lessonType: lesson.lesson_type,
        summary: lesson.summary,
        contentRef: safeJsonParse(lesson.content_ref_json, []),
        sequenceNo: lesson.sequence_no,
      })),
      tasks: (tasksByModule.get(module.id) ?? []).map((task) => ({
        id: task.id,
        title: task.title,
        taskType: task.task_type,
        instructions: task.instructions,
        difficulty: task.difficulty,
        pointsReward: task.points_reward,
        acceptanceCriteria: safeJsonParse<string[]>(task.acceptance_criteria_json, []),
      })),
    })),
  };
};

export const listEnrolledLearningPaths = async (db: D1Database, userId: string) => {
  const ids = await allRows<{ learning_path_id: string }>(
    db,
    `SELECT learning_path_id
     FROM user_learning_paths
     WHERE user_id = ?
     ORDER BY started_at DESC, id DESC`,
    [userId],
  );

  const paths = [];
  for (const row of ids) {
    const path = await getLearningPathById(db, userId, row.learning_path_id);
    if (path) {
      paths.push(path);
    }
  }

  return paths;
};

export const generateLearningPath = async (
  env: AppBindings,
  db: D1Database,
  userId: string,
  payload: GenerateLearningPathPayload,
) => {
  const skill = await getSkillById(db, payload.skillId);
  if (!skill) {
    return null;
  }

  const lookup = await semanticContentLookup(env, db, {
    skillId: skill.id,
    skillSlug: skill.slug,
    query: `${skill.name} ${payload.goalType ?? 'portfolio'} ${payload.difficulty ?? 'beginner'} learning`,
    topK: 8,
  });

  const sourceIds = Array.from(new Set(lookup.map((entry) => entry.contentSourceId)));
  const sources = await getSourceMap(db, sourceIds);
  const references = lookup
    .map((entry) => {
      const source = sources.get(entry.contentSourceId);
      if (!source) {
        return null;
      }

      return {
        sourceId: source.id,
        title: source.title,
        canonicalUrl: source.canonical_url,
      };
    })
    .filter((value): value is { sourceId: string; title: string; canonicalUrl: string } => value !== null);

  const modules = await generateModules(env, {
    skillName: skill.name,
    goalType: payload.goalType ?? 'portfolio',
    difficulty: payload.difficulty ?? 'beginner',
    preferredContentType: payload.preferredContentType ?? 'mixed',
    references,
  });

  const learningPathId = randomId();
  await runStatement(
    db,
    `INSERT INTO learning_paths
      (id, skill_id, title, description, difficulty, goal_type, estimated_hours, source_strategy, version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      learningPathId,
      skill.id,
      `${skill.name} learning path`,
      `Personalized path for ${skill.name} focused on ${payload.goalType ?? 'portfolio'} outcomes.`,
      payload.difficulty ?? 'beginner',
      payload.goalType ?? 'portfolio',
      Math.max(2, modules.reduce((sum, module) => sum + module.estimatedMinutes, 0) / 60),
      'semantic_plus_ai',
      new Date().toISOString(),
    ],
  );

  for (const [moduleIndex, module] of modules.entries()) {
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
        null,
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
          JSON.stringify(lesson.contentRef),
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

  await logActivity(db, {
    userId,
    eventType: 'learning_path_generated',
    entityType: 'learning_path',
    entityId: learningPathId,
    metadata: {
      skillId: skill.id,
      modules: modules.length,
    },
  });

  return getLearningPathById(db, userId, learningPathId);
};

export const enrollLearningPath = async (db: D1Database, userId: string, learningPathId: string) => {
  const firstModule = await firstRow<{ id: string }>(
    db,
    `SELECT id
     FROM modules
     WHERE learning_path_id = ?
     ORDER BY sequence_no ASC
     LIMIT 1`,
    [learningPathId],
  );

  const existing = await firstRow<{ id: string }>(
    db,
    `SELECT id
     FROM user_learning_paths
     WHERE user_id = ?
       AND learning_path_id = ?
     LIMIT 1`,
    [userId, learningPathId],
  );

  if (existing) {
    await runStatement(
      db,
      `UPDATE user_learning_paths
       SET status = 'active',
           started_at = COALESCE(started_at, ?),
           current_module_id = COALESCE(current_module_id, ?)
       WHERE id = ?`,
      [new Date().toISOString(), firstModule?.id ?? null, existing.id],
    );
  } else {
    await runStatement(
      db,
      `INSERT INTO user_learning_paths
        (id, user_id, learning_path_id, status, progress_pct, started_at, completed_at, current_module_id)
       VALUES (?, ?, ?, 'active', 0, ?, NULL, ?)`,
      [randomId(), userId, learningPathId, new Date().toISOString(), firstModule?.id ?? null],
    );
  }

  await logActivity(db, {
    userId,
    eventType: 'learning_path_enrolled',
    entityType: 'learning_path',
    entityId: learningPathId,
  });

  return getLearningPathById(db, userId, learningPathId);
};

export const getModuleById = async (db: D1Database, moduleId: string) => {
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
     WHERE module_id = ?
     ORDER BY title ASC`,
    [moduleId],
  );

  return {
    id: module.id,
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
      acceptanceCriteria: safeJsonParse<string[]>(task.acceptance_criteria_json, []),
    })),
  };
};

export const submitTaskAttempt = async (
  env: AppBindings,
  db: D1Database,
  userId: string,
  payload: {
    taskId: string;
    submissionText?: string | null;
    submissionUrl?: string | null;
  },
) => {
  const task = await firstRow<{ id: string; title: string; instructions: string }>(
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

  const aiFeedback = await generateJsonWithAi<{
    summary?: string;
    suggestions?: string[];
  }>(env, {
    systemPrompt:
      'You are a concise learning mentor. Return JSON only with keys: summary (string) and suggestions (string[]).',
    userPrompt: JSON.stringify(
      {
        taskTitle: task.title,
        taskInstructions: task.instructions,
        submissionText: payload.submissionText ?? '',
        submissionUrl: payload.submissionUrl ?? '',
      },
      null,
      2,
    ),
  });

  const feedback = {
    summary:
      aiFeedback?.summary ??
      'Submission received. Keep iterating and focus on clarity, correctness, and testability.',
    suggestions: Array.isArray(aiFeedback?.suggestions) ? aiFeedback?.suggestions : [],
  };

  const attemptId = randomId();
  await runStatement(
    db,
    `INSERT INTO task_attempts
      (id, task_id, user_id, submission_text, submission_url, score, status, feedback_json, submitted_at)
     VALUES (?, ?, ?, ?, ?, NULL, 'submitted', ?, ?)`,
    [
      attemptId,
      payload.taskId,
      userId,
      payload.submissionText ?? null,
      payload.submissionUrl ?? null,
      JSON.stringify(feedback),
      new Date().toISOString(),
    ],
  );

  await logActivity(db, {
    userId,
    eventType: 'task_completed',
    entityType: 'task',
    entityId: payload.taskId,
  });

  const gamificationMessage = {
    type: 'task_completed' as const,
    userId,
    taskId: payload.taskId,
    attemptId,
    idempotencyKey: `task_completed:${userId}:${attemptId}`,
  };

  try {
    await enqueueGamificationEvent(env, {
      ...gamificationMessage,
    });
  } catch (error) {
    console.error('Unable to enqueue gamification task event', error);
  }

  // Keep point updates responsive even when queue processing is delayed.
  await processGamificationQueueMessage(db, gamificationMessage);

  return {
    id: attemptId,
    taskId: payload.taskId,
    userId,
    submissionText: payload.submissionText ?? null,
    submissionUrl: payload.submissionUrl ?? null,
    status: 'submitted',
    feedback,
  };
};
