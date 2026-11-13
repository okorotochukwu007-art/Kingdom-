import { KingdomVideo } from '../types/kingdom.ts';

export type DataSaverPreference = 'auto' | 'on' | 'off';

export interface DataSaverStatus {
  preference: DataSaverPreference;
  isDataSaverActive: boolean;
  deviceSaveData: boolean;
  effectiveType: string | null;
}

const STORAGE_KEY = 'kingdom_plus_data_saver_pref';
export const DATA_SAVER_EVENT = 'kingdom-data-saver-change';

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
}

export function getNetworkConnection(): NetworkInformationLike | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };
  return nav.connection || nav.mozConnection || nav.webkitConnection || null;
}

export function getSavedDataSaverPreference(): DataSaverPreference {
  if (typeof window === 'undefined') return 'auto';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'on' || raw === 'off' || raw === 'auto') {
      return raw;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'auto';
}

export function saveDataSaverPreference(pref: DataSaverPreference): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Ignore storage access errors
  }
  window.dispatchEvent(new CustomEvent(DATA_SAVER_EVENT, { detail: pref }));
}

export function getDataSaverStatus(): DataSaverStatus {
  const preference = getSavedDataSaverPreference();
  const conn = getNetworkConnection();
  const deviceSaveData = Boolean(conn?.saveData);
  const effectiveType = typeof conn?.effectiveType === 'string' ? conn.effectiveType : null;
  const isSlowNetwork = effectiveType === 'slow-2g' || effectiveType === '2g';

  const isDataSaverActive =
    preference === 'on'
      ? true
      : preference === 'off'
      ? false
      : deviceSaveData || isSlowNetwork;

  return {
    preference,
    isDataSaverActive,
    deviceSaveData,
    effectiveType,
  };
}

/**
 * Downgrades YouTube i.ytimg.com thumbnails to 16:9 mqdefault.jpg (~8-15KB) on grid cards
 * and hqdefault.jpg (~30KB) on hero banners when Data-Saver Mode is active.
 */
export function getOptimizedThumbnailUrl(
  video: Pick<KingdomVideo, 'thumbnail_high_url' | 'thumbnail_maxres_url' | 'youtube_video_id'> | null | undefined,
  dataSaverActive: boolean,
  slot: 'card' | 'hero' | 'mini' = 'card'
): string {
  if (!video) return '';

  const standardCard = video.thumbnail_high_url || video.thumbnail_maxres_url || '';
  const standardHero = video.thumbnail_maxres_url || video.thumbnail_high_url || '';

  if (!dataSaverActive) {
    return slot === 'hero' ? standardHero : standardCard;
  }

  if (slot === 'hero') {
    return video.thumbnail_high_url || video.thumbnail_maxres_url || '';
  }

  const candidate = standardCard;
  if (candidate && candidate.includes('i.ytimg.com/vi/')) {
    return candidate.replace(/\/(maxresdefault|sddefault|hqdefault|hq720)\.jpg(\?.*)?$/i, '/mqdefault.jpg$2');
  }

  if (video.youtube_video_id) {
    return `https://i.ytimg.com/vi/${encodeURIComponent(video.youtube_video_id)}/mqdefault.jpg`;
  }

  return candidate;
}

/**
 * Downsizes heavy 800x800 channel avatars to crisp 176x176 on Data-Saver Mode (~90% smaller).
 */
export function getOptimizedAvatarUrl(
  avatarUrl: string | null | undefined,
  dataSaverActive: boolean
): string {
  if (!avatarUrl) return '';
  if (!dataSaverActive) return avatarUrl;

  if (avatarUrl.includes('yt3.ggpht.com') || avatarUrl.includes('googleusercontent.com')) {
    return avatarUrl.replace(/=s(800|512|400|240)-/i, '=s176-');
  }
  return avatarUrl;
}
