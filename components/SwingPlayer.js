'use client';

import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';

const SwingPlayer = forwardRef(function SwingPlayer(
  {
    videoUrl,
    loaderTimeout = 10000, // Increased to 10s
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    setDuration,
    onLoaderHidden, // <-- add this prop
  },
  ref
) {
  const videoRef = useRef(null);
  const timeoutRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasTimeoutError, setHasTimeoutError] = useState(false);
  const hasSetDuration = useRef(false);
  const [loadProgress, setLoadProgress] = useState(0);

  // State to control instructional text visibility
  const [showInstructions, setShowInstructions] = useState(true);

  // Minimum loader duration
  const MIN_LOADER_TIME = 2000; // ms
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // ✅ Expose controls to parent
  useImperativeHandle(
    ref,
    () => ({
      seekTo: (time) => {
        const video = videoRef.current;
        if (video) {
          console.log('📍 seekTo called with:', time);
          video.currentTime = time;
        }
      },
      pause: () => videoRef.current?.pause(),
      getCurrentTime: () => videoRef.current?.currentTime,
      getVideo: () => videoRef.current, // 🆕 Expose video element for smooth playhead
      video: videoRef.current, // 🆕 Expose video element directly
    }),
    []
  );

  // 🔍 Log URL for debugging
  useEffect(() => {
    console.log('🔎 SwingPlayer videoUrl:', videoUrl);
  }, [videoUrl]);

  // ⏳ Timeout loader fallback
  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      if (isLoading) {
        // Don't show error, just switch to 'Still loading...' message
        setHasTimeoutError(false);
      }
    }, loaderTimeout);
    return () => clearTimeout(timeoutRef.current);
  }, [loaderTimeout, isLoading]);

  // 🧠 Fallback: readyState polling
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video?.readyState >= 2) {
        setIsLoading(false);
        setHasTimeoutError(false);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [isLoading]);

  // 🎯 Ensure duration is captured early (e.g. on refresh/cached cases)
  useLayoutEffect(() => {
    const video = videoRef.current;
    if (
      video &&
      video.readyState >= 1 &&
      video.duration &&
      !isNaN(video.duration) &&
      !hasSetDuration.current
    ) {
      console.log('⚡ eager duration:', video.duration);
      hasSetDuration.current = true;
      setDuration?.(video.duration);
    }
  }, [setDuration]);

  // 🧭 onLoadedMetadata event
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !setDuration) return;
    const handleLoadedMetadata = () => {
      if (!hasSetDuration.current) {
        console.log('🎯 loadedmetadata: duration =', video.duration);
        hasSetDuration.current = true;
        setDuration(video.duration || 0);
      }
    };
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata);
  }, [setDuration]);

  // 🕰 Sync currentTime
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !setCurrentTime) return;
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [setCurrentTime]);

  // ▶️ External play/pause control
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Only play/pause in response to explicit isPlaying prop change from parent
    // Do NOT auto-play on mount or after load
    if (isPlaying === true && video.paused) {
      // Only play if user has interacted (browser will block otherwise)
      // Optionally, you can check a flag for user interaction if needed
      video
        .play()
        .then(() => setIsPlaying?.(true))
        .catch((err) => {
          // Silently ignore play errors due to lack of user gesture
          setIsPlaying?.(false);
        });
    } else if (isPlaying === false && !video.paused) {
      video.pause();
      setIsPlaying?.(false);
    }
  }, [isPlaying, setIsPlaying]);

  // Progress bar for loader
  useEffect(() => {
    if (!isLoading) return;
    setLoadProgress(0); // Always start at 0 when loading starts
    let start = Date.now();
    let frame;
    let fallbackToReal = false;
    const duration = 7000; // 7 seconds for instruction text
    const update = () => {
      const elapsed = Date.now() - start;
      if (!fallbackToReal && elapsed < duration) {
        setLoadProgress(Math.min(1, elapsed / duration));
        if (elapsed < duration && isLoading) {
          frame = requestAnimationFrame(update);
        } else if (isLoading) {
          // After 7s, fallback to real loading progress
          fallbackToReal = true;
          frame = requestAnimationFrame(update);
        }
      } else if (isLoading) {
        // Fallback: estimate based on video readyState
        const video = videoRef.current;
        let progress = 0.95; // Default to nearly full
        if (video && video.buffered && video.buffered.length > 0 && video.duration) {
          const end = video.buffered.end(video.buffered.length - 1);
          progress = Math.min(1, end / video.duration);
        }
        setLoadProgress(progress);
        frame = requestAnimationFrame(update);
      }
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [isLoading, loaderTimeout]);

  // Always show the bar full for at least 300ms before hiding loader
  useEffect(() => {
    if (!isLoading && loadProgress === 1) {
      const timeout = setTimeout(() => {}, 300);
      return () => clearTimeout(timeout);
    }
  }, [isLoading, loadProgress]);

  // Start timer for minimum loader duration
  useEffect(() => {
    if (!isLoading) return;
    setMinTimeElapsed(false);
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_LOADER_TIME);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Hide loader only when both min time and loading are done
  useEffect(() => {
    if (minTimeElapsed && !isLoading) {
      setIsLoading(false);
      setShowInstructions(false);
    }
  }, [minTimeElapsed, isLoading]);

  // ✅ Hide loader (optionally mark as timeout error)
  const hideLoader = (timedOut = false) => {
    clearTimeout(timeoutRef.current);
    setIsLoading(false);
    // Only set error if truly failed (onError), not just timeout
    if (!timedOut) setHasTimeoutError(false);
    else setHasTimeoutError(true);
  };

  // 👆 Play/pause toggle on click
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video
        .play()
        .then(() => setIsPlaying?.(true))
        .catch((err) => {
          console.error('❌ play error:', err);
          setIsPlaying?.(false);
        });
    } else {
      video.pause();
      setIsPlaying?.(false);
    }
  };

  // Hide instructions on any user interaction (click/tap/keydown)
  useEffect(() => {
    if (!showInstructions) return;
    let timeout;
    const hide = () => setShowInstructions(false);
    window.addEventListener('pointerdown', hide, { once: true });
    window.addEventListener('keydown', hide, { once: true });
    // Auto-hide after 8 seconds (enough for all lines to animate in)
    timeout = setTimeout(() => setShowInstructions(false), 8000);
    return () => {
      window.removeEventListener('pointerdown', hide, { once: true });
      window.removeEventListener('keydown', hide, { once: true });
      clearTimeout(timeout);
    };
  }, [showInstructions]);

  // Track when loader/instructions are hidden
  useEffect(() => {
    if (!isLoading && !showInstructions && !hasTimeoutError) {
      onLoaderHidden?.();
    }
  }, [isLoading, showInstructions, hasTimeoutError, onLoaderHidden]);

  // Show skeleton only when loader/instructions are hidden AND video is playing
  const [skeletonReady, setSkeletonReady] = useState(false);
  useEffect(() => {
    if (!isLoading && !showInstructions && !hasTimeoutError) {
      setSkeletonReady(true);
    } else {
      setSkeletonReady(false);
    }
  }, [isLoading, showInstructions, hasTimeoutError]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* ⏳ Loader overlay */}
      <div
        className={`absolute inset-0 z-10 flex items-center justify-center bg-black/80 text-white text-sm transition-opacity duration-500 ${
          isLoading || (showInstructions && !hasTimeoutError)
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex flex-col items-center space-y-3 w-3/4 max-w-xs">
          {/* Progress bar */}
          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 transition-all duration-200"
              style={{ width: `${Math.round(loadProgress * 100)}%` }}
            />
          </div>
          <div className="text-base font-medium text-center">
            {hasTimeoutError
              ? '⚠️ Failed to load video.'
              : isLoading
                ? loadProgress >= 1
                  ? 'Still loading...'
                  : 'Loading your swing…'
                  : null}
          </div>
          {/* Instructional text */}
          {showInstructions && !hasTimeoutError && (
            <div
              className="text-xs text-white/80 text-center mt-1 cursor-pointer select-none"
              onClick={() => setShowInstructions(false)}
              role="button"
              tabIndex={0}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setShowInstructions(false)}
              aria-label="Dismiss instructions"
            >
              <span className="block opacity-0 animate-fadein [animation-delay:0.2s] [animation-duration:2.2s]">Mark Your 5 Key Swing Moments:</span>
              <span className="block font-semibold opacity-0 animate-fadein [animation-delay:2.5s] [animation-duration:2.2s]">Setup, Backswing, Apex, Downswing, & Follow-through.</span>
              <span className="block opacity-0 animate-fadein [animation-delay:4.8s] [animation-duration:2.2s]">Scrub to each on the timeline, then tap the matching button to lock it in.</span>
            </div>
          )}
          {!videoUrl && <div className="text-red-400 mt-2">No videoUrl provided</div>}
        </div>
      </div>

      {/* 🎥 Video element */}
      <video
        ref={videoRef}
        src={videoUrl || '/videos/test-clip.mp4'}
        preload="auto"
        muted
        playsInline
        controls={false}
        crossOrigin="anonymous"
        className="w-full h-full object-contain outline-none"
        tabIndex={0}
        aria-label="Video player"
        role="region"
        aria-live="polite"
        onKeyDown={(e) => {
          // Space/Enter toggles play, left/right seek
          if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            togglePlay();
          } else if (e.code === 'ArrowLeft') {
            e.preventDefault();
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
          } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            videoRef.current.currentTime = Math.min(
              videoRef.current.duration || 0,
              videoRef.current.currentTime + 5
            );
          }
        }}
        onLoadedData={() => {
          setIsLoading(false);
          setHasTimeoutError(false);
        }}
        onCanPlay={() => {
          if (isLoading) {
            setIsLoading(false);
            setHasTimeoutError(false);
          }
        }}
        onError={(e) => {
          setHasTimeoutError(true);
          setIsLoading(false);
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
      {/* Controls overlay (custom) */}
      {/* Play/Pause button removed from center overlay */}
    </div>
  );
});

export default SwingPlayer;

/* --- FADE-IN ANIMATION INSTRUCTIONS ---
// To enable the instructional text fade-in animation, add the following to your app/globals.css:
//
// @layer utilities {
//   @keyframes fadein {
//     from { opacity: 0; }
//     to { opacity: 1; }
//   }
//   .animate-fadein {
//     animation: fadein 0.7s ease forwards;
//   }
// }
//
// Or, if you prefer, extend your tailwind.config.js as follows:
//
// theme: {
//   extend: {
//     keyframes: {
//       fadein: {
//         '0%': { opacity: '0' },
//         '100%': { opacity: '1' },
//       },
//     },
//     animation: {
//       fadein: 'fadein 0.7s ease forwards',
//     },
//   },
// },
//
// Then restart your dev server to apply the changes.
//
// No spinner will be shown; the loader uses only the progress bar and animated instructional text.
*/
