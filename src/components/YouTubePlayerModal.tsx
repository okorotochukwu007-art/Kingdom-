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
  Share2,
  SkipForward,
  Subtitles,
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
import { useDataSaver } from '../hooks/useDataSaver.ts';
import {
  getDataSaverStatus,
  getOptimizedAvatarUrl,
  getOptimizedThumbnailUrl,
} from '../utils/dataSaver.ts';
import { shareKingdomVideo } from '../utils/shareVideo.ts';
import { recordDailyAltarActivity } from '../utils/dailyAltar.ts';

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
  const [isStartingStream, setIsStartingStream] = useState<boolean>(false);
  const [hasStartedPlayback, setHasStartedPlayback] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [autoplayMutedNotice, setAutoplayMutedNotice] = useState<boolean>(false);
  const [directTouchPassthrough, setDirectTouchPassthrough] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(initialProgressSeconds || 0);
  const [duration, setDuration] = useState<number>(video.duration_seconds || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [autoPlayNext, setAutoPlayNext] = useState<boolean>(true);
  const [isCompactMini, setIsCompactMini] = useState<boolean>(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(false);
  const [isRotatedLandscape, setIsRotatedLandscape] = useState<boolean>(false);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [justSharedVideo, setJustSharedVideo] = useState<boolean>(false);
  const hasRecordedAltarWatchRef = useRef<boolean>(false);
  const controlsHideTimerRef = useRef<number | null>(null);
  const [isStreamWarmingUp, setIsStreamWarmingUp] = useState<boolean>(false);
  const [introBannerShieldActive, setIntroBannerShieldActive] = useState<boolean>(false);
  const introShieldTimerRef = useRef<number | null>(null);
  const warmupTimerRef = useRef<number | null>(null);
  const playRescueTimerRef = useRef<number | null>(null);
  const playTouchFallbackTimerRef = useRef<number | null>(null);
  const actualPlayerStateRef = useRef<number>(-1);
  const lastProgressSyncRef = useRef<number>(0);
  const [streamRetryCount, setStreamRetryCount] = useState<number>(0);
  const [captionsEnabled, setCaptionsEnabled] = useState<boolean>(false);
  const [mobilePlayerTab, setMobilePlayerTab] = useState<'focus' | 'upnext' | 'comments' | 'overview'>('focus');

  // Native mobile gesture state: double-tap seek ripple & swipe-to-minimize drag
  const [doubleTapSeekBadge, setDoubleTapSeekBadge] = useState<{
    side: 'left' | 'right';
    seconds: number;
    key: number;
  } | null>(null);
  const doubleTapBadgeTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef<{ time: number; side: 'left' | 'center' | 'right' } | null>(null);
  const singleTapTimerRef = useRef<number | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipeJustHandledRef = useRef<boolean>(false);
  const [swipeDragY, setSwipeDragY] = useState<number>(0);
  const miniSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const wakeLockRef = useRef<any>(null);
  const lastMediaPosSyncRef = useRef<number>(0);

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

  const { isDataSaverActive } = useDataSaver();
  const isDataSaverActiveRef = useRef(isDataSaverActive);
  isDataSaverActiveRef.current = isDataSaverActive;

  const isLoopingRef = useRef(isLooping);
  isLoopingRef.current = isLooping;
  const autoPlayNextRef = useRef(autoPlayNext);
  autoPlayNextRef.current = autoPlayNext;
  const nextVideoRef = useRef<KingdomVideo | undefined>(relatedVideos[0]);
  nextVideoRef.current = relatedVideos[0];
  const skipBySecondsRef = useRef<(delta: number) => void>(() => {});
  const onSelectVideoRef = useRef(onSelectVideo);
  onSelectVideoRef.current = onSelectVideo;

  useEffect(() => {
    const player = playerInstanceRef.current;
    if (!player) return;
    try {
      player.setPlaybackQuality?.(isDataSaverActive ? 'medium' : 'default');
    } catch {}
  }, [isDataSaverActive]);

  // ============================================================================
  // 1. SCREEN WAKE LOCK DURING ACTIVE PLAYBACK (Prevents screen dimming/locking)
  // ============================================================================
  useEffect(() => {
    let cancelled = false;

    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
        } catch {}
        wakeLockRef.current = null;
      }
    };

    const requestWakeLock = async () => {
      if (
        cancelled ||
        !isPlaying ||
        playerError ||
        document.visibilityState !== 'visible'
      ) {
        return;
      }
      const wakeLockApi = (navigator as any).wakeLock;
      if (!wakeLockApi || typeof wakeLockApi.request !== 'function') return;
      if (wakeLockRef.current && !wakeLockRef.current.released) return;
      try {
        const sentinel = await wakeLockApi.request('screen');
        if (cancelled) {
          sentinel?.release?.().catch(() => {});
          return;
        }
        wakeLockRef.current = sentinel;
        sentinel.addEventListener?.('release', () => {
          if (wakeLockRef.current === sentinel) {
            wakeLockRef.current = null;
          }
        });
      } catch {
        // Browser or low-power mode denied wake lock; fail silently
      }
    };

    if (isPlaying && !playerError) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isPlaying && !playerError) {
        requestWakeLock();
      } else if (document.visibilityState === 'hidden') {
        releaseWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [isPlaying, playerError]);

  // ============================================================================
  // 2. LOCK-SCREEN & EARBUD CONTROLS (MediaSession API)
  // ============================================================================
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;

    const artwork: MediaImage[] = [];
    const mqThumb = getOptimizedThumbnailUrl(video, true, 'card');
    const hqThumb = video.thumbnail_high_url || '';
    if (mqThumb) {
      artwork.push({ src: mqThumb, sizes: '320x180', type: 'image/jpeg' });
    }
    if (hqThumb && hqThumb !== mqThumb) {
      artwork.push({ src: hqThumb, sizes: '480x360', type: 'image/jpeg' });
    }
    if (artwork.length === 0) {
      artwork.push({ src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' });
    }

    try {
      if (typeof window.MediaMetadata === 'function') {
        ms.metadata = new window.MediaMetadata({
          title: video.title,
          artist: video.artist_name || video.channel_title || 'KINGDOM+',
          album: video.primary_category_name || 'KINGDOM+',
          artwork,
        });
      }
    } catch {}

    const safeSetHandler = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null
    ) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // Unsupported action on this browser/OS
      }
    };

    safeSetHandler('play', () => {
      try {
        playerInstanceRef.current?.playVideo?.();
      } catch {}
      sendIframeCommand('playVideo');
      setIsPlaying(true);
    });

    safeSetHandler('pause', () => {
      try {
        playerInstanceRef.current?.pauseVideo?.();
      } catch {}
      sendIframeCommand('pauseVideo');
      setIsPlaying(false);
    });

    safeSetHandler('stop', () => {
      try {
        playerInstanceRef.current?.pauseVideo?.();
      } catch {}
      sendIframeCommand('pauseVideo');
      setIsPlaying(false);
    });

    safeSetHandler('seekbackward', (details) => {
      const offset = typeof details?.seekOffset === 'number' && details.seekOffset > 0
        ? details.seekOffset
        : 10;
      skipBySecondsRef.current(-offset);
    });

    safeSetHandler('seekforward', (details) => {
      const offset = typeof details?.seekOffset === 'number' && details.seekOffset > 0
        ? details.seekOffset
        : 10;
      skipBySecondsRef.current(offset);
    });

    safeSetHandler('seekto', (details) => {
      if (typeof details?.seekTime !== 'number' || video.is_live_now) return;
      const target = Math.max(0, details.seekTime);
      setCurrentTime(target);
      try {
        playerInstanceRef.current?.seekTo?.(target, true);
      } catch {}
      sendIframeCommand('seekTo', [target, true]);
    });

    safeSetHandler('nexttrack', () => {
      if (nextVideoRef.current) {
        onSelectVideoRef.current(nextVideoRef.current);
      }
    });

    return () => {
      const actions: MediaSessionAction[] = [
        'play',
        'pause',
        'stop',
        'seekbackward',
        'seekforward',
        'seekto',
        'nexttrack',
      ];
      for (const act of actions) {
        safeSetHandler(act, null);
      }
      try {
        ms.playbackState = 'none';
      } catch {}
    };
  }, [
    video.id,
    video.title,
    video.artist_name,
    video.channel_title,
    video.primary_category_name,
    video.thumbnail_high_url,
    video.youtube_video_id,
    video.is_live_now,
  ]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.playbackState = isPlaying
        ? 'playing'
        : hasStartedPlayback
        ? 'paused'
        : 'none';
    } catch {}
  }, [isPlaying, hasStartedPlayback]);

  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      typeof navigator.mediaSession.setPositionState !== 'function'
    ) {
      return;
    }
    if (video.is_live_now || !duration || duration <= 0) return;

    const now = Date.now();
    if (now - lastMediaPosSyncRef.current < 2000 && isPlaying) return;
    lastMediaPosSyncRef.current = now;

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: playbackSpeed || 1,
        position: Math.max(0, Math.min(duration, currentTime)),
      });
    } catch {}
  }, [currentTime, duration, playbackSpeed, isPlaying, video.is_live_now]);

  const clearPlaybackRescueTimers = () => {
    if (playRescueTimerRef.current) {
      window.clearTimeout(playRescueTimerRef.current);
      playRescueTimerRef.current = null;
    }
    if (playTouchFallbackTimerRef.current) {
      window.clearTimeout(playTouchFallbackTimerRef.current);
      playTouchFallbackTimerRef.current = null;
    }
  };

  const sendIframeCommand = (func: string, args: unknown[] = []) => {
    try {
      const targetIframe =
        iframeElementRef.current ||
        (playerContainerRef.current?.querySelector('iframe') as HTMLIFrameElement | null);
      targetIframe?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        '*'
      );
    } catch {
      // Ignore cross-origin postMessage errors
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      const fsActive = Boolean(document.fullscreenElement);
      setIsNativeFullscreen(fsActive);
      if (!fsActive) {
        setIsRotatedLandscape(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange as EventListener);
    };
  }, []);

  const revealControlsTemporarily = React.useCallback(() => {
    setControlsVisible(true);
    if (controlsHideTimerRef.current) {
      window.clearTimeout(controlsHideTimerRef.current);
    }
    controlsHideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 3200);
  }, []);

  const triggerIntroBannerShield = React.useCallback((withWarmupCurtain = false) => {
    setIntroBannerShieldActive(true);
    if (introShieldTimerRef.current) {
      window.clearTimeout(introShieldTimerRef.current);
    }
    introShieldTimerRef.current = window.setTimeout(() => {
      setIntroBannerShieldActive(false);
    }, 2800);

    if (withWarmupCurtain) {
      setIsStreamWarmingUp(true);
      if (warmupTimerRef.current) {
        window.clearTimeout(warmupTimerRef.current);
      }
      warmupTimerRef.current = window.setTimeout(() => {
        setIsStreamWarmingUp(false);
      }, 700);
    }
  }, []);

  useEffect(() => {
    if (isPlaying) {
      revealControlsTemporarily();
    } else {
      setControlsVisible(true);
      if (controlsHideTimerRef.current) {
        window.clearTimeout(controlsHideTimerRef.current);
      }
    }
    return () => {
      if (controlsHideTimerRef.current) {
        window.clearTimeout(controlsHideTimerRef.current);
      }
    };
  }, [isPlaying, revealControlsTemporarily]);

  useEffect(() => {
    if (isPlaying && !hasRecordedAltarWatchRef.current) {
      hasRecordedAltarWatchRef.current = true;
      recordDailyAltarActivity('watch', currentUser?.id);
    }
  }, [isPlaying, currentUser?.id]);

  // Load comments for this video (Server API first, localStorage + Supabase fallback)
  useEffect(() => {
    hasRecordedAltarWatchRef.current = false;
    setPlayerError(null);
    setIsPlaying(false);
    setIsStartingStream(false);
    setHasStartedPlayback(false);
    setAutoplayMutedNotice(false);
    setDirectTouchPassthrough(false);
    setIsStreamWarmingUp(false);
    setIntroBannerShieldActive(false);
    actualPlayerStateRef.current = -1;
    lastProgressSyncRef.current = 0;
    setCurrentTime(initialProgressSeconds || 0);
    setDuration(video.duration_seconds || 0);
    setMobilePlayerTab('focus');

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

    return () => {
      if (introShieldTimerRef.current) window.clearTimeout(introShieldTimerRef.current);
      if (warmupTimerRef.current) window.clearTimeout(warmupTimerRef.current);
      if (doubleTapBadgeTimerRef.current) window.clearTimeout(doubleTapBadgeTimerRef.current);
      if (singleTapTimerRef.current) window.clearTimeout(singleTapTimerRef.current);
      clearPlaybackRescueTimers();
    };
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
          actualPlayerStateRef.current = info.playerState;
          if (info.playerState === 1 || info.playerState === 3) {
            clearPlaybackRescueTimers();
            setIsPlaying(true);
            setIsStartingStream(false);
            setHasStartedPlayback(true);
            setDirectTouchPassthrough(false);
          } else if (info.playerState === 2 || info.playerState === 0 || info.playerState === 5) {
            setIsPlaying(false);
            setIsStartingStream(false);
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

  // Initialize Native KINGDOM+ Media Stream Engine
  // Uses YT.Player directly on a dedicated host div so postMessage listening ALWAYS succeeds,
  // with an automatic fallback direct iframe if iframe_api takes > 2s to load on slow networks.
  useEffect(() => {
    let isMounted = true;
    let fallbackTimer: number | null = null;
    const container = playerContainerRef.current;
    if (!container) return;

    container.innerHTML = '';
    iframeElementRef.current = null;
    actualPlayerStateRef.current = -1;

    const startSec = initialProgressSeconds > 10 ? Math.floor(initialProgressSeconds) : 0;

    const mountDirectFallbackIframe = () => {
      if (!isMounted || !playerContainerRef.current) return;
      if (playerContainerRef.current.querySelector('iframe')) return;

      const embedParams = new URLSearchParams({
        autoplay: '1',
        enablejsapi: '1',
        controls: '1',
        rel: '0',
        modestbranding: '1',
        iv_load_policy: '3',
        cc_load_policy: captionsEnabled ? '1' : '0',
        cc_lang_pref: 'en',
        hl: 'en',
        playsinline: '1',
        start: String(startSec),
        origin: window.location.origin,
      });
      if (getDataSaverStatus().isDataSaverActive) {
        embedParams.set('vq', 'medium');
      }

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

      playerContainerRef.current.appendChild(iframe);
      iframeElementRef.current = iframe;
      setDirectTouchPassthrough(true);
    };

    const startProgressPolling = (player: any) => {
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = window.setInterval(() => {
        try {
          if (player && typeof player.getCurrentTime === 'function') {
            const cur = player.getCurrentTime();
            const dur = player.getDuration?.() || video.duration_seconds || 0;
            const pState = player.getPlayerState?.();
            if (typeof pState === 'number') {
              actualPlayerStateRef.current = pState;
              if (pState === 1 || pState === 3) {
                setIsPlaying(true);
                setIsStartingStream(false);
                setHasStartedPlayback(true);
              }
            }
            setCurrentTime(cur);
            if (dur > 0) setDuration(dur);
            const now = Date.now();
            const syncIntervalMs = isDataSaverActiveRef.current ? 30000 : 10000;
            if (cur > 3 && dur > 0 && now - lastProgressSyncRef.current >= syncIntervalMs) {
              lastProgressSyncRef.current = now;
              onProgressUpdate(video.id, cur, dur);
            }
          }
        } catch {}
      }, 1000);
    };

    const initPlayer = () => {
      if (!isMounted || !playerContainerRef.current || !window.YT || !window.YT.Player) return;

      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }

      if (playerInstanceRef.current) {
        try {
          playerInstanceRef.current.destroy();
        } catch {}
        playerInstanceRef.current = null;
      }

      playerContainerRef.current.innerHTML = '';
      const hostEl = document.createElement('div');
      hostEl.id = `kp-host-${video.youtube_video_id}-${streamRetryCount}`;
      hostEl.className = 'w-full h-full';
      playerContainerRef.current.appendChild(hostEl);

      try {
        playerInstanceRef.current = new window.YT.Player(hostEl, {
          width: '100%',
          height: '100%',
          videoId: video.youtube_video_id,
          host: 'https://www.youtube.com',
          playerVars: {
            autoplay: 1,
            playsinline: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            cc_load_policy: captionsEnabled ? 1 : 0,
            cc_lang_pref: 'en',
            hl: 'en',
            enablejsapi: 1,
            origin: window.location.origin,
            widget_referrer: window.location.origin,
            start: startSec,
          },
          events: {
            onReady: (event: any) => {
              if (!isMounted) return;
              const player = event.target;
              try {
                const createdIframe = player?.getIframe?.();
                if (createdIframe) {
                  createdIframe.setAttribute('playsinline', '1');
                  createdIframe.setAttribute('webkit-playsinline', '1');
                  createdIframe.setAttribute(
                    'allow',
                    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
                  );
                  iframeElementRef.current = createdIframe;
                }
                const dur = player?.getDuration?.() || video.duration_seconds || 0;
                if (dur > 0) setDuration(dur);
                setIsMuted(Boolean(player?.isMuted?.()));
                if (isDataSaverActiveRef.current) {
                  player?.setPlaybackQuality?.('medium');
                }
                player?.playVideo?.();
              } catch {}

              startProgressPolling(player);
            },
            onStateChange: (event: any) => {
              if (!isMounted) return;
              const state = event?.data;
              actualPlayerStateRef.current = state;

              if (state === 1 || state === 3) {
                clearPlaybackRescueTimers();
                const wasUnstarted = !hasStartedPlayback;
                setIsPlaying(true);
                setIsStartingStream(false);
                setHasStartedPlayback(true);
                setDirectTouchPassthrough(false);
                if (isDataSaverActiveRef.current) {
                  try {
                    playerInstanceRef.current?.setPlaybackQuality?.('medium');
                  } catch {}
                }
                if (state === 1 && wasUnstarted) {
                  triggerIntroBannerShield(false);
                }
              } else if (state === 2 || state === 5) {
                setIsPlaying(false);
                setIsStartingStream(false);
              } else if (state === -1) {
                setIsPlaying(false);
              } else if (state === 0) {
                setIsPlaying(false);
                setIsStartingStream(false);
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
              setIsStartingStream(false);
              clearPlaybackRescueTimers();
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
        mountDirectFallbackIframe();
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
        tag.async = true;
        document.head.appendChild(tag);
      }
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) {
          try {
            prevCallback();
          } catch {}
        }
        initPlayer();
      };
      // Safety net if iframe_api fails or takes too long on slow mobile networks
      fallbackTimer = window.setTimeout(() => {
        if (isMounted && (!window.YT || !window.YT.Player)) {
          mountDirectFallbackIframe();
        }
      }, 2200);
    }

    return () => {
      isMounted = false;
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      clearPlaybackRescueTimers();
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

  // Player Control Helpers with Mobile Autoplay Rescue
  const togglePlayPause = () => {
    const player = playerInstanceRef.current;
    const state =
      typeof player?.getPlayerState === 'function'
        ? player.getPlayerState()
        : actualPlayerStateRef.current;
    const currentlyPlaying = state === 1 || state === 3 || isPlaying;

    if (currentlyPlaying) {
      clearPlaybackRescueTimers();
      try {
        player?.pauseVideo?.();
      } catch {}
      sendIframeCommand('pauseVideo');
      setIsPlaying(false);
      setIsStartingStream(false);
      setIsStreamWarmingUp(false);
      return;
    }

    setIsStartingStream(true);
    clearPlaybackRescueTimers();

    try {
      player?.playVideo?.();
    } catch {}
    sendIframeCommand('playVideo');

    // Rescue 1 (Mobile Safari / Chrome unmuted-autoplay block):
    // If after 550ms the stream is still unstarted (-1 / 2 / 5), kickstart muted playback
    // (mobile browsers ALWAYS permit muted play) and show a crisp "Tap for Sound" button.
    playRescueTimerRef.current = window.setTimeout(() => {
      const liveState =
        typeof playerInstanceRef.current?.getPlayerState === 'function'
          ? playerInstanceRef.current.getPlayerState()
          : actualPlayerStateRef.current;
      if (liveState !== 1 && liveState !== 3) {
        try {
          playerInstanceRef.current?.mute?.();
          playerInstanceRef.current?.playVideo?.();
        } catch {}
        sendIframeCommand('mute');
        sendIframeCommand('playVideo');
        setIsMuted(true);
        setAutoplayMutedNotice(true);
      }
    }, 550);

    // Rescue 2 (Strict mobile WebView fallback):
    // If after 1300ms playback STILL hasn't transitioned to Playing/Buffering,
    // allow direct touch straight through to the underlying iframe so a single tap always plays.
    playTouchFallbackTimerRef.current = window.setTimeout(() => {
      const liveState =
        typeof playerInstanceRef.current?.getPlayerState === 'function'
          ? playerInstanceRef.current.getPlayerState()
          : actualPlayerStateRef.current;
      setIsStartingStream(false);
      if (liveState !== 1 && liveState !== 3) {
        setDirectTouchPassthrough(true);
      }
    }, 1300);
  };

  const toggleNativeFullscreen = async () => {
    const el = fullscreenWrapperRef.current as (HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    }) | null;

    if (isNativeFullscreen || document.fullscreenElement) {
      setIsNativeFullscreen(false);
      setIsRotatedLandscape(false);
      try {
        if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
          await document.exitFullscreen();
        }
      } catch {}
      try {
        const scr = window.screen as any;
        if (scr?.orientation && typeof scr.orientation.unlock === 'function') {
          scr.orientation.unlock();
        }
      } catch {}
      return;
    }

    setIsNativeFullscreen(true);
    revealControlsTemporarily();

    if (el) {
      try {
        if (typeof el.requestFullscreen === 'function') {
          await el.requestFullscreen();
        } else if (typeof el.webkitRequestFullscreen === 'function') {
          await el.webkitRequestFullscreen();
        }
      } catch {
        // Fallback to fixed viewport fullscreen (e.g. iOS Safari)
      }
    }

    try {
      const scr = window.screen as any;
      if (scr?.orientation && typeof scr.orientation.lock === 'function') {
        await scr.orientation.lock('landscape');
      }
    } catch {
      // Orientation lock is optional and unsupported on iOS Safari
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
  skipBySecondsRef.current = skipBySeconds;

  const triggerDoubleTapSeek = (side: 'left' | 'right') => {
    if (video.is_live_now) return;
    const delta = side === 'left' ? -10 : 10;
    skipBySeconds(delta);
    setDoubleTapSeekBadge((prev) => {
      const accumulated =
        prev && prev.side === side ? prev.seconds + 10 : 10;
      return { side, seconds: accumulated, key: Date.now() };
    });
    if (doubleTapBadgeTimerRef.current) {
      window.clearTimeout(doubleTapBadgeTimerRef.current);
    }
    doubleTapBadgeTimerRef.current = window.setTimeout(() => {
      setDoubleTapSeekBadge(null);
    }, 650);
  };

  // Swipe-Down Gesture Handlers (Full Player -> Floating Mini-Player)
  const handlePlayerTouchStart = (e: React.TouchEvent) => {
    if (isMinimized || isNativeFullscreen || e.touches.length !== 1) return;
    const targetEl = e.target as HTMLElement | null;
    if (targetEl && (targetEl.tagName === 'INPUT' || targetEl.closest('input'))) return;
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    swipeJustHandledRef.current = false;
  };

  const handlePlayerTouchMove = (e: React.TouchEvent) => {
    if (!swipeStartRef.current || isMinimized || isNativeFullscreen || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - swipeStartRef.current.x;
    const dy = t.clientY - swipeStartRef.current.y;
    if (dy > 14 && dy > Math.abs(dx) * 1.35) {
      setSwipeDragY(Math.min(130, dy - 14));
    } else if (dy <= 0) {
      setSwipeDragY(0);
    }
  };

  const handlePlayerTouchEnd = (e: React.TouchEvent) => {
    if (!swipeStartRef.current || isMinimized || isNativeFullscreen) {
      setSwipeDragY(0);
      return;
    }
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const changed = e.changedTouches[0];
    const dx = changed ? changed.clientX - start.x : 0;
    const dy = changed ? changed.clientY - start.y : 0;
    const elapsed = Date.now() - start.time;
    const isDownwardSwipe =
      dy > Math.abs(dx) * 1.3 && (dy >= 64 || (dy >= 40 && elapsed <= 260));

    setSwipeDragY(0);
    if (isDownwardSwipe) {
      swipeJustHandledRef.current = true;
      onToggleMinimize(true);
    }
  };

  const handleMiniSwipeStart = (e: React.TouchEvent) => {
    if (!isMinimized || e.touches.length !== 1) return;
    const targetEl = e.target as HTMLElement | null;
    if (targetEl && (targetEl.tagName === 'INPUT' || targetEl.closest('input'))) return;
    miniSwipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleMiniSwipeEnd = (e: React.TouchEvent) => {
    if (!miniSwipeStartRef.current || !isMinimized) return;
    const start = miniSwipeStartRef.current;
    miniSwipeStartRef.current = null;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (dy < -42 && Math.abs(dy) > Math.abs(dx) * 1.3) {
      onToggleMinimize(false);
    }
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
        player?.setVolume?.(100);
        sendIframeCommand('unMute');
        setIsMuted(false);
        setAutoplayMutedNotice(false);
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

  const toggleCaptions = () => {
    const next = !captionsEnabled;
    setCaptionsEnabled(next);
    const player = playerInstanceRef.current;
    try {
      if (next) {
        player?.loadModule?.('captions');
        player?.setOption?.('captions', 'track', { languageCode: 'en' });
        sendIframeCommand('loadModule', ['captions']);
        sendIframeCommand('setOption', ['captions', 'track', { languageCode: 'en' }]);
      } else {
        player?.unloadModule?.('captions');
        player?.setOption?.('captions', 'track', {});
        sendIframeCommand('unloadModule', ['captions']);
        sendIframeCommand('setOption', ['captions', 'track', {}]);
      }
    } catch {}
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
          ? 'fixed z-50 bottom-[68px] md:bottom-5 right-2 left-2 sm:left-auto sm:right-5 sm:w-[370px] lg:w-[410px] bg-[#121215]/95 backdrop-blur-xl border border-zinc-700/90 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 touch-pan-x'
          : 'fixed inset-0 z-50 w-full max-w-full bg-[#09090B] overflow-y-auto overflow-x-clip overscroll-y-contain'
      }
    >
      <div
        className={
          isMinimized
            ? 'flex flex-col'
            : 'min-h-screen w-full max-w-[1440px] mx-auto px-0 sm:px-6 lg:px-8 pb-24 sm:py-5 flex flex-col gap-0 sm:gap-5'
        }
      >
        {/* ====================================================================
            THEATER HEADER BAR (Compact on Mobile + Swipe-Down Handle)
        ==================================================================== */}
        <div
          onTouchStart={handlePlayerTouchStart}
          onTouchMove={handlePlayerTouchMove}
          onTouchEnd={handlePlayerTouchEnd}
          onTouchCancel={() => {
            swipeStartRef.current = null;
            setSwipeDragY(0);
          }}
          className={
            isMinimized
              ? 'hidden'
              : 'flex flex-col border-b border-zinc-800/90 bg-[#09090B]/95 backdrop-blur-md'
          }
        >
          {/* Subtle mobile swipe-down affordance bar */}
          <div className="sm:hidden flex justify-center pt-1.5 pb-0.5">
            <span className="w-9 h-1 rounded-full bg-zinc-700/90" />
          </div>
          <div className="flex items-center justify-between gap-2 px-3.5 py-2 sm:px-0 sm:pb-3.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-display text-sm sm:text-lg font-semibold text-amber-400 shrink-0">
                KINGDOM+
              </span>
              <span className="text-zinc-600" aria-hidden="true">
                /
              </span>
              <span className="text-xs text-zinc-400 truncate hidden md:inline">
                {video.primary_category_name}
              </span>
              <span className="text-zinc-600 hidden md:inline" aria-hidden="true">
                /
              </span>
              <span className="text-xs text-zinc-200 font-medium truncate">{video.title}</span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onToggleMinimize(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-medium border border-amber-500/30 transition-colors whitespace-nowrap min-h-[38px]"
                title="Minimize to Floating Mini-Player (or swipe down on video)"
              >
                <PictureInPicture2 className="w-4 h-4" />
                <span>Mini-Player</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium border border-zinc-800 transition-colors whitespace-nowrap min-h-[38px]"
                aria-label="Close Player"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>
          </div>
        </div>

        {!isMinimized && reportFeedback && (
          <div className="mx-3.5 sm:mx-0 mt-2 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            {reportFeedback}
          </div>
        )}

        {/* ====================================================================
            PERSISTENT NATIVE KINGDOM+ VIDEO CONTAINER
            100% True 16:9 Alignment: Zero zoom-crop so video captions & subtitles
            never get cut off or misaligned on mobile or desktop!
        ==================================================================== */}
        <div
          className={
            isMinimized
              ? 'flex flex-col'
              : 'grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-start w-full'
          }
        >
          <div className={isMinimized ? 'flex flex-col' : 'lg:col-span-8 min-w-0 w-full flex flex-col gap-2.5 sm:gap-5'}>
            <div
              ref={fullscreenWrapperRef}
              onTouchStart={isMinimized ? handleMiniSwipeStart : handlePlayerTouchStart}
              onTouchMove={!isMinimized ? handlePlayerTouchMove : undefined}
              onTouchEnd={isMinimized ? handleMiniSwipeEnd : handlePlayerTouchEnd}
              onTouchCancel={() => {
                swipeStartRef.current = null;
                miniSwipeStartRef.current = null;
                setSwipeDragY(0);
              }}
              style={
                !isMinimized && !isNativeFullscreen && swipeDragY > 0
                  ? {
                      transform: `translateY(${swipeDragY}px) scale(${Math.max(
                        0.92,
                        1 - swipeDragY / 1100
                      )})`,
                      opacity: Math.max(0.65, 1 - swipeDragY / 260),
                    }
                  : undefined
              }
              className={
                isMinimized
                  ? isCompactMini
                    ? 'flex items-center gap-3 p-2.5'
                    : 'flex flex-col'
                  : isNativeFullscreen
                    ? 'fixed inset-0 z-[100] w-screen h-[100dvh] bg-black flex flex-col items-center justify-center overflow-hidden select-none'
                    : 'sticky top-0 z-30 sm:static w-full min-w-0 bg-[#09090B] flex flex-col gap-0 sm:gap-2.5 transition-transform duration-150 ease-out'
              }
            >
              {/* THE TRUE 16:9 SHIELDED STREAM CONTAINER (AUTO-FITS EXACT DEVICE VIEWPORT) */}
              <div
                style={
                  isNativeFullscreen && isRotatedLandscape && !isMinimized
                    ? {
                        width: '100dvh',
                        height: '100vw',
                        transform: 'rotate(90deg)',
                        transformOrigin: 'center center',
                      }
                    : undefined
                }
                className={
                  isMinimized
                    ? isCompactMini
                      ? 'relative w-24 sm:w-28 aspect-video rounded-lg overflow-hidden bg-black border border-zinc-800 shrink-0 select-none'
                      : 'relative aspect-video w-full bg-black border-b border-zinc-800 overflow-hidden select-none'
                    : isNativeFullscreen
                      ? 'relative shrink-0 w-full h-full flex items-center justify-center bg-black overflow-hidden select-none'
                      : 'relative aspect-video w-full max-w-[calc(62dvh*16/9)] lg:max-w-full mx-auto sm:rounded-xl overflow-hidden bg-black border-b sm:border border-zinc-800 shadow-2xl select-none touch-pan-x'
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
                  /* Exact 16:9 Viewport-Fitted Stage: Automatically matches exact device width & height without cropping or overflowing */
                  <div
                    style={
                      isNativeFullscreen && !isMinimized
                        ? isRotatedLandscape
                          ? {
                              width: 'min(100dvh, calc(100vw * 16 / 9))',
                              height: 'min(100vw, calc(100dvh * 9 / 16))',
                            }
                          : {
                              width: 'min(100vw, calc(100dvh * 16 / 9))',
                              height: 'min(100dvh, calc(100vw * 9 / 16))',
                            }
                        : undefined
                    }
                    className={
                      isNativeFullscreen && !isMinimized
                        ? `relative shrink-0 mx-auto my-auto overflow-hidden ${directTouchPassthrough ? 'pointer-events-auto' : 'pointer-events-none'}`
                        : `absolute inset-0 w-full h-full overflow-hidden ${directTouchPassthrough ? 'pointer-events-auto' : 'pointer-events-none'}`
                    }
                  >
                    <div
                      id="kp-player-stage"
                      ref={playerContainerRef}
                      className={`w-full h-full ${directTouchPassthrough ? 'pointer-events-auto' : 'pointer-events-none'}`}
                    />

                    {/* KINGDOM+ Startup / Buffering Curtain: Hides external player intro banner briefly once active */}
                    {isPlaying && isStreamWarmingUp && (
                      <div className="absolute inset-0 bg-[#070709] flex flex-col items-center justify-center gap-3 pointer-events-none z-10 transition-opacity duration-300">
                        {(video.thumbnail_maxres_url || video.thumbnail_high_url) && (
                          <img
                            src={getOptimizedThumbnailUrl(video, isDataSaverActive, 'card')}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full object-cover opacity-30"
                          />
                        )}
                        <div className="relative z-10 flex flex-col items-center gap-2">
                          <div className="w-10 h-10 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
                          <span className="px-2.5 py-0.5 rounded-full bg-black/80 border border-amber-500/30 text-[10px] font-display font-bold tracking-widest text-amber-400 uppercase">
                            KINGDOM+ STREAM
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Intro Banner Mask: Active ONLY during the brief 2.8s embed banner flash, then completely disappears (opacity-0) */}
                    <div
                      className={`absolute top-0 inset-x-0 h-[56px] sm:h-[66px] bg-gradient-to-b from-[#060608] via-[#060608]/85 to-transparent pointer-events-none transition-opacity duration-500 ${
                        isPlaying && introBannerShieldActive ? 'opacity-100' : 'opacity-0'
                      }`}
                    />

                    {/* Crisp flush corner mark in extreme bottom-right ONLY (Zero dark gradient shadow bleeding into the video) */}
                    {!isCompactMini && !directTouchPassthrough && (
                      <div className="absolute bottom-0 right-0 w-[86px] sm:w-[98px] h-[26px] sm:h-[30px] bg-[#09090B] rounded-tl-md flex items-center justify-center pointer-events-none">
                        <span className="inline-flex items-center gap-1 text-[9px] font-display font-bold tracking-widest text-zinc-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          KINGDOM+
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* DIRECT TOUCH MODE TOP-CORNER PILLS (Does NOT block tapping center of video!) */}
                {!playerError && directTouchPassthrough && !isMinimized && (
                  <div className="absolute top-2.5 inset-x-2.5 z-20 flex items-center justify-between gap-2 pointer-events-none">
                    <div className="flex items-center gap-1.5 pointer-events-auto">
                      {autoplayMutedNotice && isMuted && (
                        <button
                          type="button"
                          onClick={toggleMute}
                          className="px-2.5 py-1.5 rounded-full bg-amber-500 text-zinc-950 text-[11px] font-bold flex items-center gap-1 shadow-lg"
                        >
                          <VolumeX className="w-3.5 h-3.5" />
                          <span>Tap for Sound</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 pointer-events-auto">
                      <button
                        type="button"
                        onClick={toggleCaptions}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border flex items-center gap-1 min-h-[34px] ${
                          captionsEnabled
                            ? 'bg-amber-500 text-zinc-950 border-amber-400'
                            : 'bg-black/80 text-zinc-200 border-zinc-700/80'
                        }`}
                      >
                        <Subtitles className="w-3.5 h-3.5" />
                        <span>CC</span>
                      </button>
                      <button
                        type="button"
                        onClick={toggleNativeFullscreen}
                        className="px-2.5 py-1.5 rounded-lg bg-black/80 text-amber-400 border border-zinc-700/80 text-[11px] font-semibold flex items-center gap-1 min-h-[34px]"
                      >
                        {isNativeFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                        <span>{isNativeFullscreen ? 'Exit' : 'Full Screen'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* NATIVE KINGDOM+ TOUCH, DOUBLE-TAP SEEK & FULLSCREEN HUD SHIELD */}
                {!playerError && !directTouchPassthrough && (
                  <div
                    onClick={(e) => {
                      if (swipeJustHandledRef.current) {
                        swipeJustHandledRef.current = false;
                        return;
                      }
                      if (isMinimized) {
                        togglePlayPause();
                        return;
                      }
                      if (!isPlaying) {
                        togglePlayPause();
                        return;
                      }

                      const rect = e.currentTarget.getBoundingClientRect();
                      const relX = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5;
                      const side: 'left' | 'center' | 'right' =
                        relX < 0.35 ? 'left' : relX > 0.65 ? 'right' : 'center';
                      const now = Date.now();
                      const prevTap = lastTapRef.current;

                      if (prevTap && now - prevTap.time <= 280 && prevTap.side === side) {
                        if (singleTapTimerRef.current) {
                          window.clearTimeout(singleTapTimerRef.current);
                          singleTapTimerRef.current = null;
                        }
                        lastTapRef.current = { time: now, side };
                        if (side === 'left' || side === 'right') {
                          triggerDoubleTapSeek(side);
                        } else {
                          toggleNativeFullscreen();
                        }
                        return;
                      }

                      lastTapRef.current = { time: now, side };
                      if (singleTapTimerRef.current) {
                        window.clearTimeout(singleTapTimerRef.current);
                      }
                      singleTapTimerRef.current = window.setTimeout(() => {
                        singleTapTimerRef.current = null;
                        if (!controlsVisible) {
                          revealControlsTemporarily();
                        } else {
                          setControlsVisible(false);
                        }
                      }, 230);
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    className="absolute inset-0 z-10 cursor-pointer flex flex-col justify-between"
                  >
                    {/* Double-Tap Seek Ripple Feedback (-10s Left / +10s Right) */}
                    {doubleTapSeekBadge && !isMinimized && (
                      <div
                        key={doubleTapSeekBadge.key}
                        className={`pointer-events-none absolute inset-y-0 z-20 flex items-center justify-center w-[38%] ${
                          doubleTapSeekBadge.side === 'left'
                            ? 'left-0 bg-gradient-to-r from-white/15 to-transparent rounded-r-full'
                            : 'right-0 bg-gradient-to-l from-white/15 to-transparent rounded-l-full'
                        }`}
                      >
                        <div className="px-3.5 py-2 rounded-full bg-black/75 border border-amber-500/40 text-zinc-50 flex items-center gap-1.5 shadow-xl">
                          {doubleTapSeekBadge.side === 'left' ? (
                            <RotateCcw className="w-4 h-4 text-amber-400" />
                          ) : (
                            <RotateCw className="w-4 h-4 text-amber-400" />
                          )}
                          <span className="text-xs font-mono font-bold tabular-nums">
                            {doubleTapSeekBadge.side === 'left' ? '-' : '+'}
                            {doubleTapSeekBadge.seconds}s
                          </span>
                        </div>
                      </div>
                    )}
                    {/* Top HUD Strip (Completely transparent & hidden while playing; light gradient ONLY when tapped) */}
                    {!isCompactMini && (
                      <div
                        className={`flex items-center justify-between gap-2 p-2.5 sm:p-3.5 bg-gradient-to-b from-black/55 to-transparent transition-opacity duration-300 ${
                          !isPlaying || controlsVisible || autoplayMutedNotice
                            ? 'opacity-100'
                            : 'opacity-0 pointer-events-none'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 rounded bg-black/75 border border-zinc-700/80 font-display text-[10px] font-bold tracking-wider text-amber-400 shrink-0">
                            KINGDOM+
                          </span>
                          {isDataSaverActive && (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-semibold text-emerald-300 shrink-0">
                              Data Saver
                            </span>
                          )}
                          {autoplayMutedNotice && isMuted && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMute();
                              }}
                              className="px-2.5 py-1 rounded-full bg-amber-500 text-zinc-950 text-[11px] font-bold flex items-center gap-1 shadow-lg animate-pulse shrink-0"
                            >
                              <VolumeX className="w-3.5 h-3.5" />
                              <span>Tap for Sound</span>
                            </button>
                          )}
                          {isNativeFullscreen && !autoplayMutedNotice && (
                            <span className="text-xs font-medium text-zinc-100 truncate drop-shadow">
                              {video.title}
                            </span>
                          )}
                        </div>

                        {!isMinimized && (
                          <div
                            className="flex items-center gap-1.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={toggleCaptions}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors flex items-center gap-1 min-h-[34px] ${
                                captionsEnabled
                                  ? 'bg-amber-500 text-zinc-950 border-amber-400'
                                  : 'bg-black/75 text-zinc-200 border-zinc-700/80 hover:bg-black/90'
                              }`}
                              title="Toggle Captions (CC)"
                            >
                              <Subtitles className="w-3.5 h-3.5" />
                              <span>CC</span>
                            </button>

                            {isNativeFullscreen && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsRotatedLandscape((prev) => !prev);
                                  revealControlsTemporarily();
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors flex items-center gap-1 min-h-[34px] sm:hidden ${
                                  isRotatedLandscape
                                    ? 'bg-amber-500 text-zinc-950 border-amber-400'
                                    : 'bg-black/75 text-zinc-100 border-zinc-700/80'
                                }`}
                                title="Rotate Video to Landscape Fullscreen"
                              >
                                <RotateCw className="w-3.5 h-3.5" />
                                <span>{isRotatedLandscape ? 'Portrait' : 'Rotate'}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={toggleNativeFullscreen}
                              className="px-2.5 py-1.5 rounded-lg bg-black/75 hover:bg-black/90 text-amber-400 border border-zinc-700/80 text-[11px] font-semibold flex items-center gap-1 min-h-[34px]"
                              title={isNativeFullscreen ? 'Exit Full Screen' : 'Watch Full Screen'}
                            >
                              {isNativeFullscreen ? (
                                <>
                                  <Minimize className="w-3.5 h-3.5" />
                                  <span>Exit</span>
                                </>
                              ) : (
                                <>
                                  <Maximize className="w-3.5 h-3.5" />
                                  <span>Full Screen</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Center Transport Touch Overlay (Lightweight, non-blurred so video stays visible & fast!) */}
                    <div className="flex-1 flex items-center justify-center">
                      {!isPlaying ? (
                        <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-2.5 p-4 text-center">
                          {!hasStartedPlayback &&
                            currentTime < 1 &&
                            (video.thumbnail_maxres_url || video.thumbnail_high_url) && (
                              <img
                                src={getOptimizedThumbnailUrl(video, isDataSaverActive, 'card')}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="absolute inset-0 w-full h-full object-cover opacity-55 -z-10"
                              />
                            )}
                          <div className="flex items-center gap-5" onClick={(e) => e.stopPropagation()}>
                            {!isMinimized && !video.is_live_now && hasStartedPlayback && (
                              <button
                                type="button"
                                onClick={() => {
                                  skipBySeconds(-10);
                                  revealControlsTemporarily();
                                }}
                                className="w-11 h-11 rounded-full bg-black/75 border border-zinc-700 text-zinc-100 flex items-center justify-center active:scale-95 transition-transform"
                                title="Rewind 10s"
                              >
                                <RotateCcw className="w-5 h-5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={togglePlayPause}
                              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
                              aria-label="Play Video"
                            >
                              {isStartingStream ? (
                                <div className="w-7 h-7 rounded-full border-[3px] border-zinc-950/30 border-t-zinc-950 animate-spin" />
                              ) : (
                                <Play className="w-7 h-7 fill-current ml-0.5" />
                              )}
                            </button>
                            {!isMinimized && !video.is_live_now && hasStartedPlayback && (
                              <button
                                type="button"
                                onClick={() => {
                                  skipBySeconds(10);
                                  revealControlsTemporarily();
                                }}
                                className="w-11 h-11 rounded-full bg-black/75 border border-zinc-700 text-zinc-100 flex items-center justify-center active:scale-95 transition-transform"
                                title="Forward 10s"
                              >
                                <RotateCw className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                          {!isCompactMini && (
                            <div className="max-w-md mt-1 px-3">
                              <div className="text-xs sm:text-sm font-semibold text-white line-clamp-1 drop-shadow">
                                {video.title}
                              </div>
                              <div className="text-[11px] text-amber-400 mt-0.5 drop-shadow">
                                {isStartingStream
                                  ? 'Connecting stream...'
                                  : `${video.artist_name || video.channel_title} · ${
                                      hasStartedPlayback || currentTime > 1 ? 'Tap to Resume' : 'Tap to Play'
                                    }`}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        !isMinimized &&
                        controlsVisible && (
                          <div
                            className="flex items-center gap-6"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {!video.is_live_now && (
                              <button
                                type="button"
                                onClick={() => {
                                  skipBySeconds(-10);
                                  revealControlsTemporarily();
                                }}
                                className="w-11 h-11 rounded-full bg-black/70 backdrop-blur-md border border-zinc-700/80 text-zinc-100 flex flex-col items-center justify-center active:scale-95 transition-transform"
                                title="Rewind 10s"
                              >
                                <RotateCcw className="w-4 h-4" />
                                <span className="text-[9px] font-mono">-10s</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={togglePlayPause}
                              className="w-14 h-14 rounded-full bg-black/75 backdrop-blur-md border border-amber-500/60 text-amber-400 flex items-center justify-center shadow-xl active:scale-95 transition-transform"
                              aria-label="Pause Video"
                            >
                              <Pause className="w-6 h-6 fill-current" />
                            </button>

                            {!video.is_live_now && (
                              <button
                                type="button"
                                onClick={() => {
                                  skipBySeconds(10);
                                  revealControlsTemporarily();
                                }}
                                className="w-11 h-11 rounded-full bg-black/70 backdrop-blur-md border border-zinc-700/80 text-zinc-100 flex flex-col items-center justify-center active:scale-95 transition-transform"
                                title="Forward 10s"
                              >
                                <RotateCw className="w-4 h-4" />
                                <span className="text-[9px] font-mono">+10s</span>
                              </button>
                            )}
                          </div>
                        )
                      )}
                    </div>

                    {/* Bottom Fullscreen HUD Scrubber Bar (Shown inside Fullscreen when tapped) */}
                    {isNativeFullscreen && !isMinimized && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={`p-3 sm:p-5 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-2 transition-opacity duration-300 ${
                          !isPlaying || controlsVisible
                            ? 'opacity-100'
                            : 'opacity-0 pointer-events-none'
                        }`}
                      >
                        {!video.is_live_now && (
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono tabular-nums text-zinc-200">
                              {formatDurationSeconds(Math.floor(currentTime)) || '0:00'}
                            </span>
                            <input
                              type="range"
                              min={0}
                              max={Math.max(1, duration)}
                              value={Math.min(currentTime, Math.max(1, duration))}
                              onChange={(e) => {
                                handleSeekBarChange(e);
                                revealControlsTemporarily();
                              }}
                              className="flex-1 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                            <span className="text-xs font-mono tabular-nums text-zinc-300">
                              {formatDurationSeconds(Math.floor(duration)) || '0:00'}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                togglePlayPause();
                                revealControlsTemporarily();
                              }}
                              className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold flex items-center gap-1.5"
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

                            <button
                              type="button"
                              onClick={() => {
                                toggleMute();
                                revealControlsTemporarily();
                              }}
                              className="p-2 rounded-lg bg-zinc-900/90 text-zinc-200 border border-zinc-700"
                            >
                              {isMuted ? (
                                <VolumeX className="w-4 h-4 text-amber-400" />
                              ) : (
                                <Volume2 className="w-4 h-4" />
                              )}
                            </button>

                            {!video.is_live_now && (
                              <button
                                type="button"
                                onClick={() => {
                                  cyclePlaybackSpeed();
                                  revealControlsTemporarily();
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-zinc-900/90 text-zinc-200 text-xs font-mono border border-zinc-700"
                              >
                                {playbackSpeed}x
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setIsRotatedLandscape((prev) => !prev);
                                revealControlsTemporarily();
                              }}
                              className="sm:hidden px-3 py-1.5 rounded-lg bg-zinc-900/90 text-zinc-100 border border-zinc-700 text-xs font-medium flex items-center gap-1.5"
                            >
                              <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                              <span>{isRotatedLandscape ? 'Portrait' : 'Landscape'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={toggleNativeFullscreen}
                              className="px-3.5 py-1.5 rounded-lg bg-zinc-900/90 text-amber-400 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5"
                            >
                              <Minimize className="w-3.5 h-3.5" />
                              <span>Exit Full Screen</span>
                            </button>
                          </div>
                        </div>
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
                  (Hidden when in Fullscreen so 100% of screen is pure video!)
              ============================================================== */}
              {!isMinimized && !isNativeFullscreen && (
                <div className="px-3 py-2 sm:p-3.5 sm:rounded-xl bg-[#121215] border-b sm:border border-zinc-800/90 flex flex-col gap-2">
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
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <span className="text-[11px] sm:text-xs font-mono tabular-nums text-zinc-300 w-10 sm:w-12 text-right">
                        {formatDurationSeconds(Math.floor(currentTime)) || '0:00'}
                      </span>
                      <div className="relative flex-1 flex items-center py-1">
                        <input
                          type="range"
                          min={0}
                          max={Math.max(1, duration)}
                          value={Math.min(currentTime, Math.max(1, duration))}
                          onChange={handleSeekBarChange}
                          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>
                      <span className="text-[11px] sm:text-xs font-mono tabular-nums text-zinc-400 w-10 sm:w-12">
                        {formatDurationSeconds(Math.floor(duration)) || '0:00'}
                      </span>
                    </div>
                  )}

                  {/* Transport & Multitasking Controls (Horizontally scrollable on mobile so nothing wraps or crowds) */}
                  <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={togglePlayPause}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
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
                            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs border border-zinc-800 transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
                            title="Rewind 10 seconds"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>-10s</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => skipBySeconds(10)}
                            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs border border-zinc-800 transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
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
                        className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors shrink-0 min-h-[38px] min-w-[38px] flex items-center justify-center"
                        title={isMuted ? 'Unmute' : 'Mute'}
                      >
                        {isMuted ? (
                          <VolumeX className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={toggleCaptions}
                        className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs border transition-colors whitespace-nowrap shrink-0 min-h-[38px] ${
                          captionsEnabled
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-100'
                        }`}
                        title={captionsEnabled ? 'Disable Subtitles / Captions' : 'Enable Subtitles / Captions'}
                      >
                        <Subtitles className="w-3.5 h-3.5" />
                        <span>CC</span>
                      </button>

                      {!video.is_live_now && (
                        <>
                          <button
                            type="button"
                            onClick={cyclePlaybackSpeed}
                            className="px-2.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-mono border border-zinc-800 transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
                            title="Change Playback Speed"
                          >
                            {playbackSpeed}x
                          </button>

                          <button
                            type="button"
                            onClick={() => setIsLooping((prev) => !prev)}
                            className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs border transition-colors whitespace-nowrap shrink-0 min-h-[38px] ${
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
                        className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs border border-zinc-800 transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
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
                    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                      {onNavigateWhileListening && (
                        <>
                          <button
                            type="button"
                            onClick={() => onNavigateWhileListening('categories')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs border border-zinc-800 transition-colors whitespace-nowrap shrink-0"
                          >
                            <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                            <span>Browse Categories</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onNavigateWhileListening('community')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs border border-zinc-800 transition-colors whitespace-nowrap shrink-0"
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
                VIDEO-FIRST FOCUS INTERFACE ON MOBILE
                Limits distractions while watching so the video is the hero!
            ================================================================ */}
            {!isMinimized && (
              <div className="px-3.5 sm:px-0 pt-2 sm:pt-0 flex flex-col gap-4">
                {/* Essential Now-Playing Bar (Always visible below player) */}
                <div className="flex flex-col gap-3 pb-3.5 border-b border-zinc-800/90">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[11px] font-medium text-amber-400">
                        <span>{video.primary_category_name}</span>
                        {video.subcategory_label && (
                          <>
                            <span aria-hidden="true" className="text-zinc-600">·</span>
                            <span className="text-zinc-400 truncate">{video.subcategory_label}</span>
                          </>
                        )}
                      </div>
                      <h1 className="font-display text-base sm:text-2xl lg:text-3xl font-semibold text-zinc-50 leading-snug mt-0.5">
                        {video.title}
                      </h1>
                    </div>

                    <button
                      type="button"
                      onClick={toggleNativeFullscreen}
                      className="sm:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-zinc-950 text-xs font-semibold shadow-md shrink-0"
                    >
                      <Maximize className="w-3.5 h-3.5" />
                      <span>Full Screen</span>
                    </button>
                  </div>

                  {/* Compact Minister Row + Quick Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <div
                      onClick={() => {
                        if (onOpenChannelWhileListening) {
                          onOpenChannelWhileListening(video.channel_id);
                        }
                      }}
                      className="flex items-center gap-2.5 cursor-pointer group min-w-0"
                    >
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-800 text-amber-400 font-semibold flex items-center justify-center overflow-hidden shrink-0 border border-zinc-700/70">
                        {video.channel_avatar_url ? (
                          <img
                            src={getOptimizedAvatarUrl(video.channel_avatar_url, isDataSaverActive)}
                            alt={video.channel_title}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          video.channel_title.charAt(0)
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors truncate">
                          {video.pastor_name || video.artist_name || video.channel_title}
                        </div>
                        <div className="text-[11px] text-zinc-400 flex items-center flex-wrap gap-1.5 font-mono tabular-nums">
                          {video.is_live_now && video.live_broadcast_content === 'live' ? (
                            <>
                              <span className="font-sans text-red-400 font-semibold">LIVE NOW</span>
                              {(video.ministry_name || video.channel_title) && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-sans text-zinc-300 truncate">
                                    {video.ministry_name || video.channel_title}
                                  </span>
                                </>
                              )}
                              {typeof video.concurrent_viewers === 'number' &&
                                video.concurrent_viewers > 0 && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-zinc-200">
                                      {formatCompactNumber(video.concurrent_viewers)} watching
                                    </span>
                                  </>
                                )}
                            </>
                          ) : (
                            <>
                              <span>{formatCompactNumber(video.view_count)} views</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-sans">
                                {formatRelativeDate(video.published_at)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          const outcome = await shareKingdomVideo(video);
                          if (outcome !== 'cancelled') {
                            setJustSharedVideo(true);
                            window.setTimeout(() => setJustSharedVideo(false), 1800);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-medium transition-colors whitespace-nowrap min-h-[36px]"
                        title="Share on WhatsApp or Messages"
                      >
                        {justSharedVideo ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-300">Shared</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-3.5 h-3.5 text-amber-400" />
                            <span>Share</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => onToggleSave(video.id, e)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap min-h-[36px] ${
                          isSaved
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800'
                        }`}
                      >
                        {isSaved ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                        <span>{isSaved ? 'Saved' : 'Save'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReportItem('video', video.id, video.title)}
                        className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors min-h-[36px]"
                        title="Report video to moderators"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mobile Mode Selector: Focus Mode (Default - Limits Distractions) | Up Next | Notes | About */}
                <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-zinc-900/90 border border-zinc-800 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setMobilePlayerTab('focus')}
                    className={`py-2 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                      mobilePlayerTab === 'focus'
                        ? 'bg-amber-500 text-zinc-950'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    Focus Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobilePlayerTab('upnext')}
                    className={`py-2 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                      mobilePlayerTab === 'upnext'
                        ? 'bg-amber-500 text-zinc-950'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    Up Next ({relatedVideos.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobilePlayerTab('comments')}
                    className={`py-2 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                      mobilePlayerTab === 'comments'
                        ? 'bg-amber-500 text-zinc-950'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    Notes ({comments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobilePlayerTab('overview')}
                    className={`py-2 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                      mobilePlayerTab === 'overview'
                        ? 'bg-amber-500 text-zinc-950'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    About
                  </button>
                </div>

                {/* FOCUS MODE (Default on Mobile: Zero Clutter, Next Broadcast Card + Fullscreen/Audio Controls) */}
                {mobilePlayerTab === 'focus' && (
                  <div className="lg:hidden flex flex-col gap-3 py-1">
                    <div className="p-3.5 rounded-xl bg-[#121215] border border-zinc-800/90 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-zinc-100">
                          Distraction-Free Viewing Active
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          Tap the video anytime for on-screen controls or Full Screen.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleMinimize(true)}
                        className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-amber-400 text-xs font-medium whitespace-nowrap shrink-0"
                      >
                        Audio / Mini
                      </button>
                    </div>

                    {relatedVideos[0] && (
                      <div
                        onClick={() => onSelectVideo(relatedVideos[0])}
                        className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 flex items-center justify-between gap-3 cursor-pointer hover:border-amber-500/40 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={getOptimizedThumbnailUrl(relatedVideos[0], isDataSaverActive, 'mini')}
                            alt={relatedVideos[0].title}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="w-20 aspect-video rounded-lg object-cover bg-zinc-900 shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                              Playing Next
                            </span>
                            <div className="text-xs font-medium text-zinc-100 truncate">
                              {relatedVideos[0].title}
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate">
                              {relatedVideos[0].channel_title}
                            </div>
                          </div>
                        </div>
                        <SkipForward className="w-4 h-4 text-amber-400 shrink-0 mr-1" />
                      </div>
                    )}
                  </div>
                )}

                {/* ABOUT / DESCRIPTION (Desktop always visible if present, Mobile only on 'overview' tab) */}
                {video.description && (
                  <div
                    className={`${
                      mobilePlayerTab === 'overview' ? 'block' : 'hidden lg:block'
                    } p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/70`}
                  >
                    <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line line-clamp-4">
                      {video.description}
                    </p>
                  </div>
                )}

                {/* Up Next & Related Videos in Category / Ministry (Desktop always, Mobile ONLY on 'upnext' tab) */}
                {relatedVideos.length > 0 && (
                  <div
                    className={`${
                      mobilePlayerTab === 'upnext' ? 'block' : 'hidden lg:block'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm sm:text-base font-semibold text-zinc-100 truncate">
                        Up Next from {video.channel_title}
                      </h2>
                      <label className="inline-flex items-center gap-2 text-xs text-zinc-400 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={autoPlayNext}
                          onChange={(e) => setAutoPlayNext(e.target.checked)}
                          className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0"
                        />
                        <span>Auto-play next</span>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {relatedVideos.map((rel) => (
                        <div
                          key={rel.id}
                          onClick={() => onSelectVideo(rel)}
                          className="group cursor-pointer rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden hover:border-amber-500/40 transition-colors flex sm:flex-col gap-3 sm:gap-0 p-2 sm:p-0 items-center sm:items-stretch"
                        >
                          <div className="w-32 sm:w-full aspect-video rounded-lg sm:rounded-none bg-zinc-900 overflow-hidden shrink-0">
                            <img
                              src={getOptimizedThumbnailUrl(rel, isDataSaverActive, 'mini')}
                              alt={rel.title}
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                          <div className="p-0.5 sm:p-2.5 min-w-0 flex-1">
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
              </div>
            )}
          </div>

          {/* Right 4 Columns: Live Sermon & Video Discussion Thread (Hidden when Minimized; shown on 'comments' tab on mobile) */}
          {!isMinimized && (
            <div
              className={`${
                mobilePlayerTab === 'comments' ? 'flex mx-3.5 sm:mx-0' : 'hidden lg:flex'
              } lg:col-span-4 min-w-0 w-full bg-[#121215] border border-zinc-800 rounded-xl p-4 sm:p-5 flex-col gap-4`}
            >
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
