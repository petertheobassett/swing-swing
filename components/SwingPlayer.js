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
    isReplaying = false,
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
  const [hasEverBeenReady, setHasEverBeenReady] = useState(false); // Use state instead of ref

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

  // Handle video ready state and reset loading state on video changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset states when video URL changes
    setVideoReady(false);
    setHasError(false);
    setLoadProgress(0);
    initialLoadCompleteRef.current = false;
    setHasEverBeenReady(false); // Reset the "ever been ready" flag on URL change

    const handleReady = () => {
      // Only log when video is truly ready (readyState 4 = HAVE_ENOUGH_DATA)
      if (video.readyState === 4) {
        console.log('Video ready (HAVE_ENOUGH_DATA), readyState:', video.readyState);
      }
      setVideoReady(true);
      setHasError(false);
      setLoadProgress(100); // Complete progress when ready
      initialLoadCompleteRef.current = true;
      setHasEverBeenReady(true); // Mark that video has been ready at least once
    };

    const handleError = () => {
      // console.log('Video error event fired'); // Debug log removed
      setHasError(true);
      setVideoReady(false);
    };

    // Check if video is already ready (for cached videos)
    const checkIfReady = () => {
      if (video.readyState >= 3) { // HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA
        // Only log if truly ready
        if (video.readyState === 4) {
          console.log('Video already ready on mount (HAVE_ENOUGH_DATA), readyState:', video.readyState);
        }
        handleReady();
        return true;
      }
      return false;
    };

    // Check immediately in case video is already loaded
    if (!checkIfReady()) {
      // Only add listeners if not already ready
      video.addEventListener('canplay', handleReady);
      video.addEventListener('loadeddata', handleReady);
      video.addEventListener('loadedmetadata', handleReady);
      video.addEventListener('error', handleError);
    }

    return () => {
      video.removeEventListener('canplay', handleReady);
      video.removeEventListener('loadeddata', handleReady);
      video.removeEventListener('loadedmetadata', handleReady);
      video.removeEventListener('error', handleError);
    };
  }, [videoUrl]);

  // Progress animation during loading with proper reset
  useEffect(() => {
    if (videoReady || hasEverBeenReady) return; // Don't show progress if already been ready
    
    setLoadProgress(0);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 2;
      setLoadProgress(Math.min(progress, 95));
      if (progress >= 95) clearInterval(interval);
    }, 100);

    // Fallback: Force video ready after 5 seconds if still loading
    const fallbackTimer = setTimeout(() => {
      const video = videoRef.current;
      if (!videoReady && video) {
        console.log('Fallback: forcing video ready after 5s timeout, readyState:', video.readyState);
        setVideoReady(true);
        setLoadProgress(100);
        setHasEverBeenReady(true);
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(fallbackTimer);
    };
  }, [videoReady, videoUrl, hasEverBeenReady]); // Include hasEverBeenReady in deps

  // Auto-dismiss instructions (reset on video change)
  useEffect(() => {
    setShowInstructions(true); // Reset instructions when video changes
    const timer = setTimeout(() => setShowInstructions(false), 3000); // Reduced to 3 seconds
    return () => clearTimeout(timer);
  }, [videoUrl]);

  // Call onLoaderHidden when ready - don't wait for instructions to dismiss
  useEffect(() => {
    if (videoReady && !hasError) {
      console.log('Video ready, calling onLoaderHidden after delay');
      // Complete the progress bar animation
      setLoadProgress(100);
      
      const timer = setTimeout(() => {
        console.log('Calling onLoaderHidden callback');
        onLoaderHidden?.();
      }, 500); // Slightly longer delay to show completed progress
      return () => clearTimeout(timer);
    }
  }, [videoReady, hasError]); // Removed onLoaderHidden from deps

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
    if (!video || isReplaying) return; // Don't interfere during replay

    // Skip if already in desired state
    if ((isPlaying && !video.paused) || (!isPlaying && video.paused)) {
      return;
    }

    if (isPlaying) {
      video.play().catch(console.warn);
    } else {
      video.pause();
    }
  }, [isPlaying, isReplaying]);

  const showLoader = !videoReady && !hasError && !hasEverBeenReady;
  
  return (
    <div className="relative w-full h-full bg-white overflow-hidden">
      {/* Simple loader overlay */}
      <div
        className={`absolute inset-0 z-10 flex items-center justify-center bg-black/80 text-white text-sm transition-opacity duration-500 ${
          showLoader ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex flex-col items-center space-y-3 w-3/4 max-w-xs px-4">
          {!hasError && (
            <div className="w-full h-2 bg-white bg-opacity-20 rounded-full overflow-hidden">
              <div
                className="h-2 bg-white rounded transition-all duration-300"
                style={{ width: `${Math.round(loadProgress)}%` }}
              />
            </div>
          )}
          
          <div className="text-base font-medium text-center">
            {hasError ? '⚠️ Failed to load video.' : 'Loading your swing…'}
          </div>
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
