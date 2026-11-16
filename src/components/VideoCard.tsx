import React, { useState } from 'react';
import { Bookmark, Check, Play, Radio, Share2 } from 'lucide-react';
import { KingdomVideo } from '../types/kingdom.ts';
import {
  formatCompactNumber,
  formatDurationSeconds,
  formatRelativeDate,
} from '../utils/formatters.ts';
import { useDataSaver } from '../hooks/useDataSaver.ts';
import {
  getOptimizedAvatarUrl,
  getOptimizedThumbnailUrl,
} from '../utils/dataSaver.ts';
import { shareKingdomVideo } from '../utils/shareVideo.ts';

interface VideoCardProps {
  video: KingdomVideo;
  onSelect: (video: KingdomVideo) => void;
  isSaved: boolean;
  onToggleSave: (videoId: string, e: React.MouseEvent) => void;
  watchProgressSeconds?: number;
  watchDurationSeconds?: number;
  onSelectChannel?: (channelId: string) => void;
}

const VideoCardComponent: React.FC<VideoCardProps> = ({
  video,
  onSelect,
  isSaved,
  onToggleSave,
  watchProgressSeconds,
  watchDurationSeconds,
  onSelectChannel,
}) => {
  const [imgError, setImgError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [justShared, setJustShared] = useState(false);
  const { isDataSaverActive } = useDataSaver();

  const isGenuinelyLive = Boolean(
    video.is_live_now && video.live_broadcast_content === 'live'
  );
  const durationText = formatDurationSeconds(video.duration_seconds || watchDurationSeconds);
  const progressPercent =
    watchProgressSeconds && (video.duration_seconds || watchDurationSeconds)
      ? Math.min(
          100,
          Math.round(
            (watchProgressSeconds / (video.duration_seconds || watchDurationSeconds || 1)) * 100
          )
        )
      : 0;

  // Concise single-label kicker (avoids stacking Category + Long Subcategory + Country)
  const conciseKicker =
    (video.primary_category_slug === 'worship-praise' ||
      video.primary_category_slug === 'christian-living') &&
    video.subcategory_label
      ? video.subcategory_label
      : video.primary_category_name;

  const cardThumbSrc = getOptimizedThumbnailUrl(video, isDataSaverActive, 'card');
  const avatarSrc = getOptimizedAvatarUrl(video.channel_avatar_url, isDataSaverActive);

  return (
    <article
      onClick={() => onSelect(video)}
      className="group cursor-pointer flex flex-col bg-[#121215] border border-zinc-800/80 rounded-2xl overflow-hidden transition-colors duration-150 hover:border-amber-500/40 active:scale-[0.99]"
    >
      {/* 16:9 Thumbnail Frame */}
      <div className="relative aspect-video w-full bg-zinc-900 overflow-hidden">
        {!imgError && cardThumbSrc ? (
          <img
            src={cardThumbSrc}
            alt={video.title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.currentTarget;
              const fallbackUrl = video.thumbnail_high_url || video.thumbnail_maxres_url;
              if (fallbackUrl && target.src !== fallbackUrl) {
                target.src = fallbackUrl;
              } else {
                setImgError(true);
              }
            }}
            className="w-full h-full object-cover md:transition-transform md:duration-200 md:group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-amber-950/30 p-4 text-center">
            <Play className="w-8 h-8 text-amber-400/80 mb-2" />
            <span className="text-xs text-zinc-400 line-clamp-2">{video.title}</span>
          </div>
        )}

        {/* Crisp subtle bottom-edge scrim so thumbnails stay bright & vibrant */}
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/65 to-transparent pointer-events-none" />

        {/* Play overlay button on desktop hover */}
        <div className="hidden md:flex absolute inset-0 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <div className="w-11 h-11 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center shadow-lg">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>

        {/* Genuinely Live Broadcast Indicator */}
        {isGenuinelyLive && (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-600 text-white text-[11px] font-semibold tracking-wide">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>LIVE</span>
          </span>
        )}

        {/* Top-Right Quick Actions: Share & Bookmark (Comfortable 36-40px mobile touch targets) */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              const outcome = await shareKingdomVideo(video);
              if (outcome !== 'cancelled') {
                setJustShared(true);
                window.setTimeout(() => setJustShared(false), 1800);
              }
            }}
            title="Share via WhatsApp or Messages"
            aria-label={`Share ${video.title}`}
            className="w-9 h-9 rounded-xl bg-black/75 hover:bg-black/90 text-zinc-200 flex items-center justify-center transition-colors"
          >
            {justShared ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={(e) => onToggleSave(video.id, e)}
            title={isSaved ? 'Remove from Saved Videos' : 'Save to Watchlist'}
            className="w-9 h-9 rounded-xl bg-black/75 hover:bg-black/90 text-zinc-200 flex items-center justify-center transition-colors"
          >
            {isSaved ? (
              <Check className="w-4 h-4 text-amber-400" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Bottom-right duration text if recorded */}
        {!isGenuinelyLive && durationText && (
          <span className="absolute bottom-2 right-2.5 text-[11px] font-mono tabular-nums text-zinc-100 bg-black/80 px-1.5 py-0.5 rounded">
            {durationText}
          </span>
        )}

        {/* Continue watching progress bar */}
        {progressPercent > 0 && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-zinc-800">
            <div
              className="h-full bg-amber-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Content Details — Clean, Concise, Mobile-Friendly */}
      <div className="p-3.5 sm:p-4 flex flex-col flex-1 justify-between gap-2.5">
        <div>
          <div className="text-[11px] font-medium text-amber-400/90 mb-1 truncate">
            {conciseKicker}
          </div>

          <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug">
            {video.title}
          </h3>
        </div>

        <div className="pt-2 border-t border-zinc-800/70 flex items-center justify-between gap-2">
          {/* Minister / Artist Attribution */}
          <div className="flex items-center gap-2 min-w-0">
            {!avatarError && avatarSrc ? (
              <img
                src={avatarSrc}
                alt={video.artist_name || video.channel_title}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-5 h-5 rounded-full object-cover bg-zinc-800 shrink-0"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-zinc-800 text-amber-400 text-[10px] font-semibold flex items-center justify-center shrink-0">
                {(video.artist_name || video.channel_title).charAt(0)}
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                if (onSelectChannel) {
                  e.stopPropagation();
                  onSelectChannel(video.channel_id);
                }
              }}
              className="text-xs font-medium text-zinc-300 hover:text-amber-400 transition-colors truncate text-left"
            >
              {video.artist_name || video.channel_title}
            </button>
          </div>

          {/* Concise Stats Row */}
          <div className="flex items-center gap-1 text-[11px] text-zinc-400 font-mono tabular-nums shrink-0">
            <span>{formatCompactNumber(video.view_count)} views</span>
            <span aria-hidden="true">·</span>
            <span className="font-sans text-zinc-500">
              {formatRelativeDate(video.published_at)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};

export const VideoCard = React.memo(VideoCardComponent);
