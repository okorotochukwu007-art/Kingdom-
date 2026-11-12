import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Flag,
  Heart,
  Maximize,
  Maximize2,
  MessageSquare,
  Minimize,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  Reply,
  RotateCcw,
  RotateCw,
  Send,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { KingdomVideo, UserProfile, VideoComment } from '../types/kingdom.ts';
import {
  formatCompactNumber,
  formatDurationSeconds,
  formatRelativeDate,
  getBrowserSupabaseClient,
} from '../utils/formatters.ts';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YouTubePlayerModalProps {
  video: KingdomVideo;
  allVideos: KingdomVideo[];
  currentUser: UserProfile | null;
  authToken: string | null;
  isSaved: boolean;
  isMinimized: boolean;
  initialProgressSeconds?: number;
  onToggleMinimize: (minimized: boolean) => void;
  onClose: () => void;
  onSelectVideo: (video: KingdomVideo) => void;
  onToggleSave: (videoId: string, e: React.MouseEvent) => void;
  onProgressUpdate: (videoId: string, progressSeconds: number, durationSeconds: number) => void;
  onVideoUnavailable: (videoId: string) => void;
  onRequireAuth: () => void;
  onNavigateWhileListening?: (destination: 'community' | 'categories' | 'ministers') => void;
  onOpenChannelWhileListening?: (channelId: string) => void;
}

const LOCAL_COMMENTS_PREFIX = 'kingdom_plus_comments_v1_';

function loadLocalVideoComments(videoId: string): VideoComment[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_COMMENTS_PREFIX}${videoId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // Ignore storage error
  }
  return [];
}

function saveLocalVideoComments(videoId: string, comments: VideoComment[]): void {
  try {
    localStorage.setItem(`${LOCAL_COMMENTS_PREFIX}${videoId}`, JSON.stringify(comments));
  } catch {
    // Ignore storage error
  }
}

export const YouTubePlayerModal: React.FC<YouTubePlayerModalProps> = ({
  video,
  allVideos,
  currentUser,
  authToken,
  isSaved,
  isMinimized,
  initialProgressSeconds = 0,
  onToggleMinimize,
  onClose,
  onSelectVideo,
  onToggleSave,
  onProgressUpdate,
  onVideoUnavailable,
  onRequireAuth,
  onNavigateWhileListening,
  onOpenChannelWhileListening,
}) => {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const iframeElementRef = useRef<HTMLIFrameElement | null>(null);
  const fullscreenWrapperRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<any>(null);
  const progressTimerRef = useRef<number | null>(null);

  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [hasStartedPlayback, setHasStartedPlayback] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(initialProgressSeconds || 0);
  const [duration, setDuration] = useState<number>(video.duration_seconds || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [autoPlayNext, setAutoPlayNext] = useState<boolean>(true);
  const [isCompactMini, setIsCompactMini] = useState<boolean>(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(false);
  const [streamRetryCount, setStreamRetryCount] = useState<number>(0);

  const [comments, setComments] = useState<VideoComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);

  const relatedVideos = React.useMemo(() => {
    const primaryMatches = allVideos.filter(
      (v) =>
        v.id !== video.id &&
        (v.primary_category_slug === video.primary_category_slug || v.channel_id === video.channel_id)
    );
    if (primaryMatches.length >= 6) return primaryMatches.slice(0, 6);
    const seenIds = new Set(primaryMatches.map((v) => v.id));
    const extras = allVideos.filter((v) => v.id !== video.id && !seenIds.has(v.id));
    return [...primaryMatches, ...extras].slice(0, 6);
  }, [allVideos, video.id, video.primary_category_slug, video.channel_id]);

  const isLoopingRef = useRef(isLooping);
  isLoopingRef.current = isLooping;
  const autoPlayNextRef = useRef(autoPlayNext);
  autoPlayNextRef.current = autoPlayNext;
  const nextVideoRef = useRef<KingdomVideo | undefined>(relatedVideos[0]);
  nextVideoRef.current = relatedVideos[0];

  const sendIframeCommand = (func: string, args: unknown[] = []) => {
    try {
      iframeElementRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        '*'
      );
    } catch {
      // Ignore cross-origin postMessage errors
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsNativeFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Load comments for this video (Server API first, Cloudflare localStorage + Supabase fallback)
  useEffect(() => {
    setPlayerError(null);
    setIsPlaying(false);
    setHasStartedPlayback(false);
    setCurrentTime(initialProgressSeconds || 0);
    setDuration(video.duration_seconds || 0);

    const loadComments = async () => {
      const localComments = loadLocalVideoComments(video.id);
      if (localComments.length > 0) {
        setComments(localComments);
      } else {
        setComments([]);
      }

      try {
        const res = await fetch(`/api/videos/${video.id}/comments`);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data.comments)) {
            setComments(data.comments);
            saveLocalVideoComments(video.id, data.comments);
            return;
          }
        }
      } catch {
        // Ignore network error on static hosting
      }

      try {
        const sb = getBrowserSupabaseClient(
          (window as any).__KINGDOM_SUPABASE_URL__ || null,
          (window as any).__KINGDOM_SUPABASE_KEY__ || null
        );
        if (sb) {
          const { data } = await sb
            .from('video_comments')
            .select('*')
            .eq('video_id', video.id)
            .eq('is_hidden', false)
            .order('created_at', { ascending: false })
            .limit(50);
          if (Array.isArray(data) && data.length > 0) {
            setComments(data as VideoComment[]);
            saveLocalVideoComments(video.id, data as VideoComment[]);
          }
        }
      } catch {
        // Ignore if comments table uses strict UUID foreign key
      }
    };

    loadComments();
  }, [video.id]);

  // Listen for iframe postMessage telemetry as backup for YT API state/time updates
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (typeof ev.data !== 'string' || !ev.origin.includes('youtube')) return;
      try {
        const payload = JSON.parse(ev.data);
        const info = payload?.info;
        if (!info || typeof info !== 'object') return;
        if (typeof info.playerState === 'number') {
          if (info.playerState === 1 || info.playerState === 3) {
            setIsPlaying(true);
            setHasStartedPlayback(true);
          } else if (info.playerState === 2 || info.playerState === 0 || info.playerState === 5) {
            setIsPlaying(false);
          }
        }
        if (typeof info.currentTime === 'number' && !Number.isNaN(info.currentTime)) {
          setCurrentTime(info.currentTime);
        }
        if (typeof info.duration === 'number' && info.duration > 0) {
          setDuration(info.duration);
        }
      } catch {
        // Ignore non-JSON frames
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Initialize Native KINGDOM+ Media Stream Engine with direct iframe mount + YT API binding
  useEffect(() => {
    let isMounted = true;
    const container = playerContainerRef.current;
    if (!container) return;

    container.innerHTML = '';
    iframeElementRef.current = null;

    const startSec = initialProgressSeconds > 10 ? Math.floor(initialProgressSeconds) : 0;
    const embedParams = new URLSearchParams({
      autoplay: '1',
      enablejsapi: '1',
      controls: '0',
      disablekb: '1',
      fs: '0',
      rel: '0',
      modestbranding: '1',
      iv_load_policy: '3',
      playsinline: '1',
      start: String(startSec),
      origin: window.location.origin,
      widget_referrer: window.location.origin,
    });

    const iframe = document.createElement('iframe');
    iframe.id = `kp-stream-${video.youtube_video_id}-${streamRetryCount}`;
    iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(
      video.youtube_video_id
    )}?${embedParams.toString()}`;
    iframe.title = video.title;
    iframe.className = 'w-full h-full border-0';
    iframe.allow =
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.setAttribute('playsinline', '1');
    iframe.setAttribute('webkit-playsinline', '1');
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';

    container.appendChild(iframe);
    iframeElementRef.current = iframe;

    const initPlayer = () => {
      if (!isMounted || !iframeElementRef.current || !window.YT || !window.YT.Player) return;

      if (playerInstanceRef.current) {
        try {
          playerInstanceRef.current.destroy();
        } catch {}
        playerInstanceRef.current = null;
      }

      try {
        playerInstanceRef.current = new window.YT.Player(iframeElementRef.current, {
          events: {
            onReady: (event: any) => {
              if (!isMounted) return;
              try {
                const player = event.target;
                const dur = player?.getDuration?.() || video.duration_seconds || 0;
                if (dur > 0) setDuration(dur);
                setIsMuted(Boolean(player?.isMuted?.()));
                player?.playVideo?.();
              } catch {}

              if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
              progressTimerRef.current = window.setInterval(() => {
                try {
                  const player = event.target;
                  if (player && typeof player.getCurrentTime === 'function') {
                    const cur = player.getCurrentTime();
                    const dur = player.getDuration() || video.duration_seconds || 0;
                    const pState = player.getPlayerState?.();
                    if (pState === 1 || pState === 3) {
                      setIsPlaying(true);
                      setHasStartedPlayback(true);
                    }
                    setCurrentTime(cur);
                    if (dur > 0) setDuration(dur);
                    if (cur > 3 && dur > 0) {
                      onProgressUpdate(video.id, cur, dur);
                    }
                  }
                } catch {}
              }, 1000);
            },
            onStateChange: (event: any) => {
              if (!isMounted) return;
              const state = event?.data;
              if (state === 1 || state === 3) {
                setIsPlaying(true);
                setHasStartedPlayback(true);
              } else if (state === 2 || state === 5 || state === -1) {
                setIsPlaying(false);
              } else if (state === 0) {
                setIsPlaying(false);
                if (isLoopingRef.current && playerInstanceRef.current) {
                  try {
                    playerInstanceRef.current.seekTo(0, true);
                    playerInstanceRef.current.playVideo();
                    setIsPlaying(true);
                  } catch {}
                } else if (autoPlayNextRef.current && nextVideoRef.current) {
                  onSelectVideo(nextVideoRef.current);
                }
              }
            },
            onError: (event: any) => {
              if (!isMounted) return;
              const code = event?.data;
              if (code === 100 || code === 101 || code === 150 || code === 153) {
                setPlayerError(
                  'This broadcast stream is currently unavailable. Try refreshing the stream or play the next broadcast below.'
                );
                onVideoUnavailable(video.id);
              }
            },
          },
        });
      } catch {
        // Iframe still works via postMessage commands even if YT wrapper throws
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const existingScript = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
      );
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        initPlayer();
      };
    }

    return () => {
      isMounted = false;
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
      }
      if (playerInstanceRef.current) {
        try {
          playerInstanceRef.current.destroy();
        } catch {}
        playerInstanceRef.current = null;
      }
      if (container) {
        container.innerHTML = '';
      }
      iframeElementRef.current = null;
    };
  }, [video.youtube_video_id, video.id, streamRetryCount]);

  // Player Control Helpers
  const togglePlayPause = () => {
    const player = playerInstanceRef.current;
    try {
      const state = typeof player?.getPlayerState === 'function' ? player.getPlayerState() : null;
      const currentlyPlaying = state !== null ? state === 1 || state === 3 : isPlaying;
      if (currentlyPlaying) {
        player?.pauseVideo?.();
        sendIframeCommand('pauseVideo');
        setIsPlaying(false);
      } else {
        player?.playVideo?.();
        sendIframeCommand('playVideo');
        setIsPlaying(true);
        setHasStartedPlayback(true);
      }
    } catch {
      if (isPlaying) {
        sendIframeCommand('pauseVideo');
        setIsPlaying(false);
      } else {
        sendIframeCommand('playVideo');
        setIsPlaying(true);
        setHasStartedPlayback(true);
      }
    }
  };

  const toggleNativeFullscreen = async () => {
    const el = fullscreenWrapperRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> }) | null;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        if (typeof el.requestFullscreen === 'function') {
          await el.requestFullscreen();
        } else if (typeof el.webkitRequestFullscreen === 'function') {
          await el.webkitRequestFullscreen();
        } else {
          setIsNativeFullscreen((prev) => !prev);
        }
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setIsNativeFullscreen((prev) => !prev);
    }
  };

  const skipBySeconds = (delta: number) => {
    const player = playerInstanceRef.current;
    const baseCur = typeof player?.getCurrentTime === 'function' ? player.getCurrentTime() : currentTime;
    const target = Math.max(0, Math.min(duration || baseCur + delta, baseCur + delta));
    setCurrentTime(target);
    try {
      player?.seekTo?.(target, true);
    } catch {}
    sendIframeCommand('seekTo', [target, true]);
  };

  const handleSeekBarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = Number(e.target.value);
    setCurrentTime(target);
    const player = playerInstanceRef.current;
    try {
      player?.seekTo?.(target, true);
    } catch {}
    sendIframeCommand('seekTo', [target, true]);
  };

  const toggleMute = () => {
    const player = playerInstanceRef.current;
    try {
      if (isMuted) {
        player?.unMute?.();
        sendIframeCommand('unMute');
        setIsMuted(false);
      } else {
        player?.mute?.();
        sendIframeCommand('mute');
        setIsMuted(true);
      }
    } catch {}
  };

  const cyclePlaybackSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    const player = playerInstanceRef.current;
    try {
      player?.setPlaybackRate?.(nextSpeed);
    } catch {}
    sendIframeCommand('setPlaybackRate', [nextSpeed]);
  };

  const playNextRelated = () => {
    if (relatedVideos.length > 0) {
      onSelectVideo(relatedVideos[0]);
    }
  };

  const handlePostComment = async (parentCommentId: string | null = null) => {
    if (!currentUser || !authToken) {
      onRequireAuth();
      return;
    }
    const text = parentCommentId ? replyText.trim() : newComment.trim();
    if (!text) return;

    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/videos/${video.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          content: text,
          parentCommentId,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.comment) {
          setComments((prev) => {
            const next = [data.comment, ...prev];
            saveLocalVideoComments(video.id, next);
            return next;
          });
          if (parentCommentId) {
            setReplyText('');
            setReplyingToId(null);
          } else {
            setNewComment('');
          }
          return;
        }
      }

      // Cloudflare static fallback (local + Supabase cloud)
      const localComment: VideoComment = {
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        video_id: video.id,
        user_id: currentUser.id,
        user_full_name: currentUser.full_name,
        user_username: currentUser.username,
        user_avatar_url: currentUser.avatar_url || undefined,
        user_role: currentUser.role,
        parent_comment_id: parentCommentId || null,
        content: text,
        likes_count: 0,
        liked_by_user_ids: [],
        is_flagged: false,
        is_hidden: false,
        created_at: new Date().toISOString(),
      };

      setComments((prev) => {
        const next = [localComment, ...prev];
        saveLocalVideoComments(video.id, next);
        return next;
      });
      if (parentCommentId) {
        setReplyText('');
        setReplyingToId(null);
      } else {
        setNewComment('');
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!currentUser || !authToken) {
      onRequireAuth();
      return;
    }
    try {
      const res = await fetch(`/api/comments/${commentId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.comment) {
          setComments((prev) => {
            const next = prev.map((c) => (c.id === commentId ? data.comment : c));
            saveLocalVideoComments(video.id, next);
            return next;
          });
          return;
        }
      }
    } catch {
      // Fallback to local toggle on static hosting
    }

    setComments((prev) => {
      const next = prev.map((c) => {
        if (c.id !== commentId) return c;
        const alreadyLiked = c.liked_by_user_ids.includes(currentUser.id);
        const updatedLikes = alreadyLiked
          ? c.liked_by_user_ids.filter((uid) => uid !== currentUser.id)
          : [...c.liked_by_user_ids, currentUser.id];
        return {
          ...c,
          liked_by_user_ids: updatedLikes,
          likes_count: updatedLikes.length,
        };
      });
      saveLocalVideoComments(video.id, next);
      return next;
    });
  };

  const handleReportItem = async (
    targetType: 'video' | 'comment',
    targetId: string,
    summary: string
  ) => {
    if (!currentUser || !authToken) {
      onRequireAuth();
      return;
    }
    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          targetType,
          targetId,
          targetSummary: summary,
          reason: 'Flagged by community member for editorial review',
        }),
      });
    } catch {
      // Ignore on static hosting
    }
    try {
      const sb = getBrowserSupabaseClient(
        (window as any).__KINGDOM_SUPABASE_URL__ || null,
        (window as any).__KINGDOM_SUPABASE_KEY__ || null
      );
      if (sb) {
        await sb.from('moderation_reports').insert({
          reporter_id: currentUser.id,
          target_type: targetType,
          target_id: targetId,
          reason: 'Flagged by community member for editorial review',
          details: summary,
        });
      }
    } catch {
      // Ignore if FK constraint fails
    }
    setReportFeedback('Report submitted to KINGDOM+ moderators.');
    setTimeout(() => setReportFeedback(null), 4000);
  };

  const topLevelComments = comments.filter((c) => !c.parent_comment_id);
  const getReplies = (parentId: string) =>
    comments
      .filter((c) => c.parent_comment_id === parentId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <div
      className={
        isMinimized
          ? 'fixed z-50 bottom-[62px] md:bottom-5 right-2 left-2 sm:left-auto sm:right-5 sm:w-[370px] lg:w-[410px] bg-[#121215]/95 backdrop-blur-xl border border-zinc-700/90 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300'
          : 'fixed inset-0 z-50 bg-black/95 backdrop-blur-md overflow-y-auto'
      }
    >
      <div
        className={
          isMinimized
            ? 'flex flex-col'
            : 'min-h-screen max-w-[1440px] mx-auto px-4 sm:px-8 py-4 sm:py-6 flex flex-col gap-5'
        }
      >
        {/* ====================================================================
            THEATER HEADER BAR (Hidden when in Floating Mini-Player Mode)
        ==================================================================== */}
        <div
          className={
            isMinimized
              ? 'hidden'
              : 'flex items-center justify-between gap-3 border-b border-zinc-800 pb-3.5'
          }
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-display text-base sm:text-lg font-semibold text-amber-400 shrink-0">
              KINGDOM+
            </span>
            <span className="text-zinc-600" aria-hidden="true">
              /
            </span>
            <span className="text-xs text-zinc-400 truncate hidden sm:inline">
              {video.primary_category_name}
            </span>
            <span className="text-zinc-600 hidden sm:inline" aria-hidden="true">
              /
            </span>
            <span className="text-xs text-zinc-200 font-medium truncate">{video.title}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onToggleMinimize(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-medium border border-amber-500/30 transition-colors whitespace-nowrap"
              title="Minimize to Floating Mini-Player to keep listening while browsing"
            >
              <PictureInPicture2 className="w-4 h-4" />
              <span>Mini-Player</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium border border-zinc-800 transition-colors whitespace-nowrap"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Close</span>
            </button>
          </div>
        </div>

        {!isMinimized && reportFeedback && (
          <div className="px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            {reportFeedback}
          </div>
        )}

        {/* ====================================================================
            PERSISTENT NATIVE KINGDOM+ VIDEO CONTAINER
            NOTE: The underlying iframe is scaled & pointer-events-shielded so zero
            external logos, titles, watermarks, or links can ever be seen or clicked!
        ==================================================================== */}
        <div
          className={
            isMinimized
              ? 'flex flex-col'
              : 'grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start'
          }
        >
          <div className={isMinimized ? 'flex flex-col' : 'lg:col-span-8 flex flex-col gap-5'}>
            <div
              ref={fullscreenWrapperRef}
              className={
                isMinimized
                  ? isCompactMini
                    ? 'flex items-center gap-3 p-2.5'
                    : 'flex flex-col'
                  : `flex flex-col gap-3 ${isNativeFullscreen ? 'bg-black justify-center p-4' : ''}`
              }
            >
              {/* THE SHIELDED & CROPPED STREAM CONTAINER */}
              <div
                className={
                  isMinimized
                    ? isCompactMini
                      ? 'relative w-24 sm:w-28 aspect-video rounded-lg overflow-hidden bg-black border border-zinc-800 shrink-0 select-none'
                      : 'relative aspect-video w-full bg-black border-b border-zinc-800 overflow-hidden select-none'
                    : 'relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-zinc-800 shadow-2xl select-none'
                }
              >
                {playerError ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-zinc-950 gap-3">
                    <AlertTriangle className="w-8 h-8 text-amber-400" />
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-zinc-100">Broadcast Stream Unavailable</p>
                      <p className="text-[11px] text-zinc-400 max-w-sm mt-0.5">{playerError}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPlayerError(null);
                          setStreamRetryCount((c) => c + 1);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs font-semibold transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retry Stream</span>
                      </button>
                      {relatedVideos.length > 0 && (
                        <button
                          type="button"
                          onClick={playNextRelated}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors shadow-lg"
                        >
                          <SkipForward className="w-3.5 h-3.5" />
                          <span>Play Next Broadcast</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Scaled wrapper crops out any top/bottom embed chrome & disables iframe clicks */
                  <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none scale-[1.16] origin-center">
                    <div ref={playerContainerRef} className="w-full h-full pointer-events-none" />
                  </div>
                )}

                {/* NATIVE KINGDOM+ CLICK/TOUCH SHIELD (Intercepts all clicks so user stays inside KINGDOM+) */}
                {!playerError && (
                  <div
                    onClick={togglePlayPause}
                    onDoubleClick={toggleNativeFullscreen}
                    onContextMenu={(e) => e.preventDefault()}
                    className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center"
                    title={isPlaying ? 'Tap to Pause' : 'Tap to Play'}
                  >
                    {/* Subtle KINGDOM+ Watermark Badge in Top-Left */}
                    {!isCompactMini && (
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/65 backdrop-blur-md border border-zinc-800/80 flex items-center gap-1.5 pointer-events-none z-20">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span className="font-display text-[10px] font-bold tracking-wider text-amber-400">
                          KINGDOM+ STREAM
                        </span>
                      </div>
                    )}

                    {/* Native KINGDOM+ Pause / Ready Screen Overlay */}
                    {!isPlaying && (
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 p-4 text-center transition-opacity">
                        {!hasStartedPlayback && currentTime < 1 && (video.thumbnail_maxres_url || video.thumbnail_high_url) && (
                          <img
                            src={video.thumbnail_maxres_url || video.thumbnail_high_url}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full object-cover opacity-40 -z-10"
                          />
                        )}
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center shadow-2xl">
                          <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-0.5" />
                        </div>
                        {!isCompactMini && (
                          <div className="max-w-md mt-1">
                            <div className="text-xs sm:text-sm font-semibold text-zinc-100 line-clamp-1">
                              {video.title}
                            </div>
                            <div className="text-[11px] text-amber-400 mt-0.5">
                              {video.artist_name || video.channel_title} ·{' '}
                              {hasStartedPlayback || currentTime > 1 ? 'Tap to Resume' : 'Tap to Play'}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Overlay Expand Button on PIP Video Corner when Minimized */}
                {isMinimized && !isCompactMini && (
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 z-20">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCompactMini(true);
                      }}
                      className="p-1.5 rounded-lg bg-black/75 hover:bg-black text-zinc-200 border border-zinc-700/80 backdrop-blur-md transition-colors"
                      title="Collapse to Compact Audio Bar"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMinimize(false);
                      }}
                      className="p-1.5 rounded-lg bg-black/75 hover:bg-black text-amber-400 border border-zinc-700/80 backdrop-blur-md transition-colors"
                      title="Expand to Full Theater"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                      }}
                      className="p-1.5 rounded-lg bg-black/75 hover:bg-black text-zinc-300 border border-zinc-700/80 backdrop-blur-md transition-colors"
                      title="Close Player"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* ==============================================================
                  FLOATING MINI-PLAYER CONTROLS (Shown when isMinimized === true)
              ============================================================== */}
              {isMinimized && (
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  {isCompactMini ? (
                    /* COMPACT SINGLE-ROW AUDIO BAR FOR MOBILE & DESKTOP */
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => onToggleMinimize(false)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="text-xs font-semibold text-zinc-100 truncate">
                          {video.title}
                        </div>
                        <div className="text-[11px] text-amber-400 truncate">
                          {video.artist_name || video.channel_title}
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={togglePlayPause}
                          className="w-9 h-9 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center hover:bg-amber-400 transition-colors"
                          aria-label={isPlaying ? 'Pause' : 'Play'}
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCompactMini(false)}
                          className="w-8 h-8 rounded-lg bg-zinc-900 text-zinc-300 hover:text-zinc-100 flex items-center justify-center border border-zinc-800"
                          title="Show PIP Video"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleMinimize(false)}
                          className="w-8 h-8 rounded-lg bg-zinc-900 text-amber-400 hover:bg-zinc-800 flex items-center justify-center border border-zinc-800"
                          title="Expand to Theater"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={onClose}
                          className="w-8 h-8 rounded-lg bg-zinc-900 text-zinc-400 hover:text-zinc-200 flex items-center justify-center border border-zinc-800"
                          title="Close Player"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* FULL PIP MINI-PLAYER DOCK WITH SCRUBBER & TRANSPORT CONTROLS */
                    <div className="p-3 flex flex-col gap-2.5">
                      {!video.is_live_now && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono tabular-nums text-zinc-400">
                            {formatDurationSeconds(Math.floor(currentTime)) || '0:00'}
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={Math.max(1, duration)}
                            value={Math.min(currentTime, Math.max(1, duration))}
                            onChange={handleSeekBarChange}
                            className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                          <span className="text-[10px] font-mono tabular-nums text-zinc-400">
                            {formatDurationSeconds(Math.floor(duration)) || '0:00'}
                          </span>
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleMinimize(false)}
                          className="min-w-0 flex-1 text-left group"
                        >
                          <div className="text-xs font-semibold text-zinc-100 truncate group-hover:text-amber-300 transition-colors">
                            {video.title}
                          </div>
                          <div className="text-[11px] text-zinc-400 truncate">
                            {video.artist_name || video.channel_title}
                          </div>
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-1 pt-0.5">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => skipBySeconds(-10)}
                            className="p-2 rounded-lg text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
                            title="Rewind 10s"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={togglePlayPause}
                            className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center transition-colors shadow"
                            title={isPlaying ? 'Pause' : 'Play'}
                          >
                            {isPlaying ? (
                              <Pause className="w-4 h-4 fill-current" />
                            ) : (
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => skipBySeconds(10)}
                            className="p-2 rounded-lg text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
                            title="Forward 10s"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>

                          {relatedVideos.length > 0 && (
                            <button
                              type="button"
                              onClick={playNextRelated}
                              className="p-2 rounded-lg text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
                              title={`Next: ${relatedVideos[0].title}`}
                            >
                              <SkipForward className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setIsLooping((prev) => !prev)}
                            className={`p-2 rounded-lg border text-xs transition-colors ${
                              isLooping
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                            }`}
                            title="Loop / Repeat"
                          >
                            <Repeat className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={cyclePlaybackSpeed}
                            className="px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300 hover:text-zinc-100"
                            title="Playback Speed"
                          >
                            {playbackSpeed}x
                          </button>

                          <button
                            type="button"
                            onClick={() => setIsCompactMini(true)}
                            className="px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 hover:text-zinc-100"
                            title="Compact Audio Bar"
                          >
                            Audio Bar
                          </button>

                          <button
                            type="button"
                            onClick={() => onToggleMinimize(false)}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[11px] font-medium text-amber-300 hover:bg-amber-500/25"
                          >
                            Expand
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ==============================================================
                  THEATER NATIVE KINGDOM+ CONTROL BAR & MULTITASKING STRIP
              ============================================================== */}
              {!isMinimized && (
                <div className="p-3 sm:p-3.5 rounded-xl bg-[#121215] border border-zinc-800/90 flex flex-col gap-2.5">
                  {/* Interactive Scrubbing Bar (or Live Indicator for Real-Time Broadcasts) */}
                  {video.is_live_now ? (
                    <div className="flex items-center justify-between gap-3 px-1">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span>LIVE STREAM IN PROGRESS</span>
                      </span>
                      <span className="text-xs font-mono text-zinc-400">
                        {video.subcategory_label || 'Real-Time Broadcast'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono tabular-nums text-zinc-300 w-12 text-right">
                        {formatDurationSeconds(Math.floor(currentTime)) || '0:00'}
                      </span>
                      <div className="relative flex-1 flex items-center">
                        <input
                          type="range"
                          min={0}
                          max={Math.max(1, duration)}
                          value={Math.min(currentTime, Math.max(1, duration))}
                          onChange={handleSeekBarChange}
                          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>
                      <span className="text-xs font-mono tabular-nums text-zinc-400 w-12">
                        {formatDurationSeconds(Math.floor(duration)) || '0:00'}
                      </span>
                    </div>
                  )}

                  {/* Transport & Multitasking Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={togglePlayPause}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors"
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="w-3.5 h-3.5 fill-current" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Play</span>
                          </>
                        )}
                      </button>

                      {!video.is_live_now && (
                        <>
                          <button
                            type="button"
                            onClick={() => skipBySeconds(-10)}
                            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs border border-zinc-800 transition-colors"
                            title="Rewind 10 seconds"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>-10s</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => skipBySeconds(10)}
                            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs border border-zinc-800 transition-colors"
                            title="Forward 10 seconds"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>+10s</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={toggleMute}
                        className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
                        title={isMuted ? 'Unmute' : 'Mute'}
                      >
                        {isMuted ? (
                          <VolumeX className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>

                      {!video.is_live_now && (
                        <>
                          <button
                            type="button"
                            onClick={cyclePlaybackSpeed}
                            className="px-2.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-mono border border-zinc-800 transition-colors"
                            title="Change Playback Speed"
                          >
                            {playbackSpeed}x
                          </button>

                          <button
                            type="button"
                            onClick={() => setIsLooping((prev) => !prev)}
                            className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs border transition-colors ${
                              isLooping
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-medium'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                            }`}
                            title="Repeat / Loop current video"
                          >
                            <Repeat className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Loop</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={toggleNativeFullscreen}
                        className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs border border-zinc-800 transition-colors"
                        title="Toggle Fullscreen"
                      >
                        {isNativeFullscreen ? (
                          <Minimize className="w-3.5 h-3.5" />
                        ) : (
                          <Maximize className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">
                          {isNativeFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        </span>
                      </button>
                    </div>

                    {/* Keep Listening While Browsing / Chatting Shortcuts */}
                    <div className="flex items-center flex-wrap gap-1.5">
                      {onNavigateWhileListening && (
                        <>
                          <button
                            type="button"
                            onClick={() => onNavigateWhileListening('categories')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs border border-zinc-800 transition-colors"
                          >
                            <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                            <span>Browse Categories</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onNavigateWhileListening('community')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs border border-zinc-800 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                            <span>Chat in Community</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ================================================================
                THEATER VIDEO METADATA & RELATED VIDEOS (Hidden when Minimized)
            ================================================================ */}
            {!isMinimized && (
              <>
                <div className="flex flex-col gap-4 pb-5 border-b border-zinc-800">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-amber-400">
                    <span>{video.primary_category_name}</span>
                    {video.subcategory_label && (
                      <>
                        <span aria-hidden="true" className="text-zinc-600">
                          ·
                        </span>
                        <span className="text-zinc-300">{video.subcategory_label}</span>
                      </>
                    )}
                  </div>

                  <h1 className="font-display text-xl sm:text-3xl font-semibold text-zinc-50 leading-tight">
                    {video.title}
                  </h1>

                  {/* Channel Attribution + Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                    <div
                      onClick={() => {
                        if (onOpenChannelWhileListening) {
                          onOpenChannelWhileListening(video.channel_id);
                        }
                      }}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-full bg-zinc-800 text-amber-400 font-semibold flex items-center justify-center overflow-hidden shrink-0">
                        {video.channel_avatar_url ? (
                          <img
                            src={video.channel_avatar_url}
                            alt={video.channel_title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          video.channel_title.charAt(0)
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors">
                          {video.artist_name || video.channel_title}
                        </div>
                        <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                          <span className="text-amber-400/90">KINGDOM+ Verified</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatCompactNumber(video.view_count)} views</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatRelativeDate(video.published_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={(e) => onToggleSave(video.id, e)}
                        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                          isSaved
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800'
                        }`}
                      >
                        {isSaved ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                        <span>{isSaved ? 'Saved' : 'Save'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReportItem('video', video.id, video.title)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 transition-colors whitespace-nowrap shrink-0"
                        title="Report video to moderators"
                      >
                        <Flag className="w-3.5 h-3.5" />
                        <span>Report</span>
                      </button>
                    </div>
                  </div>

                  {video.description && (
                    <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-line line-clamp-3">
                      {video.description}
                    </p>
                  )}
                </div>

                {/* Up Next & Related Videos in Category / Ministry */}
                {relatedVideos.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm sm:text-base font-semibold text-zinc-100">
                        Up Next from {video.channel_title} &amp; {video.primary_category_name}
                      </h2>
                      <label className="inline-flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoPlayNext}
                          onChange={(e) => setAutoPlayNext(e.target.checked)}
                          className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0"
                        />
                        <span>Auto-play next</span>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      {relatedVideos.map((rel) => (
                        <div
                          key={rel.id}
                          onClick={() => onSelectVideo(rel)}
                          className="group cursor-pointer rounded-lg border border-zinc-800/80 bg-zinc-900/40 overflow-hidden hover:border-amber-500/40 transition-colors"
                        >
                          <div className="aspect-video w-full bg-zinc-900 overflow-hidden">
                            <img
                              src={rel.thumbnail_high_url}
                              alt={rel.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                          <div className="p-2.5">
                            <div className="text-xs font-medium text-zinc-100 line-clamp-2 group-hover:text-amber-300">
                              {rel.title}
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-1 font-mono tabular-nums truncate">
                              {formatCompactNumber(rel.view_count)} views · {rel.channel_title}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right 4 Columns: Live Sermon & Video Discussion Thread (Hidden when Minimized) */}
          {!isMinimized && (
            <div className="lg:col-span-4 bg-[#121215] border border-zinc-800 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-semibold text-zinc-100">
                    Sermon &amp; Worship Discussion
                  </h2>
                </div>
                <span className="text-xs font-mono tabular-nums text-zinc-400">
                  {comments.length} {comments.length === 1 ? 'note' : 'notes'}
                </span>
              </div>

              {/* New Comment Input */}
              <div className="flex flex-col gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  placeholder={
                    currentUser
                      ? 'Share a takeaway, scripture, or testimony...'
                      : 'Sign in to share your reflection...'
                  }
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={submittingComment}
                    onClick={() => handlePostComment(null)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{currentUser ? 'Post Reflection' : 'Sign In'}</span>
                  </button>
                </div>
              </div>

              {/* Comments List */}
              <div className="flex flex-col gap-3 max-h-[460px] overflow-y-auto pr-1">
                {topLevelComments.length === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-500">
                    No reflections posted yet. Be the first to share a takeaway or scripture note.
                  </div>
                ) : (
                  topLevelComments.map((c) => {
                    const replies = getReplies(c.id);
                    const hasLiked = currentUser
                      ? c.liked_by_user_ids.includes(currentUser.id)
                      : false;

                    return (
                      <div
                        key={c.id}
                        className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/70 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-zinc-200 truncate">
                            {c.user_full_name}{' '}
                            <span className="font-normal text-zinc-500">@{c.user_username}</span>
                          </div>
                          <span className="text-[11px] text-zinc-500 shrink-0">
                            {formatRelativeDate(c.created_at)}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-300 leading-relaxed">{c.content}</p>

                        <div className="flex items-center gap-4 pt-1 text-[11px] text-zinc-400">
                          <button
                            type="button"
                            onClick={() => handleLikeComment(c.id)}
                            className={`inline-flex items-center gap-1 hover:text-amber-400 transition-colors font-mono tabular-nums ${
                              hasLiked ? 'text-amber-400' : ''
                            }`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-current' : ''}`} />
                            <span>{c.likes_count}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setReplyingToId(replyingToId === c.id ? null : c.id)}
                            className="inline-flex items-center gap-1 hover:text-zinc-200 transition-colors"
                          >
                            <Reply className="w-3.5 h-3.5" />
                            <span>Reply</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleReportItem('comment', c.id, c.content.slice(0, 60))
                            }
                            className="inline-flex items-center gap-1 hover:text-red-400 transition-colors ml-auto"
                          >
                            <Flag className="w-3 h-3" />
                            <span>Report</span>
                          </button>
                        </div>

                        {/* Reply Input */}
                        {replyingToId === c.id && (
                          <div className="mt-2 pt-2 border-t border-zinc-800 flex gap-2">
                            <input
                              type="text"
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Write a reply..."
                              className="flex-1 rounded bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => handlePostComment(c.id)}
                              className="px-3 py-1.5 rounded bg-amber-500 text-zinc-950 text-xs font-semibold whitespace-nowrap shrink-0"
                            >
                              Reply
                            </button>
                          </div>
                        )}

                        {/* Nested Replies */}
                        {replies.length > 0 && (
                          <div className="mt-2 pl-3 border-l border-zinc-800 flex flex-col gap-2">
                            {replies.map((rep) => (
                              <div key={rep.id} className="text-xs">
                                <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                                  <span>{rep.user_full_name}</span>
                                  <span className="text-zinc-500">·</span>
                                  <span className="text-[11px] text-zinc-500">
                                    {formatRelativeDate(rep.created_at)}
                                  </span>
                                </div>
                                <p className="text-zinc-400 mt-0.5">{rep.content}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
