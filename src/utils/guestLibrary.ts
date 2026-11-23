import { KingdomVideo, WatchHistoryEntry } from '../types/kingdom.ts';

const GUEST_SAVED_IDS_KEY = 'kingdom_plus_guest_saved_ids_v1';
const GUEST_SAVED_VIDEOS_MAP_KEY = 'kingdom_plus_guest_saved_videos_v1';
const GUEST_HISTORY_KEY = 'kingdom_plus_guest_history_v1';

const MAX_GUEST_HISTORY_ITEMS = 20;

export function loadGuestSavedVideoIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GUEST_SAVED_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  } catch {
    return [];
  }
}

export function loadGuestSavedVideosMap(): Record<string, KingdomVideo> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(GUEST_SAVED_VIDEOS_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, KingdomVideo>;
  } catch {
    return {};
  }
}

export function toggleGuestSavedVideo(
  videoId: string,
  videoObj?: KingdomVideo | null
): { nextIds: string[]; added: boolean } {
  const currentIds = loadGuestSavedVideoIds();
  const exists = currentIds.includes(videoId);
  const nextIds = exists
    ? currentIds.filter((id) => id !== videoId)
    : [videoId, ...currentIds];

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(GUEST_SAVED_IDS_KEY, JSON.stringify(nextIds));
      const map = loadGuestSavedVideosMap();
      if (exists) {
        delete map[videoId];
      } else if (videoObj) {
        map[videoId] = videoObj;
      }
      localStorage.setItem(GUEST_SAVED_VIDEOS_MAP_KEY, JSON.stringify(map));
    } catch {
      // Ignore browser storage quota errors cleanly
    }
  }

  return { nextIds, added: !exists };
}

export function loadGuestWatchHistory(catalogVideos: KingdomVideo[] = []): WatchHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GUEST_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const catalogById = new Map<string, KingdomVideo>();
    for (const v of catalogVideos) {
      catalogById.set(v.id, v);
    }

    const hydrated: WatchHistoryEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item.video_id !== 'string') continue;
      const freshVideo = catalogById.get(item.video_id) || item.video;
      if (!freshVideo) continue;
      hydrated.push({
        id: item.id || `guest-wh-${item.video_id}`,
        user_id: 'guest',
        video_id: item.video_id,
        progress_seconds: typeof item.progress_seconds === 'number' ? item.progress_seconds : 0,
        duration_seconds:
          typeof item.duration_seconds === 'number' && item.duration_seconds > 0
            ? item.duration_seconds
            : freshVideo.duration_seconds || 0,
        completed: Boolean(item.completed),
        last_watched_at: item.last_watched_at || new Date().toISOString(),
        video: freshVideo,
      });
    }

    return hydrated
      .sort(
        (a, b) =>
          new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime()
      )
      .slice(0, MAX_GUEST_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

export function upsertGuestWatchHistory(
  video: KingdomVideo,
  progressSeconds: number,
  durationSeconds: number,
  catalogVideos: KingdomVideo[] = []
): WatchHistoryEntry[] {
  const current = loadGuestWatchHistory(catalogVideos);
  const existing = current.find((entry) => entry.video_id === video.id);

  const effectiveDuration =
    durationSeconds > 0
      ? Math.round(durationSeconds)
      : existing?.duration_seconds || video.duration_seconds || 0;

  const effectiveProgress =
    progressSeconds > 0
      ? Math.round(progressSeconds)
      : existing?.progress_seconds || 0;

  const completed =
    effectiveDuration > 0 && effectiveProgress / effectiveDuration >= 0.92;

  const nextEntry: WatchHistoryEntry = {
    id: existing?.id || `guest-wh-${video.id}`,
    user_id: 'guest',
    video_id: video.id,
    progress_seconds: effectiveProgress,
    duration_seconds: effectiveDuration,
    completed,
    last_watched_at: new Date().toISOString(),
    video,
  };

  const nextList = [
    nextEntry,
    ...current.filter((entry) => entry.video_id !== video.id),
  ].slice(0, MAX_GUEST_HISTORY_ITEMS);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(nextList));
    } catch {
      // Ignore browser storage quota errors cleanly
    }
  }

  return nextList;
}
