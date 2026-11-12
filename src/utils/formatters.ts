import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function formatCompactNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || Number.isNaN(num)) return '—';
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return num.toLocaleString();
}

export function formatDurationSeconds(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatRelativeDate(isoDate: string): string {
  const dateMs = new Date(isoDate).getTime();
  if (Number.isNaN(dateMs)) return '';
  const diffDays = Math.floor((Date.now() - dateMs) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Published today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return '1 month ago';
  if (diffMonths < 12) return `${diffMonths} months ago`;
  const diffYears = Math.floor(diffDays / 365);
  return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
}

let cachedSupabaseClient: SupabaseClient | null = null;

export function getBrowserSupabaseClient(url: string | null, anonKey: string | null): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!cachedSupabaseClient) {
    try {
      cachedSupabaseClient = createClient(url, anonKey);
    } catch {
      cachedSupabaseClient = null;
    }
  }
  return cachedSupabaseClient;
}
