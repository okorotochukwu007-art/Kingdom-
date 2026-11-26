import React, { useMemo, useState } from 'react';
import {
  Disc3,
  Headphones,
  Music,
  Play,
  Radio,
  Search,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { KingdomChannel, KingdomVideo } from '../types/kingdom.ts';
import { useDataSaver } from '../hooks/useDataSaver.ts';
import { getOptimizedAvatarUrl, getOptimizedThumbnailUrl } from '../utils/dataSaver.ts';

interface NonStopWorshipAudioStripProps {
  videos: KingdomVideo[];
  channels: KingdomChannel[];
  onSelectVideo: (video: KingdomVideo) => void;
  onOpenWorshipSanctuary: () => void;
  onOpenCategorySearch: (query: string, categorySlug: string) => void;
}

function isStrictlyMusicOrWorshipSong(v: KingdomVideo): boolean {
  if (!v || !v.is_official_verified) return false;
  const title = (v.title || '').toLowerCase();
  const category = (v.primary_category_slug || '').toLowerCase();
  
  const isSermonOrSpeech = /\b(sermon|preaching|teaching|nsppd|hallelujah challenge|covenant hour|prayer altar|midnight prayer|prophetic declaration|interview|podcast|podcast clip)\b/i.test(title);
  if (isSermonOrSpeech && category !== 'gospel-music' && category !== 'worship-praise') {
    return false;
  }

  return (
    category === 'worship-praise' ||
    category === 'gospel-music' ||
    v.channel_type === 'artist' ||
    /\b(worship|praise|song|audio|lyrics|official video|live worship|medley|anthem|gospel|hymn|chords|rejoice|alleluia|hallelujah|mix|playlist)\b/i.test(title)
  );
}

export const NonStopWorshipAudioStrip: React.FC<NonStopWorshipAudioStripProps> = ({
  videos,
  channels,
  onSelectVideo,
  onOpenWorshipSanctuary,
  onOpenCategorySearch,
}) => {
  const { isDataSaverActive } = useDataSaver();
  const [selectedMood, setSelectedMood] = useState<'all' | 'deep' | 'praise' | 'spontaneous' | 'live'>('all');
  const [audioSearchQuery, setAudioSearchQuery] = useState('');

  const strictAudioSongs = useMemo(() => {
    return videos
      .filter((v) => isStrictlyMusicOrWorshipSong(v))
      .sort((a, b) => {
        const aLong = (a.duration_seconds || 0) >= 2700 ? 1 : 0;
        const bLong = (b.duration_seconds || 0) >= 2700 ? 1 : 0;
        if (aLong !== bLong) return bLong - aLong;
        return b.view_count - a.view_count;
      });
  }, [videos]);

  const filteredAudioSongs = useMemo(() => {
    let list = strictAudioSongs;
    if (audioSearchQuery.trim()) {
      const q = audioSearchQuery.trim().toLowerCase();
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.channel_title.toLowerCase().includes(q) ||
          (v.artist_name && v.artist_name.toLowerCase().includes(q))
      );
    }

    if (selectedMood === 'deep') {
      return list.filter(
        (v) =>
          v.worship_subcategories?.includes('deep-worship') ||
          /deep|soaking|intimate|altar|presence|holy|hour/i.test(v.title)
      );
    }
    if (selectedMood === 'praise') {
      return list.filter(
        (v) =>
          v.worship_subcategories?.includes('high-praise-celebration') ||
          v.worship_subcategories?.includes('thanksgiving-songs') ||
          /praise|celebration|rejoice|dance|thanksgiving|victory|mercy chinwo|moses bliss|mix/i.test(v.title)
      );
    }
    if (selectedMood === 'spontaneous') {
      return list.filter(
        (v) =>
          v.worship_subcategories?.includes('spontaneous-worship') ||
          /spontaneous|unscripted|flow|chant/i.test(v.title)
      );
    }
    if (selectedMood === 'live') {
      return list.filter(
        (v) =>
          v.worship_subcategories?.includes('live-worship-sessions') ||
          /live|concert|experience|session/i.test(v.title)
      );
    }
    return list;
  }, [strictAudioSongs, selectedMood, audioSearchQuery]);

  const topAudioArtists = useMemo(() => {
    const artistSongCounts = new Map<string, number>();
    for (const v of strictAudioSongs) {
      if (v.channel_id) {
        artistSongCounts.set(v.channel_id, (artistSongCounts.get(v.channel_id) || 0) + 1);
      }
    }
    return channels
      .filter(
        (ch) =>
          ch.is_approved_worship_artist ||
          ch.channel_type === 'artist' ||
          artistSongCounts.has(ch.id)
      )
      .sort((a, b) => (artistSongCounts.get(b.id) || 0) - (artistSongCounts.get(a.id) || 0))
      .slice(0, 16);
  }, [channels, strictAudioSongs]);

  const handleStartSpotifyRadio = (specificSong?: KingdomVideo) => {
    const target = specificSong || filteredAudioSongs[0] || strictAudioSongs[0];
    if (target) {
      onSelectVideo(target);
    }
  };

  const handleAudioSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (audioSearchQuery.trim()) {
      onOpenCategorySearch(audioSearchQuery.trim(), 'gospel-music');
    }
  };

  return (
    <section className="relative w-full rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#121814] via-[#101014] to-[#0A0A0C] border border-[#1DB954]/30 p-4 sm:p-6 overflow-hidden shadow-2xl">
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#1DB954]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative w-12 h-12 rounded-full bg-[#1DB954]/20 border border-[#1DB954]/50 flex items-center justify-center text-[#1DB954] shrink-0 shadow-lg">
              <Disc3 className="w-6 h-6 animate-spin" style={{ animationDuration: '8s' }} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#1DB954] font-bold mb-0.5">
                <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                <span>24/7 Non-Stop Long-Play Gospel &amp; Worship Mix (45m+)</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
                Continuous Non-Stop Audio Playlist
              </h2>
            </div>
          </div>

          <form
            onSubmit={handleAudioSearchSubmit}
            className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-700/80 rounded-full px-4 py-2.5 w-full lg:max-w-md shadow-inner"
          >
            <Search className="w-4 h-4 text-[#1DB954] shrink-0" />
            <input
              type="text"
              value={audioSearchQuery}
              onChange={(e) => setAudioSearchQuery(e.target.value)}
              placeholder="Search music to explore on categories page..."
              className="bg-transparent text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none w-full"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#1DB954] hover:bg-[#1ed760] text-zinc-950 text-xs font-bold rounded-full transition-colors whitespace-nowrap shrink-0 shadow-md"
            >
              Browse Music
            </button>
          </form>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-zinc-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {[
              { id: 'all', label: '🔥 45m+ Long-Play Mixes' },
              { id: 'deep', label: '🕊️ Deep Soaking (1hr+)' },
              { id: 'praise', label: '🙌 High Praise Medley' },
              { id: 'spontaneous', label: '✨ Spontaneous Flow' },
              { id: 'live', label: '⛪ Live Worship Nights' },
            ].map((mood) => (
              <button
                key={mood.id}
                type="button"
                onClick={() => setSelectedMood(mood.id as any)}
                className={`px-3.5 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  selectedMood === mood.id
                    ? 'bg-[#1DB954] text-zinc-950 font-bold shadow-lg'
                    : 'bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
                }`}
              >
                {mood.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleStartSpotifyRadio()}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-zinc-950 text-xs sm:text-sm font-bold transition-all shadow-[0_6px_24px_rgba(29,185,84,0.45)] active:scale-95 whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Play Non-Stop Mix ({filteredAudioSongs.length} Tracks)</span>
            </button>
            <button
              type="button"
              onClick={onOpenWorshipSanctuary}
              className="px-4 py-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap"
            >
              Music Category →
            </button>
          </div>
        </div>

        <div className="pt-2">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Top Gospel Artists Radio &amp; Long-Play Mixes
          </div>
          <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar pb-2">
            {topAudioArtists.map((artist) => {
              const artistAvatar = getOptimizedAvatarUrl(artist.avatar_url, isDataSaverActive);
              const artistSongs = strictAudioSongs.filter((v) => v.channel_id === artist.id);
              return (
                <button
                  key={artist.id}
                  type="button"
                  onClick={() => {
                    onOpenCategorySearch(artist.title, 'gospel-music');
                  }}
                  className="flex flex-col items-center gap-2 group shrink-0 w-20 text-center"
                >
                  <div className="relative w-16 h-16 rounded-full overflow-hidden bg-zinc-800 border-2 border-[#1DB954]/50 group-hover:border-[#1DB954] transition-all shadow-md">
                    <img
                      src={artistAvatar}
                      alt={artist.title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-5 h-5 text-white fill-current" />
                    </div>
                  </div>
                  <div className="w-full">
                    <div className="text-xs font-semibold text-zinc-200 group-hover:text-[#1DB954] truncate">
                      {(artist.speaker_name || artist.title).split('(')[0].trim()}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500">
                      {artistSongs.length} songs
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
