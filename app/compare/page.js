"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import SwingPlayer from "@/components/SwingPlayer";
import MotionTracker from "@/components/MotionTracker";

const FALLBACK_VIDEO_URL = "/videos/test-clip.mp4";
const HOGAN_REFERENCE_VIDEO = "/videos/Ben-Hogan.mp4";
const swingPhases = ["Setup", "Back", "Apex", "Impact", "Follow"];
const PLAYBACK_SPEEDS = [1, 0.75, 0.5, 0.25, 0.1];

// Hogan swing phase timestamps (converted from frames at 24fps)
const HOGAN_PHASE_TIMESTAMPS = {
  Setup: 2.17,   // 52 frames ÷ 24fps
  Back: 2.50,    // 60 frames ÷ 24fps  
  Apex: 3.00,    // 72 frames ÷ 24fps
  Impact: 3.25,  // 78 frames ÷ 24fps
  Follow: 3.88   // 93 frames ÷ 24fps
};

export default function ComparePage() {
  const videoRef = useRef(null);
  const hoganVideoRef = useRef(null);
  const progressBarRef = useRef(null);
  const replayListenerRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState(FALLBACK_VIDEO_URL);
  const [duration, setDuration] = useState(0);
  const [phases, setPhases] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [hoganScale, setHoganScale] = useState(1);
  const [hoganOffset, setHoganOffset] = useState({ x: 0, y: 0 });
  const [userBodyMeasurements, setUserBodyMeasurements] = useState(null);
  const [hoganBodyMeasurements, setHoganBodyMeasurements] = useState(null);
  const [hoganPlaybackRate, setHoganPlaybackRate] = useState(1);

  // Check if all phases are marked
  const allPhasesMarked = swingPhases.every((phase) => phases[phase]);

  // Add loadingSkeleton state to track when the skeleton (MotionTracker) is loading
  const [loadingSkeleton, setLoadingSkeleton] = useState(false);
  const [skeletonProgress, setSkeletonProgress] = useState(0);

  // Animate skeleton progress bar when loadingSkeleton is true
  useEffect(() => {
    let interval;
    if (loadingSkeleton) {
      setSkeletonProgress(0);
      interval = setInterval(() => {
        setSkeletonProgress((prev) => {
          if (prev >= 100) return 100;
          // Fill quickly at first, then slow down
          return prev + (prev < 80 ? 3 : 1.5);
        });
      }, 30);
    } else {
      setSkeletonProgress(0);
    }
    return () => interval && clearInterval(interval);
  }, [loadingSkeleton]);

  // Calculate Hogan's playback rate based on swing durations
  const calculateHoganPlaybackRate = useCallback(() => {
    if (!allPhasesMarked) return 1;
    
    const userBackTime = parseFloat(phases.Back);
    const userFollowTime = parseFloat(phases.Follow);
    const hoganBackTime = parseFloat(HOGAN_PHASE_TIMESTAMPS.Back);
    const hoganFollowTime = parseFloat(HOGAN_PHASE_TIMESTAMPS.Follow);
    
    if (isNaN(userBackTime) || isNaN(userFollowTime) || 
        isNaN(hoganBackTime) || isNaN(hoganFollowTime)) {
      return 1;
    }
    
    const userSwingDuration = userFollowTime - userBackTime;
    const hoganSwingDuration = hoganFollowTime - hoganBackTime;
    
    if (userSwingDuration <= 0 || hoganSwingDuration <= 0) {
      return 1;
    }
    
    // Calculate rate so Hogan's swing matches user's swing duration
    const rate = hoganSwingDuration / userSwingDuration;
    
    console.log('Swing duration calculation:', {
      userSwingDuration: userSwingDuration.toFixed(3),
      hoganSwingDuration: hoganSwingDuration.toFixed(3),
      calculatedRate: rate.toFixed(3)
    });
    
    return rate;
  }, [allPhasesMarked, phases]);

  // Apply Hogan's playback rate when comparison mode starts or phases change
  useEffect(() => {
    if (comparisonMode && allPhasesMarked) {
      const newRate = calculateHoganPlaybackRate();
      setHoganPlaybackRate(newRate);
      
      // Apply the rate to Hogan's video immediately
      const hoganVideo = hoganVideoRef.current?.video;
      if (hoganVideo) {
        hoganVideo.playbackRate = newRate * playbackSpeed;
        console.log('Applied Hogan playback rate:', newRate * playbackSpeed);
      }
    }
  }, [comparisonMode, allPhasesMarked, phases, calculateHoganPlaybackRate, playbackSpeed]);

  // Check for uploaded video from main page on component mount
  useEffect(() => {
    const uploadedVideo = localStorage.getItem('swingAnalysisVideo');
    if (uploadedVideo) {
      console.log('Found uploaded video from main page:', uploadedVideo);
      setVideoUrl(uploadedVideo);
      // Clear it from localStorage so it doesn't persist across sessions
      localStorage.removeItem('swingAnalysisVideo');
    }
  }, []);

  // Handle phase marking
  const handleMarkPhase = (phase) => {
    if (phases[phase]) {
      setConfirmModal({
        phase,
        currentTime: phases[phase],
        onConfirm: () => {
          setPhases((prev) => ({
            ...prev,
            [phase]: currentTime.toFixed(2),
          }));
          setConfirmModal(null);
          
          if (phase === "Setup") {
            setShowSkeleton(true);
            setLoadingSkeleton(true); // Show loading line when skeleton starts loading
            console.log("setLoadingSkeleton(true) called");
          }
        },
        onCancel: () => setConfirmModal(null)
      });
      return;
    }
    
    setPhases((prev) => ({
      ...prev,
      [phase]: currentTime.toFixed(2),
    }));

    if (phase === "Setup") {
      setShowSkeleton(true);
      setLoadingSkeleton(true); // Show loading line when skeleton starts loading (first time)
      console.log("setLoadingSkeleton(true) called (first time)");
    }
  };

  // Calculate body measurements from pose landmarks
  const calculateBodyMeasurements = (landmarks) => {
    if (!landmarks || landmarks.length < 33) return null;
    
    // Get ankle and head positions (using MediaPipe pose landmarks)
    const leftAnkle = landmarks[27]; // Left ankle
    const rightAnkle = landmarks[28]; // Right ankle
    const nose = landmarks[0]; // Nose as head reference
    
    if (!leftAnkle || !rightAnkle || !nose) return null;
    
    // Calculate average ankle position
    const avgAnkleY = (leftAnkle.y + rightAnkle.y) / 2;
    const headY = nose.y;
    
    // Calculate height (ankle to head distance)
    const height = Math.abs(avgAnkleY - headY);
    
    return {
      height,
      headY,
      avgAnkleY,
      landmarks
    };
  };

  // Calculate scaling factor when both measurements are available
  const calculateScaling = () => {
    if (!userBodyMeasurements || !hoganBodyMeasurements) return;
    
    const userHeight = userBodyMeasurements.height;
    const hoganHeight = hoganBodyMeasurements.height;
    
    if (userHeight > 0 && hoganHeight > 0) {
      const scale = userHeight / hoganHeight;
      console.log('Calculated scaling:', { userHeight, hoganHeight, scale });
      setHoganScale(scale);
      
      // Calculate vertical offset to align ankle positions
      const userAnkleY = userBodyMeasurements.avgAnkleY;
      const hoganAnkleY = hoganBodyMeasurements.avgAnkleY;
      const offsetY = (userAnkleY - hoganAnkleY) * 100; // Convert to percentage
      
      setHoganOffset({ x: 0, y: offsetY });
    }
  };

  // Trigger scaling calculation when measurements change
  useEffect(() => {
    calculateScaling();
  }, [userBodyMeasurements, hoganBodyMeasurements]);

  // Trigger comparison mode when all phases are marked
  useEffect(() => {
    if (allPhasesMarked && !comparisonMode) {
      console.log('All phases marked, entering comparison mode');
      setComparisonMode(true);
    }
  }, [allPhasesMarked, comparisonMode]);

  // Removed calculateTimeMapping - now using duration-based playback rate synchronization

  // Simple sync function for scrubbing only - no sync during playback 
  const syncHoganVideo = useCallback((userCurrentTime) => {
    if (!comparisonMode || !hoganVideoRef.current?.video || !allPhasesMarked) return;
    
    const hoganVideo = hoganVideoRef.current.video;
    
    // For scrubbing, maintain the time relationship between back times
    const userBackTime = parseFloat(phases.Back);
    const hoganBackTime = parseFloat(HOGAN_PHASE_TIMESTAMPS.Back);
    
    if (isNaN(userBackTime) || isNaN(hoganBackTime)) return;
    
    // Calculate relative time from back
    const userRelativeTime = userCurrentTime - userBackTime;
    const hoganTargetTime = hoganBackTime + userRelativeTime;
    
    // Only sync if there's a significant difference to avoid constant updates
    const timeDiff = Math.abs(hoganVideo.currentTime - hoganTargetTime);
    if (timeDiff > 0.1) {
      hoganVideo.currentTime = Math.max(0, hoganTargetTime);
      console.log(`Scrubbing sync: User at ${userCurrentTime.toFixed(2)}s, Hogan seeked to ${hoganTargetTime.toFixed(2)}s`);
    }
  }, [comparisonMode, allPhasesMarked, phases]);

  // Handle scrubbing
  const handleDrag = (e) => {
    if (duration === 0) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const seekTo = duration * percent;
    videoRef.current?.seekTo?.(seekTo);
    
    // Sync Hogan video when scrubbing
    if (comparisonMode) {
      syncHoganVideo(seekTo);
    }
  };

  // Removed throttled sync effect - now using duration-based playback rate synchronization

  // Handle replay functionality
  const handleReplay = async () => {
    console.log('handleReplay called:', { allPhasesMarked, videoRef: !!videoRef.current, phases });
    if (!allPhasesMarked || !videoRef.current) return;

    const backTime = parseFloat(phases.Back);
    const followTime = parseFloat(phases.Follow);

    console.log('Phase times:', { backTime, followTime, backRaw: phases.Back, followRaw: phases.Follow });

    if (isNaN(backTime) || isNaN(followTime) || backTime >= followTime) {
      console.error('Invalid phase times:', { backTime, followTime, backRaw: phases.Back, followRaw: phases.Follow });
      return;
    }

    console.log(`Starting replay: ${backTime}s -> ${followTime}s`);
    setIsReplaying(true);

    try {
      // Clean up any existing replay listener
      const video = videoRef.current.video;
      const hoganVideo = hoganVideoRef.current?.video;
      
      if (replayListenerRef.current && video) {
        video.removeEventListener('timeupdate', replayListenerRef.current);
        replayListenerRef.current = null;
      }

      // First pause both videos
      await videoRef.current.pause();
      if (hoganVideo && comparisonMode) {
        hoganVideo.pause();
      }
      setIsPlaying(false);
      
      // Seek both videos to their respective start positions
      videoRef.current.seekTo(backTime);
      if (hoganVideo && comparisonMode) {
        // Seek Hogan to his back time (not user's back time)
        const hoganBackTime = parseFloat(HOGAN_PHASE_TIMESTAMPS.Back);
        hoganVideo.currentTime = hoganBackTime;
        console.log(`Seeking Hogan to his back time: ${hoganBackTime}s (user back: ${backTime}s)`);
      }
      
      // Brief wait for seek operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!video) {
        console.error('No video element available');
        setIsReplaying(false);
        return;
      }

      // Create and store the timeupdate listener  
      const handleTimeUpdate = () => {
        console.log(`Replay timeupdate: currentTime=${video.currentTime}s, followTime=${followTime}s, paused=${video.paused}`);
        
        // Stop when user video reaches follow time
        if (video.currentTime >= followTime) {
          console.log(`Replay complete at ${video.currentTime}s`);
          // Use the stored reference for cleanup
          if (replayListenerRef.current) {
            video.removeEventListener('timeupdate', replayListenerRef.current);
            replayListenerRef.current = null;
          }
          video.pause();
          if (hoganVideo && comparisonMode) {
            hoganVideo.pause();
          }
          setIsPlaying(false);
          setIsReplaying(false);
        }
      };

      replayListenerRef.current = handleTimeUpdate;
      video.addEventListener('timeupdate', handleTimeUpdate);
      
      // Start playing both videos
      try {
        setIsPlaying(true);
        
        // Apply correct playback rates - user video at normal speed, Hogan at calculated rate
        video.playbackRate = playbackSpeed;
        if (hoganVideo && comparisonMode) {
          // Apply both the calculated rate and the user's speed setting
          hoganVideo.playbackRate = hoganPlaybackRate * playbackSpeed;
          console.log(`Applied Hogan playback rate: ${hoganPlaybackRate * playbackSpeed} (base rate: ${hoganPlaybackRate}, speed: ${playbackSpeed})`);
        }
      
        // Start both videos simultaneously
        const playPromises = [video.play()];
        if (hoganVideo && comparisonMode) {
          playPromises.push(hoganVideo.play());
        }
        
        // Wait for both videos to start playing
        await Promise.all(playPromises);
        console.log('Both videos started playing simultaneously from their respective back times');
        console.log(`User video: ${video.currentTime.toFixed(2)}s at ${video.playbackRate}x speed`);
        if (hoganVideo && comparisonMode) {
          console.log(`Hogan video: ${hoganVideo.currentTime.toFixed(2)}s at ${hoganVideo.playbackRate}x speed`);
        }
        
        console.log('Replay started successfully, video.paused:', video.paused, 'video.currentTime:', video.currentTime, 'playbackRate:', video.playbackRate);
        
        // Add a periodic check to monitor playback progress
        const progressCheck = setInterval(() => {
          console.log(`Replay progress check: currentTime=${video.currentTime}s, paused=${video.paused}, playbackRate=${video.playbackRate}`);
          if (video.paused || video.currentTime >= followTime || !replayListenerRef.current) {
            clearInterval(progressCheck);
            if (video.currentTime >= followTime) {
              console.log('Progress check detected completion, triggering cleanup');
              if (replayListenerRef.current) {
                video.removeEventListener('timeupdate', replayListenerRef.current);
                replayListenerRef.current = null;
              }
              video.pause();
              if (hoganVideo && comparisonMode) {
                hoganVideo.pause();
              }
              setIsPlaying(false);
              setIsReplaying(false);
            }
          }
        }, 500);
        
      } catch (playError) {
        console.error('Failed to start replay playback:', playError);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        replayListenerRef.current = null;
        setIsPlaying(false);
        setIsReplaying(false);
      }
    } catch (error) {
      console.error('Replay failed:', error);
      setIsReplaying(false);
    }
  };

  // Handle main play/pause button
  const handlePlayPause = () => {
    console.log('Play/pause clicked:', { allPhasesMarked, isPlaying, isReplaying });
    
    if (allPhasesMarked && !isPlaying && !isReplaying) {
      console.log('Triggering replay');
      handleReplay();
    } else if (!isReplaying) {
      console.log('Toggling play/pause');
      setIsPlaying(!isPlaying);
    }
  };

  // Handle playback speed change
  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    const video = videoRef.current?.video;
    const hoganVideo = hoganVideoRef.current?.video;
    
    if (video) video.playbackRate = speed;
    if (hoganVideo && comparisonMode) {
      // Apply both the calculated rate and the new speed setting
      hoganVideo.playbackRate = hoganPlaybackRate * speed;
      console.log(`Speed changed - Hogan playback rate: ${hoganPlaybackRate * speed} (base rate: ${hoganPlaybackRate}, speed: ${speed})`);
    }
  };

  // Cleanup replay listener on component unmount
  useEffect(() => {
    return () => {
      const video = videoRef.current?.video;
      if (replayListenerRef.current && video) {
        video.removeEventListener('timeupdate', replayListenerRef.current);
        replayListenerRef.current = null;
      }
    };
  }, []);

  // Drag handling
  useEffect(() => {
    const handleUp = () => setIsDragging(false);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchend", handleUp);
    };
  }, []);

  // Handle touch events for progress bar
  useEffect(() => {
    const bar = progressBarRef.current;
    if (!bar) return;
    
    const handleTouchStart = (e) => {
      e.preventDefault();
      setIsDragging(true);
      handleDrag(e);
    };
    
    const handleTouchMove = (e) => {
      if (isDragging) {
        e.preventDefault();
        handleDrag(e);
      }
    };
    
    bar.addEventListener("touchstart", handleTouchStart, { passive: false });
    bar.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      bar.removeEventListener("touchstart", handleTouchStart);
      bar.removeEventListener("touchmove", handleTouchMove);
    };
  }, [isDragging, duration]);

  const handleVideoError = useCallback(() => {
    setError("Failed to load video");
    setIsLoading(false);
  }, []);

  const handleVideoLoadStart = useCallback(() => {
    // Don't set loading state during replay operations
    if (isReplaying) {
      console.log('Video load start triggered during replay - ignoring');
      return;
    }
    console.log('Video load start triggered');
    setIsLoading(true);
    setError(null);
  }, [isReplaying]);

  const handleVideoLoaded = useCallback(() => {
    console.log('Video loaded triggered');
    setIsLoading(false);
    setError(null);
  }, []);

  const handlePlayPauseKey = (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handlePlayPause();
    }
  };

  const handlePhaseKey = (e, phase) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleMarkPhase(phase);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden", // Prevent scrollbars
      }}
    >

      <div className="w-full max-w-[430px] mx-auto px-1 flex flex-col items-center" style={{ gap: '5px' }}>
        <div
          className="relative"
          style={{
            width: "100%",
            aspectRatio: "9/16",
            maxHeight: "100vh",
            marginBottom: 0, // Remove bottom margin since we're using gap in parent
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Main video container */}
          <div className="relative w-full h-full">
            <SwingPlayer
              ref={videoRef}
              videoUrl={videoUrl}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              currentTime={currentTime}
              setCurrentTime={setCurrentTime}
              setDuration={setDuration}
              onLoaderHidden={handleVideoLoaded}
              onError={handleVideoError}
              onLoadStart={handleVideoLoadStart}
              isReplaying={isReplaying}
            />

            {/* Show loading line when skeleton is loading */}
              {loadingSkeleton && (
                <div className="ui-loading ui-absolute-center">
                  Loading motion tracking...
                  <div className="w-full h-2 bg-white bg-opacity-20 rounded mt-2">
                    <div
                      className="h-2 bg-white rounded transition-all duration-300"
                      style={{ width: `${skeletonProgress}%` }}
                    />
                  </div>
                </div>
              )}

            {/* Hogan comparison video overlay */}
            {comparisonMode && (
              <div 
                className="absolute top-0 left-0 w-full h-full overflow-hidden"
                style={{ 
                  zIndex: 20,
                  // Position Hogan slightly to the right and scale down to match user video
                  transform: `translateX(15%) scale(0.475)`,
                  transformOrigin: 'center center',
                  // Advanced masking with blend modes for better overlay
                  mixBlendMode: 'multiply',
                  opacity: 0.85
                }}
              >
                <div 
                  className="w-full h-full"
                  style={{
                    // Enhanced filtering for better overlay visibility
                    filter: 'contrast(1.3) saturate(0.7) brightness(1.1)',
                    // Create an elliptical mask around the golfer
                    clipPath: 'ellipse(45% 47% at 50% 50%)',
                    // Subtle background fade
                    background: 'radial-gradient(ellipse 40% 60% at 50% 50%, transparent 70%, rgba(255,255,255,0.1) 90%)'
                  }}
                >
                  <SwingPlayer
                    ref={hoganVideoRef}
                    videoUrl={HOGAN_REFERENCE_VIDEO}
                    isPlaying={isPlaying}
                    setIsPlaying={() => {}} // Don't let Hogan video control main state
                    currentTime={currentTime}
                    setCurrentTime={() => {}} // Sync with main video
                    setDuration={() => {}} // Don't override main duration
                    onLoaderHidden={() => {}}
                    onError={() => {}}
                    onLoadStart={() => {}}
                    isReplaying={isReplaying}
                  />
                </div>
              </div>
            )}
          </div>
          
          {error && (
            <div className="ui-error ui-absolute-center">{error}</div>
          )}
          
          {isLoading && !isReplaying && (
            <div className="ui-loading ui-absolute-center">Loading video...</div>
          )}

          {/* Comparison mode controls overlaid on video bottom */}
          {comparisonMode && (
            <div 
              className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-3 rounded-b-lg"
              style={{ zIndex: 90 }}
            >
              <div className="flex flex-col items-center gap-2 w-full">
                {/* Speed controls and status in one row */}
                <div className="flex items-center justify-between w-full max-w-md">
                  {/* Speed controls */}
                  <div className="flex items-center gap-2"> 
                    <span className="text-xs font-medium text-white bg-black bg-opacity-30 px-2 py-1 rounded">Speed:</span>
                    {PLAYBACK_SPEEDS.map((speed) => (
                      <button
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          playbackSpeed === speed
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-black bg-opacity-40 text-white hover:bg-opacity-60 border border-white border-opacity-30'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                  
                  {/* Scaling status indicator */}
                  {(userBodyMeasurements || hoganBodyMeasurements || comparisonMode) && (
                    <div className="text-xs text-white text-right">
                      {userBodyMeasurements && hoganBodyMeasurements ? (
                        <span className="text-green-400">
                          ✓ Scaled {(hoganScale * 100).toFixed(0)}%
                        </span>
                      ) : comparisonMode ? (
                        null
                      ) : (
                        <span className="text-orange-400">
                          ⚡ Calculating...
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
              </div>
            </div>
          )}

          {/* Controls */}
          <div
            className="absolute flex flex-col items-center justify-center w-full gap-1"
            style={{ 
              maxWidth: "400px",
              bottom: "8%", // Position from bottom, adjust as needed
              left: 10,
              zIndex: 40,
              background: 'transparent', // Semi-transparent background
              padding: '15px 0',
              borderRadius: '8px'
            }}
          >
            {/* Main playback controls */}
            <div className="flex flex-row items-center justify-center w-[87%] gap-1">
              {/* Context-aware play/replay button */}
              <button
                className="ui-btn-pill"
                onClick={handlePlayPause}
                onKeyDown={handlePlayPauseKey}
                aria-label={
                  allPhasesMarked && !isPlaying && !isReplaying
                    ? "Replay swing from Setup to Follow" 
                    : isPlaying 
                      ? "Pause video" 
                      : "Play video"
                }
                tabIndex={0}
                style={{
                  width: 50,
                  height: 50,
                  minWidth: 50,
                  minHeight: 50,
                  borderWidth: 2,
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
                disabled={isReplaying}
              >
                {isReplaying ? (
                  // Loading spinner during replay
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                ) : isPlaying ? (
                  // Pause icon
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
                    <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
                  </svg>
                ) : allPhasesMarked ? (
                  // Replay icon
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path 
                      d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"
                      fill="currentColor"
                    />
                    <polygon points="10,10 14,12 10,14" fill="currentColor" />
                  </svg>
                ) : (
                  // Play icon
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="8,5 19,12 8,19" fill="currentColor" />
                  </svg>
                )}
              </button>

              {/* Progress bar */}
              <div
                ref={progressBarRef}
                className="ui-progress-bar"
                onMouseDown={(e) => {
                  e.preventDefault();
                  isDraggingRef.current = true;
                  handleDrag(e);
                }}
                onMouseMove={(e) => {
                  if (isDragging) handleDrag(e);
                }}
                style={{
                  flex: 1,
                  height: 19,
                  background: "#e5e7eb",
                  borderRadius: 8,
                  position: "relative",
                  cursor: "pointer",
                  touchAction: "none",
                  minWidth: "100px", /* Ensure minimum width */
                  display: "flex",
                  alignItems: "center"
                }}
              >
                {/* Progress fill */}
                <div
                  className="ui-progress-bar-fill"
                  style={{
                    width: duration ? `${(currentTime / duration) * 100}%` : "0%",
                  }}
                />
                
                {/* Golf ball thumb */}
                <div
                  className="ui-progress-bar-thumb"
                  style={{
                    left: duration ? `${(currentTime / duration) * 100}%` : "0%",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 40 40"
                    className="rounded-full"
                    style={{ display: "block" }}
                  >
                    <defs>
                      <pattern
                        id="golf-dimples"
                        patternUnits="userSpaceOnUse"
                        width="8"
                        height="8"
                      >
                        <circle cx="4" cy="4" r="1.2" fill="#d1d5db" />
                      </pattern>
                    </defs>
                    <circle cx="20" cy="20" r="18" fill="url(#golf-dimples)" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Motion tracker for user video */}
          {showSkeleton && phases.Setup && (
            <MotionTracker
              videoRef={videoRef}
              timestamp={!isPlaying && !isReplaying ? currentTime : undefined}
              drawOnce={!isPlaying && !isReplaying}
              onComplete={(landmarks) => {
                setLoadingSkeleton(false); // Hide loading line when skeleton/model is ready
                if (landmarks && !userBodyMeasurements) {
                  const measurements = calculateBodyMeasurements(landmarks);
                  if (measurements) {
                    console.log('User body measurements:', measurements);
                    setUserBodyMeasurements(measurements);
                  }
                }
              }}
            />
          )}

          {/* Motion tracker for Hogan video - positioned to match the translated overlay */}
          {comparisonMode && showSkeleton && phases.Setup && (
            <div 
              className="absolute top-0 left-0 w-full h-full pointer-events-none" 
              style={{ 
                zIndex: 40,
                // Match the exact same transform as the Hogan video overlay for perfect alignment
                transform: `translateX(15%) scale(0.5)`,
                transformOrigin: 'center center',
                // Remove overflow: 'hidden' and clipPath so skeleton legs are not clipped
                // The skeleton should be visible beyond the video mask and above all other UI elements
              }}
            >
              <MotionTracker
                videoRef={hoganVideoRef}
                timestamp={!isPlaying && !isReplaying ? currentTime : undefined}
                drawOnce={!isPlaying && !isReplaying}
                isTransformed={true}
                transformScale={0.5}
                transformTranslateX={15}
                onComplete={(landmarks) => {
                  if (landmarks && !hoganBodyMeasurements) {
                    const measurements = calculateBodyMeasurements(landmarks);
                    if (measurements) {
                      console.log('Hogan body measurements:', measurements);
                      setHoganBodyMeasurements(measurements);
                    }
                  }
                }}
              />
            </div>
          )}

          {/* Confirmation Modal */}
          {confirmModal && (
            <div 
              className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
              style={{ borderRadius: 'inherit' }}
            >
              <div className="bg-white rounded-xl p-4 mx-4 max-w-xs w-full shadow-xl">
                <h3 className="text-base font-semibold text-gray-900 mb-2">
                  Overwrite {confirmModal.phase}?
                </h3>
                <p className="text-sm text-gray-600 mb-4 leading-snug">
                  Currently at {confirmModal.currentTime}s. Replace with {currentTime.toFixed(2)}s?
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={confirmModal.onCancel}
                    className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmModal.onConfirm}
                    className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Replace
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Phase buttons - positioned to float over video */}
          <div 
            className="absolute flex items-center justify-center w-full"
            style={{ 
              bottom: "15%", // Position from bottom, above the playback controls
              zIndex: 45, // Higher than other UI elements
              background: 'transparent', // transparent background
              padding: '4px 4px',
              borderRadius: '4px'
            }}
          >
            <div className="ui-phase-grid">
              {swingPhases.map((phase) => (
                <button
                  key={phase}
                  onClick={() => handleMarkPhase(phase)}
                  onKeyDown={(e) => handlePhaseKey(e, phase)}
                  className="ui-btn-pill"
                  aria-label={`Mark phase ${phase}${
                    phases[phase] ? ` (currently at ${phases[phase]}s)` : ""
                  }`}
                  tabIndex={0}
                >
                  <span className="font-semibold text-xs leading-tight">
                    {phase}
                  </span>
                  <span className="text-[10px] text-[#E4572E] block">
                    {phases[phase] ? `${phases[phase]}s` : "—"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
