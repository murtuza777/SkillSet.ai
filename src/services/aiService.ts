import type { AppBindings } from '../types';
import { generateJsonWithAi } from './ai-service';
import type { YoutubeVideoResource } from './youtubeService';

export interface DocResource {
  title: string;
  url: string;
  source: string;
}

export interface LearningPathLesson {
  type: 'video' | 'doc';
  title: string;
  url: string;
  task: string;
  xp: number;
}

export interface LearningPathModule {
  title: string;
  lessons: LearningPathLesson[];
}

const MIN_XP = 5;
const MAX_XP = 50;

const DEFAULT_PROMPT =
  'Convert the following learning resources into a structured, gamified learning path with modules, lessons, and tasks. Ensure progression from beginner to advanced. Include practical coding tasks and assign XP for each lesson.';

const fallbackPath = (
  topic: string,
  videos: YoutubeVideoResource[],
  docs: DocResource[],
): LearningPathModule[] => {
  const beginnerVideo = videos[0];
  const intermediateVideo = videos[1] ?? videos[0];
  const advancedVideo = videos[2] ?? videos[1] ?? videos[0];
  const coreDoc = docs[0];
  const deepDoc = docs[1] ?? docs[0];
  const referenceDoc = docs[2] ?? docs[1] ?? docs[0];

  return [
    {
      title: `${topic} Basics`,
      lessons: [
        {
          type: 'doc',
          title: coreDoc?.title ?? `${topic} fundamentals documentation`,
          url: coreDoc?.url ?? `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(topic)}`,
          task: `Read the basics and write 5 key concepts of ${topic} in your own words.`,
          xp: 10,
        },
        {
          type: 'video',
          title: beginnerVideo?.title ?? `${topic} beginner tutorial`,
          url: beginnerVideo?.url ?? `https://www.youtube.com/results?search_query=${encodeURIComponent(topic)}+beginner+tutorial`,
          task: `Build a tiny starter project using ${topic} and share one screenshot plus a short explanation.`,
          xp: 15,
        },
      ],
    },
    {
      title: `${topic} Practical Skills`,
      lessons: [
        {
          type: 'doc',
          title: deepDoc?.title ?? `${topic} intermediate guide`,
          url: deepDoc?.url ?? `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(topic)}+guide`,
          task: `Implement one intermediate pattern from the docs and explain why it is useful.`,
          xp: 20,
        },
        {
          type: 'video',
          title: intermediateVideo?.title ?? `${topic} intermediate tutorial`,
          url:
            intermediateVideo?.url ??
            `https://www.youtube.com/results?search_query=${encodeURIComponent(topic)}+intermediate+tutorial`,
          task: `Follow the tutorial and refactor one part of the solution with your own improvement.`,
          xp: 25,
        },
      ],
    },
    {
      title: `${topic} Advanced Build`,
      lessons: [
        {
          type: 'doc',
          title: referenceDoc?.title ?? `${topic} advanced documentation`,
          url: referenceDoc?.url ?? `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(topic)}+advanced`,
          task: `Use an advanced concept from docs in a mini feature and write a short trade-off analysis.`,
          xp: 30,
        },
        {
          type: 'video',
          title: advancedVideo?.title ?? `${topic} advanced tutorial`,
          url:
            advancedVideo?.url ??
            `https://www.youtube.com/results?search_query=${encodeURIComponent(topic)}+advanced+tutorial`,
          task: `Ship a small end-to-end project showcasing advanced ${topic} techniques.`,
          xp: 35,
        },
      ],
    },
  ];
};

const normalizeXp = (value: number | undefined) => {
  if (!Number.isFinite(value)) {
    return 10;
  }
  return Math.min(MAX_XP, Math.max(MIN_XP, Math.round(value as number)));
};

const normalizeType = (value: string | undefined): 'video' | 'doc' => {
  if (value === 'doc') {
    return 'doc';
  }
  return 'video';
};

const isValidUrl = (value: string | undefined) => {
  if (!value) {
    return false;
  }
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export const generateStructuredLearningPath = async (
  env: AppBindings,
  payload: {
    topic: string;
    videos: YoutubeVideoResource[];
    docs: DocResource[];
    prompt?: string;
  },
): Promise<{ modules: LearningPathModule[] }> => {
  const aiJson = await generateJsonWithAi<{
    modules?: Array<{
      title?: string;
      lessons?: Array<{
        type?: string;
        title?: string;
        url?: string;
        task?: string;
        xp?: number;
      }>;
    }>;
  }>(env, {
    systemPrompt:
      'You are an expert curriculum designer. Return strict JSON only, with key "modules". Create progressive modules from beginner to advanced. Keep lessons short and actionable (Duolingo style). Every lesson must include a practical task and XP.',
    userPrompt: JSON.stringify(
      {
        instruction: payload.prompt ?? DEFAULT_PROMPT,
        topic: payload.topic,
        videos: payload.videos.map((video) => ({
          title: video.title,
          url: video.url,
          thumbnail: video.thumbnail,
          duration: video.duration,
        })),
        docs: payload.docs,
        outputSchema: {
          modules: [
            {
              title: 'string',
              lessons: [
                {
                  type: 'video | doc',
                  title: 'string',
                  url: 'string',
                  task: 'string',
                  xp: 'number',
                },
              ],
            },
          ],
        },
      },
      null,
      2,
    ),
  });

  const parsedModules = (aiJson?.modules ?? [])
    .map((module) => {
      if (!module?.title || !Array.isArray(module.lessons)) {
        return null;
      }

      const lessons = module.lessons
        .map((lesson) => {
          if (!lesson?.title || !lesson.task || !isValidUrl(lesson.url)) {
            return null;
          }

          return {
            type: normalizeType(lesson.type),
            title: lesson.title.trim(),
            url: lesson.url!.trim(),
            task: lesson.task.trim(),
            xp: normalizeXp(lesson.xp),
          } satisfies LearningPathLesson;
        })
        .filter((lesson): lesson is LearningPathLesson => lesson !== null);

      if (lessons.length === 0) {
        return null;
      }

      return {
        title: module.title.trim(),
        lessons,
      } satisfies LearningPathModule;
    })
    .filter((module): module is LearningPathModule => module !== null);

  if (parsedModules.length > 0) {
    return { modules: parsedModules };
  }

  return {
    modules: fallbackPath(payload.topic, payload.videos, payload.docs),
  };
};
