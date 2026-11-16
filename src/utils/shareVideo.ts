import { KingdomVideo } from '../types/kingdom.ts';

export const APP_TOAST_EVENT = 'kingdom-app-toast';

export function emitAppToast(message: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APP_TOAST_EVENT, { detail: message }));
}

export function buildVideoDeepLink(
  video: Pick<KingdomVideo, 'id' | 'youtube_video_id'>
): string {
  if (typeof window === 'undefined') return '';
  const targetId = video.youtube_video_id || video.id;
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?v=${encodeURIComponent(targetId)}`;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }
  return false;
}

export async function shareKingdomVideo(
  video: KingdomVideo
): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = buildVideoDeepLink(video);
  const speaker = video.artist_name || video.channel_title || 'KINGDOM+';
  const isLive = Boolean(video.is_live_now && video.live_broadcast_content === 'live');
  const inviteText = isLive
    ? `Watch LIVE now on KINGDOM+: "${video.title}" by ${speaker}`
    : `Be blessed by "${video.title}" by ${speaker} on KINGDOM+:`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: `${video.title} · KINGDOM+`,
        text: inviteText,
        url,
      });
      return 'shared';
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return 'cancelled';
      }
      // Fall through to clipboard copy if share fails
    }
  }

  const copied = await copyTextToClipboard(`${inviteText}\n${url}`);
  if (copied) {
    emitAppToast('Link copied — ready to share on WhatsApp!');
    return 'copied';
  }
  return 'cancelled';
}

export async function shareDailyVerse(
  verseText: string,
  verseRef: string
): Promise<'shared' | 'copied' | 'cancelled'> {
  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : '';
  const text = `Today's Word on KINGDOM+:\n"${verseText}" — ${verseRef}\nJoin me on the Daily Altar:`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: `Verse of the Day · ${verseRef}`,
        text,
        url,
      });
      return 'shared';
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  const copied = await copyTextToClipboard(`${text} ${url}`);
  if (copied) {
    emitAppToast('Verse copied — ready to share on WhatsApp!');
    return 'copied';
  }
  return 'cancelled';
}
