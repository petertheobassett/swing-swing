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
    loaderTimeout = 4000,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    setDuration,
  },
  ref
) {
  const videoRef = useRef(null);
  const timeoutRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasTimeoutError, setHasTimeoutError] = useState(false);
  const hasSetDuration = useRef(false);

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
      console.warn('⏳ Loader fallback timeout hit');
      hideLoader(true);
    }, loaderTimeout);
    return () => clearTimeout(timeoutRef.current);
  }, [loaderTimeout]);

  // 🧠 Fallback: readyState polling
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video?.readyState >= 2) {
        console.log('✅ readyState: video is ready');
        hideLoader();
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
    if (isPlaying) {
      video
        .play()
        .then(() => setIsPlaying?.(true))
        .catch((err) => {
          console.error('❌ play() error:', err);
          setIsPlaying?.(false);
        });
    } else {
      video.pause();
      setIsPlaying?.(false);
    }
  }, [isPlaying, setIsPlaying]);

  // ✅ Hide loader (optionally mark as timeout error)
  const hideLoader = (timedOut = false) => {
    clearTimeout(timeoutRef.current);
    setIsLoading(false);
    setHasTimeoutError(timedOut);
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

  return (
    <div className="p-4 w-full max-w-md mx-auto">
      <div className="relative w-full aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-md">
        {/* ⏳ Loader overlay */}
        <div
          className={`absolute inset-0 z-10 flex items-center justify-center bg-black/80 text-white text-sm transition-opacity duration-500 ${
            isLoading ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex flex-col items-center space-y-2">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <div>{hasTimeoutError ? '⚠️ Failed to load video in time.' : 'Loading video...'}</div>
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
          tabIndex={0} // 🆕 Make video focusable for keyboard
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
            console.log('✅ onLoadedData fired');
            hideLoader();
          }}
          onCanPlay={() => {
            if (isLoading) {
              console.log('✅ onCanPlay fired');
              hideLoader();
            }
          }}
          onError={(e) => {
            console.error('❌ onError fired:', e);
            hideLoader(true);
          }}
          onClick={togglePlay}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    </div>
  );
});

export default SwingPlayer;
