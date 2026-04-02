import type { AppBindings } from '../types';

const extractText = (response: unknown): string => {
  if (!response || typeof response !== 'object') {
    return '';
  }

  if ('response' in response && typeof response.response === 'string') {
    return response.response;
  }

  if ('result' in response && typeof response.result === 'object' && response.result) {
    const result = response.result as Record<string, unknown>;
    if (typeof result.response === 'string') {
      return result.response;
    }
  }

  if ('text' in response && typeof response.text === 'string') {
    return response.text;
  }

  return '';
};

export const generateJsonWithAi = async <T>(
  env: AppBindings,
  payload: {
    systemPrompt: string;
    userPrompt: string;
  },
) => {
  const response = (await env.AI.run(env.AI_TEXT_MODEL as never, {
    messages: [
      {
        role: 'system',
        content: payload.systemPrompt,
      },
      {
        role: 'user',
        content: payload.userPrompt,
      },
    ],
    response_format: {
      type: 'json_object',
    },
  } as never)) as unknown;

  const text = extractText(response);

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

export const embedTexts = async (env: AppBindings, texts: string[]) => {
  const response = (await env.AI.run(env.AI_EMBEDDING_MODEL as never, {
    text: texts,
  } as never)) as unknown;

  if (!response || typeof response !== 'object') {
    return [];
  }

  if ('data' in response && Array.isArray(response.data)) {
    return response.data.map((item) => {
      if (item && typeof item === 'object' && 'embedding' in item && Array.isArray(item.embedding)) {
        return item.embedding as number[];
      }
      return [];
    });
  }

  if ('shape' in response && 'data' in response && Array.isArray(response.data)) {
    const data = response.data as number[];
    const shape = Array.isArray((response as { shape?: unknown }).shape)
      ? ((response as { shape: number[] }).shape as number[])
      : [];
    const width = shape[1] ?? 0;
    if (!width) {
      return [];
    }
    const vectors: number[][] = [];
    for (let index = 0; index < data.length; index += width) {
      vectors.push(data.slice(index, index + width));
    }
    return vectors;
  }

  return [];
};
