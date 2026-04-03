import type { AppBindings } from '../types';

export interface YoutubeVideoResource {
  id: string;
  title: string;
  url: string;
  thumbnail: string | null;
  duration: string | null;
}

const toDurationLabel = (isoDuration: string | undefined) => {
  if (!isoDuration) {
    return null;
  }

  const match = isoDuration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) {
    return null;
  }

  const hours = Number.parseInt(match[1] ?? '0', 10);
  const minutes = Number.parseInt(match[2] ?? '0', 10);
  const seconds = Number.parseInt(match[3] ?? '0', 10);
  const chunks: string[] = [];

  if (hours > 0) chunks.push(`${hours}h`);
  if (minutes > 0) chunks.push(`${minutes}m`);
  if (seconds > 0 && hours === 0) chunks.push(`${seconds}s`);

  return chunks.length > 0 ? chunks.join(' ') : null;
};

const pickThumbnail = (snippet: { thumbnails?: Record<string, { url?: string } | undefined> } | undefined) => {
  const thumbnails = snippet?.thumbnails;
  if (!thumbnails) {
    return null;
  }

  return thumbnails.maxres?.url ?? thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null;
};

export const fetchYoutubeLearningVideos = async (
  env: AppBindings,
  topic: string,
  limit = 8,
): Promise<{ videos: YoutubeVideoResource[] }> => {
  if (!env.YOUTUBE_API_KEY) {
    return { videos: [] };
  }

  try {
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', String(limit));
    searchUrl.searchParams.set('q', `${topic} tutorial beginner to advanced`);
    searchUrl.searchParams.set('key', env.YOUTUBE_API_KEY);

    const searchResponse = await fetch(searchUrl.toString());
    if (!searchResponse.ok) {
      return { videos: [] };
    }

    const searchJson = (await searchResponse.json()) as {
      items?: Array<{
        id?: { videoId?: string };
        snippet?: {
          title?: string;
          thumbnails?: Record<string, { url?: string }>;
        };
      }>;
    };

    const videoIds = (searchJson.items ?? [])
      .map((item) => item.id?.videoId)
      .filter((videoId): videoId is string => Boolean(videoId));

    if (videoIds.length === 0) {
      return { videos: [] };
    }

    const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    detailsUrl.searchParams.set('part', 'contentDetails,snippet');
    detailsUrl.searchParams.set('id', videoIds.join(','));
    detailsUrl.searchParams.set('key', env.YOUTUBE_API_KEY);

    const detailsResponse = await fetch(detailsUrl.toString());
    if (!detailsResponse.ok) {
      const fallbackVideos: YoutubeVideoResource[] = [];
      for (const item of searchJson.items ?? []) {
        const id = item.id?.videoId;
        if (!id || !item.snippet?.title) {
          continue;
        }
        fallbackVideos.push({
          id,
          title: item.snippet.title,
          url: `https://www.youtube.com/watch?v=${id}`,
          thumbnail: pickThumbnail(item.snippet),
          duration: null,
        });
      }

      return {
        videos: fallbackVideos,
      };
    }

    const detailsJson = (await detailsResponse.json()) as {
      items?: Array<{
        id?: string;
        snippet?: {
          title?: string;
          thumbnails?: Record<string, { url?: string }>;
        };
        contentDetails?: {
          duration?: string;
        };
      }>;
    };

    const videos = (detailsJson.items ?? [])
      .map((item) => {
        if (!item.id || !item.snippet?.title) {
          return null;
        }

        return {
          id: item.id,
          title: item.snippet.title,
          url: `https://www.youtube.com/watch?v=${item.id}`,
          thumbnail: pickThumbnail(item.snippet),
          duration: toDurationLabel(item.contentDetails?.duration),
        };
      })
      .filter((video): video is YoutubeVideoResource => video !== null);

    return { videos };
  } catch (error) {
    console.error('YouTube fetch failed', error);
    return { videos: [] };
  }
};
