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
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    setDuration,
    onLoaderHidden,
    onError,
    onLoadStart,
  },
  ref
) {
  const videoRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const hasSetDuration = useRef(false);
  const initialLoadCompleteRef = useRef(false);

  // Expose simple video controls to parent
  useImperativeHandle(
    ref,
    () => ({
      seekTo: (time) => {
        const video = videoRef.current;
        if (video) {
          video.currentTime = time;
        }
      },
      play: async () => {
        const video = videoRef.current;
        if (!video) return false;
        
        try {
          await video.play();
          return !video.paused;
        } catch (error) {
          console.warn('Play failed:', error);
          return false;
        }
      },
      pause: async () => {
        const video = videoRef.current;
        if (!video) return false;
        
        try {
          video.pause();
          return video.paused;
        } catch (error) {
          console.warn('Pause failed:', error);
          return false;
        }
      },
      get video() {
        return videoRef.current;
      },
    }),
    []
  );

  // Handle video ready state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleReady = () => {
      setVideoReady(true);
      setHasError(false);
      initialLoadCompleteRef.current = true;
    };

    const handleError = () => {
      if (!initialLoadCompleteRef.current) {
        setHasError(true);
      }
    };

    video.addEventListener('canplay', handleReady);
    video.addEventListener('loadeddata', handleReady);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('canplay', handleReady);
      video.removeEventListener('loadeddata', handleReady);
      video.removeEventListener('error', handleError);
    };
  }, [videoUrl]);

  // Simple progress animation during loading
  useEffect(() => {
    if (videoReady || initialLoadCompleteRef.current) return;
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += 2;
      setLoadProgress(Math.min(progress, 95));
      if (progress >= 95) clearInterval(interval);
    }, 100);

    return () => clearInterval(interval);
  }, [videoReady]);

  // Auto-dismiss instructions
  useEffect(() => {
    const timer = setTimeout(() => setShowInstructions(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  // Call onLoaderHidden when ready
  useEffect(() => {
    if (videoReady && !showInstructions && !hasError) {
      const timer = setTimeout(() => {
        onLoaderHidden?.();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [videoReady, showInstructions, hasError, onLoaderHidden]);

  // Capture duration
  useLayoutEffect(() => {
    const video = videoRef.current;
    if (
      video &&
      video.readyState >= 1 &&
      video.duration &&
      !isNaN(video.duration) &&
      !hasSetDuration.current
    ) {
      hasSetDuration.current = true;
      setDuration?.(video.duration);
    }
  }, [setDuration]);

  // Sync currentTime
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !setCurrentTime) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [setCurrentTime]);

  // Sync play/pause state
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !setIsPlaying) return;
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [setIsPlaying]);

  // Simple play/pause control
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Skip if already in desired state
    if ((isPlaying && !video.paused) || (!isPlaying && video.paused)) {
      return;
    }

    if (isPlaying) {
      video.play().catch(console.warn);
    } else {
      video.pause();
    }
  }, [isPlaying]);

  const showLoader = (!videoReady || showInstructions) && !hasError && !initialLoadCompleteRef.current;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Simple loader overlay */}
      <div
        className={`absolute inset-0 z-10 flex items-center justify-center bg-black/80 text-white text-sm transition-opacity duration-500 ${
          showLoader ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex flex-col items-center space-y-3 w-3/4 max-w-xs px-4">
          {!hasError && (
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 transition-all duration-200"
                style={{ width: `${Math.round(loadProgress)}%` }}
              />
            </div>
          )}
          
          <div className="text-base font-medium text-center">
            {hasError ? '⚠️ Failed to load video.' : 'Loading your swing…'}
          </div>
          
          {showInstructions && !hasError && (
            <div
              className="text-xs text-white/80 text-center mt-1 cursor-pointer select-none"
              onClick={() => setShowInstructions(false)}
              role="button"
              tabIndex={0}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setShowInstructions(false)}
            >
              <span className="block">Mark Your 5 Key Swing Moments:</span>
              <span className="block font-semibold">Setup, Backswing, Apex, Downswing, & Follow-through.</span>
              <span className="block">Scrub to each on the timeline, then tap the matching button to lock it in.</span>
            </div>
          )}
        </div>
      </div>

      <video
        ref={videoRef}
        src={videoUrl || '/videos/test-clip.mp4'}
        preload="auto"
        muted={true}
        playsInline={true}
        controls={false}
        className="w-full max-w-full h-auto object-contain outline-none max-h-[80vh] sm:max-w-[530px] sm:max-h-[80vh]"
        style={{ margin: '0 auto', display: 'block' }}
        onError={onError}
        onLoadStart={onLoadStart}
        onLoadedMetadata={() => {
          if (videoRef.current?.duration && !hasSetDuration.current) {
            hasSetDuration.current = true;
            setDuration?.(videoRef.current.duration);
          }
        }}
        onContextMenu={e => e.preventDefault()}
      />
    </div>
  );
});

export default SwingPlayer;
