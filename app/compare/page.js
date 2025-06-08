"use client";

        import React, { useRef, useState, useEffect, useCallback, memo } from "react";
        import SwingPlayer from "@/components/SwingPlayer";
        import MotionTracker from "@/components/MotionTracker";

        const FALLBACK_VIDEO_URL = "/videos/test-clip.mp4";
        const HOGAN_REFERENCE_VIDEO = "/videos/Ben-Hogan.mp4";
        const MIKELSON_REFERENCE_VIDEO = "/videos/Phil-Mikelson.mp4";
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

        // Mikelson swing phase timestamps (converted from frames at 24fps)
        const MIKELSON_PHASE_TIMESTAMPS = {
          Setup: 0.42,   // 10 frames ÷ 24fps
          Back: 0.54,    // 13 frames ÷ 24fps
          Apex: 1.21,    // 29 frames ÷ 24fps
          Impact: 1.50,  // 36 frames ÷ 24fps
          Follow: 2.04   // 49 frames ÷ 24fps
        };

        // Select reference video and phase data based on handedness
        function getHandedness() {
          if (typeof window !== 'undefined') {
            return localStorage.getItem('golferHandedness') || 'right';
          }
          return 'right';
        }

        // Memoize heavy components to avoid unnecessary re-renders
        const MemoizedMotionTracker = memo(MotionTracker);
        const MemoizedSwingPlayer = memo(SwingPlayer);

        const DEBUG = false; // Set to true for development, false for production

        export default function ComparePage() {
          const videoRef = useRef(null);
          const hoganVideoRef = useRef(null);
          const progressBarRef = useRef(null);
          const replayListenerRef = useRef(null);
          const overlayRef = useRef(null);
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
          const [showInstruction, setShowInstruction] = useState(true);
          const [showResetButton, setShowResetButton] = useState(false); // State to toggle between swing phase buttons and reset button

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
            const hoganBackTime = parseFloat(referencePhases.Back);
            const hoganFollowTime = parseFloat(referencePhases.Follow);
            
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
            
            if (DEBUG) console.log('Swing duration calculation:', {
              userSwingDuration: userSwingDuration.toFixed(3),
              hoganSwingDuration: hoganSwingDuration.toFixed(3),
              calculatedRate: rate.toFixed(3)
            });
            
            return rate;
          }, [allPhasesMarked, phases]);

          // Check for uploaded video from main page on component mount
          useEffect(() => {
            const uploadedVideo = localStorage.getItem('swingAnalysisVideo');
            if (uploadedVideo) {
              if (DEBUG) console.log('Found uploaded video from main page:', uploadedVideo);
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
                    if (DEBUG) console.log("setLoadingSkeleton(true) called");
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
              if (DEBUG) console.log("setLoadingSkeleton(true) called (first time)");
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
              if (DEBUG) console.log('Calculated scaling:', { userHeight, hoganHeight, scale });
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
              if (DEBUG) console.log('All phases marked, entering comparison mode');
              setComparisonMode(true);
            }
          }, [allPhasesMarked, comparisonMode]);

          // Removed calculateTimeMapping - now using duration-based playback rate synchronization

          // Ref for currentTime to avoid excessive re-renders
          const currentTimeRef = useRef(currentTime);
          useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

          // Simple sync function for scrubbing only - no sync during playback 
          const syncHoganVideo = useCallback((userCurrentTime) => {
            if (!comparisonMode || !hoganVideoRef.current?.video || !allPhasesMarked || isPlaying || isReplaying) return;
            const hoganVideo = hoganVideoRef.current.video;
            const userBackTime = parseFloat(phases.Back);
            const hoganBackTime = parseFloat(referencePhases.Back);
            if (isNaN(userBackTime) || isNaN(hoganBackTime)) return;
            const userRelativeTime = userCurrentTime - userBackTime;
            const hoganTargetTime = hoganBackTime + userRelativeTime;
            const timeDiff = Math.abs(hoganVideo.currentTime - hoganTargetTime);
            if (timeDiff > 0.1) {
              hoganVideo.currentTime = Math.max(0, hoganTargetTime);
              // console.log(`Scrubbing sync: User at ${userCurrentTime.toFixed(2)}s, Hogan seeked to ${hoganTargetTime.toFixed(2)}s`);
            }
          }, [comparisonMode, allPhasesMarked, phases, isPlaying, isReplaying]);

          // Handle scrubbing
          const handleDrag = (e) => {
            if (duration === 0) return;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const rect = progressBarRef.current.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const seekTo = duration * percent;
            videoRef.current?.seekTo?.(seekTo);
            // Sync Hogan video only when not playing
            if (comparisonMode && !isPlaying && !isReplaying) {
              syncHoganVideo(seekTo);
            }
          };

          // Removed throttled sync effect - now using duration-based playback rate synchronization

          // Handle replay functionality
          const handleReplay = async () => {
            if (DEBUG) console.log('handleReplay called:', { allPhasesMarked, videoRef: !!videoRef.current, phases });
            if (!allPhasesMarked || !videoRef.current) return;

            const backTime = parseFloat(phases.Back);
            const followTime = parseFloat(phases.Follow);

            // Recalculate Hogan playback rate for this replay
            const newHoganPlaybackRate = calculateHoganPlaybackRate();
            setHoganPlaybackRate(newHoganPlaybackRate);

            if (DEBUG) console.log('Phase times:', { backTime, followTime, backRaw: phases.Back, followRaw: phases.Follow });

            if (isNaN(backTime) || isNaN(followTime) || backTime >= followTime) {
              console.error('Invalid phase times:', { backTime, followTime, backRaw: phases.Back, followRaw: phases.Follow });
              return;
            }

            if (DEBUG) console.log(`Starting replay: ${backTime}s -> ${followTime}s`);
            setIsReplaying(true);
            setShowResetButton(true); // Show the reset button after replay is clicked

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
                const hoganBackTime = parseFloat(referencePhases.Back);
                hoganVideo.currentTime = hoganBackTime;
              }
              // Brief wait for seek operations to complete (increased to 300ms for better sync on slow devices)
              await new Promise(resolve => setTimeout(resolve, 300));

              // === Double-set currentTime for extra sync reliability ===
              video.currentTime = backTime;
              if (hoganVideo && comparisonMode) {
                const hoganBackTime = parseFloat(referencePhases.Back);
                hoganVideo.currentTime = hoganBackTime;
              }
              // Log actual currentTime values for debugging (keep this one for now)
              if (DEBUG) console.log('After double-set: user video at', video.currentTime, 'Hogan at', hoganVideo ? hoganVideo.currentTime : 'N/A');

              if (!video) {
                console.error('No video element available');
                setIsReplaying(false);
                return;
              }

              // Create and store the timeupdate listener  
              const handleTimeUpdate = () => {
                // console.log(`Replay timeupdate: currentTime=${video.currentTime}s, followTime=${followTime}s, paused=${video.paused}`); // Remove verbose log
                // Stop when user video reaches follow time
                if (video.currentTime >= followTime) {
                  // console.log(`Replay complete at ${video.currentTime}s`); // Remove verbose log
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
                  // Apply both the freshly calculated rate and the user's speed setting
                  hoganVideo.playbackRate = newHoganPlaybackRate * playbackSpeed;
                }
              
                // Start both videos simultaneously
                const playPromises = [video.play()];
                if (hoganVideo && comparisonMode) {
                  playPromises.push(hoganVideo.play());
                }
                // Wait for both videos to start playing
                await Promise.all(playPromises);
                // Now set isPlaying true (after both videos are playing)
                setIsPlaying(true);
                // console.log('Both videos started playing simultaneously from their respective back times'); // Remove verbose log
                // console.log(`User video: ${video.currentTime.toFixed(2)}s at ${video.playbackRate}x speed`); // Remove verbose log
                if (hoganVideo && comparisonMode) {
                  // console.log(`Hogan video: ${hoganVideo.currentTime.toFixed(2)}s at ${hoganVideo.playbackRate}x speed`); // Remove verbose log
                }
                // console.log('Replay started successfully, video.paused:', video.paused, 'video.currentTime:', video.currentTime, 'playbackRate:', video.playbackRate); // Remove verbose log
                // Add a periodic check to monitor playback progress
                const progressCheck = setInterval(() => {
                  // console.log(`Replay progress check: currentTime=${video.currentTime}s, paused=${video.paused}, playbackRate=${video.playbackRate}`); // Remove verbose log
                  if (video.paused || video.currentTime >= followTime || !replayListenerRef.current) {
                    clearInterval(progressCheck);
                    if (video.currentTime >= followTime) {
                      // console.log('Progress check detected completion, triggering cleanup'); // Remove verbose log
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
            setShowInstruction(false);
            if (DEBUG) console.log('Play/pause clicked:', { allPhasesMarked, isPlaying, isReplaying });
            
            if (allPhasesMarked && !isPlaying && !isReplaying) {
              if (DEBUG) console.log('Triggering replay');
              handleReplay();
            } else if (!isReplaying) {
              if (DEBUG) console.log('Toggling play/pause');
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
              if (DEBUG) console.log(`Speed changed - Hogan playback rate: ${hoganPlaybackRate * speed} (base rate: ${hoganPlaybackRate}, speed: ${speed})`);
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

          // Suppress browser pinch-to-zoom on mobile
          useEffect(() => {
            const preventPinchZoom = (e) => {
              if (e.touches && e.touches.length === 2) {
                e.preventDefault();
              }
            };
            const preventGesture = (e) => {
              e.preventDefault();
            };
            document.addEventListener('touchmove', preventPinchZoom, { passive: false });
            document.addEventListener('gesturestart', preventGesture);
            document.addEventListener('gesturechange', preventGesture);
            document.addEventListener('gestureend', preventGesture);
            return () => {
              document.removeEventListener('touchmove', preventPinchZoom);
              document.removeEventListener('gesturestart', preventGesture);
              document.removeEventListener('gesturechange', preventGesture);
              document.removeEventListener('gestureend', preventGesture);
            };
          }, []);

          const handleVideoError = useCallback(() => {
            setError("Failed to load video");
            setIsLoading(false);
          }, []);

          const handleVideoLoadStart = useCallback(() => {
            // Don't set loading state during replay operations
            if (isReplaying) {
              if (DEBUG) console.log('Video load start triggered during replay - ignoring');
              return;
            }
            if (DEBUG) console.log('Video load start triggered');
            setIsLoading(true);
            setError(null);
          }, [isReplaying]);

          const handleVideoLoaded = useCallback(() => {
            if (DEBUG) console.log('Video loaded triggered');
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

          // Hide instructional overlay on any user interaction
          useEffect(() => {
            if (!showInstruction) return;
            const hideInstruction = () => setShowInstruction(false);
            window.addEventListener('mousedown', hideInstruction);
            window.addEventListener('touchstart', hideInstruction);
            window.addEventListener('keydown', hideInstruction);
            return () => {
              window.removeEventListener('mousedown', hideInstruction);
              window.removeEventListener('touchstart', hideInstruction);
              window.removeEventListener('keydown', hideInstruction);
            };
          }, [showInstruction]);

          // Set reference video and phase data based on handedness
          const [referenceVideo, setReferenceVideo] = useState(HOGAN_REFERENCE_VIDEO);
          const [referencePhases, setReferencePhases] = useState(HOGAN_PHASE_TIMESTAMPS);
          const [referencePosition, setReferencePosition] = useState('right'); // 'right' or 'left'

          useEffect(() => {
            const handedness = getHandedness();
            if (handedness === 'left') {
              setReferenceVideo(MIKELSON_REFERENCE_VIDEO);
              setReferencePhases(MIKELSON_PHASE_TIMESTAMPS);
              setReferencePosition('left');
            } else {
              setReferenceVideo(HOGAN_REFERENCE_VIDEO);
              setReferencePhases(HOGAN_PHASE_TIMESTAMPS);
              setReferencePosition('right');
            }
          }, []);

          // User-controlled overlay scale and position
          const [overlayScale, setOverlayScale] = useState(0.475); // Default overlay scale
          const [overlayOffset, setOverlayOffset] = useState({ x: 0, y: 0 });
          const pinchState = useRef({ initialDistance: null, initialScale: null });

          // Pinch-to-zoom handlers for overlay
          const handleOverlayTouchStart = (e) => {
            if (e.touches.length === 2) {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              const distance = Math.sqrt(dx * dx + dy * dy);
              pinchState.current.initialDistance = distance;
              pinchState.current.initialScale = overlayScale;
              if (DEBUG) console.log('Pinch start detected:', { distance, scale: overlayScale });
            }
          };

          const handleOverlayTouchMove = (e) => {
            if (e.touches.length === 2 && pinchState.current.initialDistance) {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const scaleDelta = distance / pinchState.current.initialDistance;
              let newScale = pinchState.current.initialScale * scaleDelta;
              newScale = Math.max(0.2, Math.min(1.2, newScale)); // Clamp scale
              setOverlayScale(newScale);
              if (DEBUG) console.log('Pinch move detected:', { distance, newScale });
            }
          };

          const handleOverlayTouchEnd = (e) => {
            if (e.touches && e.touches.length < 2) {
              if (DEBUG) console.log('Pinch end detected');
              pinchState.current.initialDistance = null;
              pinchState.current.initialScale = null;
            }
          };

          // Reset overlay scale and offset
          const handleResetOverlay = () => {
            setOverlayScale(0.475);
            setOverlayOffset({ x: 0, y: 0 });
          };

          // Drag state for overlay repositioning
          const [isOverlayDragging, setIsOverlayDragging] = useState(false);
          const [dragStart, setDragStart] = useState(null); // {x, y}
          const [overlayStart, setOverlayStart] = useState(null); // {x, y}
          const [isOverlayResizing, setIsOverlayResizing] = useState(false);
          const [resizeStart, setResizeStart] = useState(null); // {x, y}
          const [scaleStart, setScaleStart] = useState(null); // number

          // Overlay drag handlers (desktop and mobile)
          // Only use handleOverlayPointerDown for mouse events
          const handleOverlayPointerDown = (e) => {
            // Only left mouse button
            if (e.type === 'mousedown' && e.button !== 0) return;
            e.stopPropagation();
            setIsOverlayDragging(true);
            setDragStart({
              x: e.clientX,
              y: e.clientY
            });
            setOverlayStart({ ...overlayOffset });
            if (DEBUG) console.log('Drag start detected:', { x: e.clientX, y: e.clientY });
          };
          const handleOverlayPointerMove = (e) => {
            if (!isOverlayDragging) return;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const dx = clientX - dragStart.x;
            const dy = clientY - dragStart.y;
            setOverlayOffset({
              x: overlayStart.x + dx,
              y: overlayStart.y + dy
            });
            if (e.touches) e.preventDefault();
            if (DEBUG) console.log('Drag move detected:', { dx, dy });
          };
          const handleOverlayPointerUp = () => {
            setIsOverlayDragging(false);
            if (DEBUG) console.log('Drag end detected');
          };
          useEffect(() => {
            if (!isOverlayDragging) return;
            window.addEventListener('mousemove', handleOverlayPointerMove);
            window.addEventListener('mouseup', handleOverlayPointerUp);
            window.addEventListener('touchmove', handleOverlayPointerMove, { passive: false });
            window.addEventListener('touchend', handleOverlayPointerUp);
            return () => {
              window.removeEventListener('mousemove', handleOverlayPointerMove);
              window.removeEventListener('mouseup', handleOverlayPointerUp);
              window.removeEventListener('touchmove', handleOverlayPointerMove);
              window.removeEventListener('touchend', handleOverlayPointerUp);
            };
          }, [isOverlayDragging, dragStart, overlayStart]);

          // Native touch event listeners for overlay drag (mobile)
          useEffect(() => {
            const overlay = overlayRef.current;
            if (!overlay) return;
            // Touch start
            const handleTouchStart = (e) => {
              if (e.touches.length > 1) return;
              setIsOverlayDragging(true);
              setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
              setOverlayStart({ ...overlayOffset });
              e.preventDefault();
            };
            // Touch move
            const handleTouchMove = (e) => {
              if (!isOverlayDragging) return;
              const clientX = e.touches[0].clientX;
              const clientY = e.touches[0].clientY;
              const dx = clientX - dragStart.x;
              const dy = clientY - dragStart.y;
              setOverlayOffset({ x: overlayStart.x + dx, y: overlayStart.y + dy });
              e.preventDefault();
            };
            // Touch end
            const handleTouchEnd = () => {
              setIsOverlayDragging(false);
            };
            overlay.addEventListener('touchstart', handleTouchStart, { passive: false });
            overlay.addEventListener('touchmove', handleTouchMove, { passive: false });
            overlay.addEventListener('touchend', handleTouchEnd);
            return () => {
              overlay.removeEventListener('touchstart', handleTouchStart);
              overlay.removeEventListener('touchmove', handleTouchMove);
              overlay.removeEventListener('touchend', handleTouchEnd);
            };
          }, [isOverlayDragging, dragStart, overlayStart, overlayOffset]);

          // Overlay resize handle (desktop only)
          const handleResizePointerDown = (e) => {
            e.stopPropagation();
            setIsOverlayResizing(true);
            setResizeStart({ x: e.clientX, y: e.clientY });
            setScaleStart(overlayScale);
          };
          const handleResizePointerMove = (e) => {
            if (!isOverlayResizing) return;
            const dy = e.clientY - resizeStart.y;
            let newScale = scaleStart + dy * 0.003; // Sensitivity
            newScale = Math.max(0.2, Math.min(1.2, newScale));
            setOverlayScale(newScale);
          };
          const handleResizePointerUp = () => {
            setIsOverlayResizing(false);
          };
          useEffect(() => {
            if (!isOverlayResizing) return;
            window.addEventListener('mousemove', handleResizePointerMove);
            window.addEventListener('mouseup', handleResizePointerUp);
            return () => {
              window.removeEventListener('mousemove', handleResizePointerMove);
              window.removeEventListener('mouseup', handleResizePointerUp);
            };
          }, [isOverlayResizing, resizeStart, scaleStart]);

          // Update overlay transform to use overlayOffset and overlayScale
          const getOverlayTransform = () => {
            // overlayOffset is in px, scale is unitless
            const baseTranslate = referencePosition === 'left' ? -15 : 15;
            return `translate(${baseTranslate}%, 0) translate(${overlayOffset.x}px, ${overlayOffset.y}px) scale(${overlayScale})`;
          };

          // Define handleResetSwingPhases to reset swing phases and toggle the reset button
          const handleResetSwingPhases = () => {
            setPhases({}); // Reset all phases
            setShowResetButton(false); // Hide the reset button
            if (DEBUG) console.log('Swing phases reset');
          };

          // Throttle currentTime updates to reduce re-renders
          const lastUpdateRef = useRef(0);
          const handleTimeUpdate = useCallback(() => {
            const now = Date.now();
            if (now - lastUpdateRef.current > 33) { // ~30fps
              setCurrentTime(videoRef.current?.video?.currentTime || 0);
              lastUpdateRef.current = now;
            }
          }, []);
          useEffect(() => {
            const video = videoRef.current?.video;
            if (!video) return;
            video.addEventListener('timeupdate', handleTimeUpdate);
            return () => {
              video.removeEventListener('timeupdate', handleTimeUpdate);
            };
          }, [handleTimeUpdate]);

          // Removed calculateTimeMapping - now using duration-based playback rate synchronization

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
                  {/* Instructional overlay: show until Setup is marked, but only after video loader is hidden and video is loaded */}
                  {(showInstruction && !phases.Setup && !isLoading && !isReplaying && !showSkeleton && duration > 0) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-30 rounded-xl">
                      <div className="ui-loading ui-absolute-center z-40 flex flex-col items-center gap-4">
                        <div>
                          Drag the golf ball along the timeline to find your <b>Setup</b> pose then click the <b>Setup</b> button to autodetect your swing
                        </div>
                        <button
                          className="ui-btn-pill px-5 py-2 text-base font-semibold bg-blue-600 text-white rounded-full shadow hover:bg-blue-700 transition-colors"
                          style={{ minWidth: 140 }}
                          onClick={() => {
                            setShowSkeleton(true);
                            setLoadingSkeleton(true);
                            // Optionally, you could also auto-mark Setup phase here if desired:
                            // setPhases(prev => ({ ...prev, Setup: currentTime.toFixed(2) }));
                          }}
                        >
                          Start
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Main video container */}
                  <div className="relative w-full h-full">
                    <MemoizedSwingPlayer
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
                        className="absolute top-0 left-0 w-full h-full overflow-hidden group"
                        style={{ 
                          zIndex: 20,
                          transform: getOverlayTransform(),
                          transformOrigin: 'center center',
                          opacity: 0.8,
                          cursor: isOverlayDragging ? 'grabbing' : 'grab',
                          touchAction: 'none'
                        }}
                        ref={overlayRef}
                        onMouseDown={handleOverlayPointerDown}
                      >
                        <div 
                          className="w-full h-full"
                          style={{
                            filter: 'contrast(1.3) saturate(0.7) brightness(1.1)',
                            borderRadius: '50px',
                            backgroundColor: 'rgba(240, 240, 240, 0.8)',
                            border: 'none',
                            overflow: 'hidden',
                            position: 'relative', // Needed for absolute skeleton overlay
                          }}
                        >
                          <MemoizedSwingPlayer
                            ref={hoganVideoRef}
                            videoUrl={referenceVideo}
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
                          {/* Hogan skeleton overlay, absolutely positioned over video */}
                          {showSkeleton && phases.Setup && (
                            <div
                              className="absolute top-0 left-0 w-full h-full pointer-events-none"
                              style={{
                                zIndex: 40,
                                // No transform here, already applied to parent
                              }}
                            >
                              <MemoizedMotionTracker
                                videoRef={hoganVideoRef}
                                timestamp={!isPlaying && !isReplaying ? currentTime : undefined}
                                drawOnce={!isPlaying && !isReplaying}
                                isTransformed={true}
                                transformScale={overlayScale}
                                transformTranslateX={referencePosition === 'left' ? -15 : 15}
                                transformOffset={overlayOffset}
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
                          {/* Desktop resize handle */}
                          <div
                            className="hidden md:block absolute bottom-2 right-2 w-6 h-6 bg-white bg-opacity-80 rounded-full border border-gray-300 cursor-nwse-resize z-50 flex items-center justify-center"
                            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
                            onMouseDown={handleResizePointerDown}
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 13l10-10M13 13H3V3" stroke="#888" strokeWidth="2" strokeLinecap="round"/></svg>
                          </div>
                        </div>
                        {/* Reset overlay button (mobile-friendly) */}
                        <button
                          className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white bg-opacity-80 text-xs px-3 py-1 rounded shadow z-50 border border-gray-300"
                          style={{ fontWeight: 600, paddingTop: '55px' }}
                          onClick={handleResetOverlay}
                          tabIndex={0}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-4 h-4"
                          >
                            <path d="M2 12a10 10 0 1 0 4-7.9" />
                            <polyline points="2 12 6 8 10 12" />
                          </svg>
                        </button>
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
                    <div className="flex flex-row items-center justify-center w-[87%] gap-1">
                      {/* Play/replay button: only show if all phases are marked */}
                      {allPhasesMarked && (
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
                      )}
                      {/* Progress bar and playhead: always visible */}
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
                    <MemoizedMotionTracker
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
                      onPhasesDetected={(detectedPhases) => {
                        // Only set phases that haven't been set by the user
                        setPhases((prev) => {
                          const updated = { ...prev };
                          for (const key in detectedPhases) {
                            if (!updated[key]) {
                              updated[key] = detectedPhases[key];
                            }
                          }
                          return updated;
                        });
                      }}
                    />
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
                      bottom: "15%", // Move the button up slightly by increasing the bottom value
                      zIndex: 45, // Higher than other UI elements
                      background: 'transparent', // transparent background
                      padding: '4px 4px',
                      borderRadius: '4px'
                    }}
                  >
                    <div className="ui-phase-grid transition-all duration-500 ease-in-out animate-fadein">
                      {showResetButton
                        ? [
                            <button
                              key="reset"
                              onClick={handleResetSwingPhases}
                              className="ui-btn-pill transition-transform duration-500 ease-in-out scale-100 animate-fadein"
                              aria-label="Reset Swing Phases"
                              tabIndex={0}
                              type="button"
                            >
                              <span className="flex flex-col items-center leading-tight font-semibold text-xs">
                                <span>Reset</span>
                                <span>Swing</span>
                              </span>
                            </button>,
                            ...swingPhases.slice(1).map((phase, idx) => (
                              <button
                                key={`placeholder-${phase}`}
                                className="ui-btn-pill invisible transition-transform duration-500 ease-in-out scale-90 animate-fadein"
                                tabIndex={-1}
                                aria-hidden="true"
                                disabled
                              >
                                <span className="font-semibold text-xs leading-tight">{phase}</span>
                                <span className="text-[10px] text-[#E4572E] block">—</span>
                              </button>
                            ))
                        ]
                        : swingPhases.map((phase, idx) => (
                            <button
                              key={phase}
                              onClick={() => handleMarkPhase(phase)}
                              onKeyDown={(e) => handlePhaseKey(e, phase)}
                              className="ui-btn-pill transition-transform duration-500 ease-in-out scale-100 animate-fadein"
                              aria-label={`Mark phase ${phase}${phases[phase] ? ` (currently at ${phases[phase]}s)` : ""}`}
                              tabIndex={0}
                              style={{ transitionDelay: `${idx * 60}ms` }}
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
