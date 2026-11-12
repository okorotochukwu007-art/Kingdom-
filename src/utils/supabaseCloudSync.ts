import { KingdomVideo } from '../types/kingdom.ts';
import { getBrowserSupabaseClient } from './formatters.ts';

export interface BroadcastReminderSubscription {
  subscriberKey: string;
  userId?: string | null;
  email: string;
  whatsappPhone: string;
  webPushEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  advanceMinutes: number;
  programIds: string[];
  updatedAt: string;
}

const LOCAL_REMINDER_SUB_KEY = 'kingdom_plus_reminder_subscription_v1';

export function getOrCreateSubscriberKey(): string {
  try {
    let key = localStorage.getItem('kingdom_plus_subscriber_key');
    if (!key) {
      key = `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem('kingdom_plus_subscriber_key', key);
    }
    return key;
  } catch {
    return 'sub-default';
  }
}

export function loadLocalReminderSubscription(): BroadcastReminderSubscription {
  const subscriberKey = getOrCreateSubscriberKey();
  try {
    const raw = localStorage.getItem(LOCAL_REMINDER_SUB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        subscriberKey,
        email: parsed.email || '',
        whatsappPhone: parsed.whatsappPhone || '',
        webPushEnabled: parsed.webPushEnabled ?? true,
        emailEnabled: Boolean(parsed.emailEnabled),
        whatsappEnabled: Boolean(parsed.whatsappEnabled),
        advanceMinutes: Number(parsed.advanceMinutes) || 10,
        programIds: Array.isArray(parsed.programIds)
          ? parsed.programIds
          : ['sched-nsppd', 'sched-hallelujah-challenge'],
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }
  } catch {
    // Ignore parse error
  }

  let legacyIds = ['sched-nsppd', 'sched-hallelujah-challenge'];
  try {
    const rawIds = localStorage.getItem('kingdom_plus_broadcast_reminders');
    if (rawIds) legacyIds = JSON.parse(rawIds);
  } catch {
    // Ignore
  }

  return {
    subscriberKey,
    email: '',
    whatsappPhone: '',
    webPushEnabled: true,
    emailEnabled: false,
    whatsappEnabled: false,
    advanceMinutes: 10,
    programIds: legacyIds,
    updatedAt: new Date().toISOString(),
  };
}

export async function saveBroadcastReminderSubscription(
  sub: BroadcastReminderSubscription
): Promise<BroadcastReminderSubscription> {
  const updated: BroadcastReminderSubscription = {
    ...sub,
    subscriberKey: sub.subscriberKey || getOrCreateSubscriberKey(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Save to localStorage for instant offline/browser access
  try {
    localStorage.setItem(LOCAL_REMINDER_SUB_KEY, JSON.stringify(updated));
    localStorage.setItem('kingdom_plus_broadcast_reminders', JSON.stringify(updated.programIds));
  } catch {
    // Ignore storage error
  }

  // 2. Sync to Backend / Cloudflare Pages Edge API
  try {
    await fetch('/api/reminders/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  } catch {
    // Ignore network error
  }

  // 3. Direct Cloud Persistence to Supabase (if connected in browser)
  try {
    const sb = getBrowserSupabaseClient(
      (window as any).__KINGDOM_SUPABASE_URL__ || null,
      (window as any).__KINGDOM_SUPABASE_KEY__ || null
    );
    if (sb) {
      await sb.from('broadcast_reminders').upsert(
        {
          subscriber_key: updated.subscriberKey,
          user_id: updated.userId || null,
          email: updated.email,
          whatsapp_phone: updated.whatsappPhone,
          web_push_enabled: updated.webPushEnabled,
          email_enabled: updated.emailEnabled,
          whatsapp_enabled: updated.whatsappEnabled,
          advance_minutes: updated.advanceMinutes,
          program_ids: updated.programIds,
          updated_at: updated.updatedAt,
        },
        { onConflict: 'subscriber_key' }
      );
    }
  } catch {
    // Ignore if table not yet created in Supabase
  }

  return updated;
}

export async function syncDiscoveredVideoToSupabase(video: KingdomVideo): Promise<void> {
  try {
    const sb = getBrowserSupabaseClient(
      (window as any).__KINGDOM_SUPABASE_URL__ || null,
      (window as any).__KINGDOM_SUPABASE_KEY__ || null
    );
    if (!sb) return;
    await sb.from('discovered_videos').upsert(
      {
        youtube_video_id: video.youtube_video_id,
        video_payload: video,
        primary_category_slug: video.primary_category_slug,
      },
      { onConflict: 'youtube_video_id' }
    );
  } catch {
    // Ignore if table not yet created
  }
}

export async function fetchDiscoveredVideosFromSupabase(): Promise<KingdomVideo[]> {
  try {
    const sb = getBrowserSupabaseClient(
      (window as any).__KINGDOM_SUPABASE_URL__ || null,
      (window as any).__KINGDOM_SUPABASE_KEY__ || null
    );
    if (!sb) return [];
    const { data, error } = await sb
      .from('discovered_videos')
      .select('video_payload')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error || !Array.isArray(data)) return [];
    return data
      .map((row: any) => row.video_payload as KingdomVideo)
      .filter((v) => v && v.youtube_video_id && v.title);
  } catch {
    return [];
  }
}

// Synthesize a gentle Sanctuary Harmonic Chime using Web Audio API (no external MP3 needed)
export function playSanctuaryReminderChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);

      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.14 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 1.1);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 1.15);
    });
  } catch {
    // Ignore audio context restrictions
  }
}
