'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// Move this outside of the component to avoid recreating on every render
const getVideoDisplayInfo = (video) => {
  if (!video) return null;
  const rect = video.getBoundingClientRect();
  const { videoWidth, videoHeight } = video;
  const aspectVideo = videoWidth / videoHeight;
  const aspectDisplay = rect.width / rect.height;
  let drawWidth, drawHeight, offsetX, offsetY;
  if (aspectVideo > aspectDisplay) {
    // Pillarbox
    drawWidth = rect.width;
    drawHeight = rect.width / aspectVideo;
    offsetX = 0;
    offsetY = (rect.height - drawHeight) / 2;
  } else {
    // Letterbox
    drawHeight = rect.height;
    drawWidth = rect.height * aspectVideo;
    offsetX = (rect.width - drawWidth) / 2;
    offsetY = 0;
  }
  return {
    width: drawWidth,
    height: drawHeight,
    offsetX,
    offsetY,
    rectWidth: rect.width,
    rectHeight: rect.height,
    videoWidth,
    videoHeight,
  };
};

export default function MotionTracker({ 
  videoRef, 
  drawOnce = false, 
  timestamp, 
  onComplete,
  isTransformed = false,
  transformScale = 1,
  transformTranslateX = 0
}) {
  const canvasRef = useRef(null);
  const detectorRef = useRef(null);
  const rafIdRef = useRef(null);
  const prevKeypointsRef = useRef(null);
  const [tfLoaded, setTfLoaded] = useState(false);
  const SMOOTHING = 0.5;

  // ✅ Step 1: Create and dispose detector ONCE - lazy loaded
  useEffect(() => {
    let isMounted = true;

    const loadDetector = async () => {
      try {
        // Dynamically import TensorFlow.js only when needed
        const tf = await import('@tensorflow/tfjs-core');
        await import('@tensorflow/tfjs-backend-webgl');
        const posedetection = await import('@tensorflow-models/pose-detection');
        
        if (!isMounted) return;

        await tf.ready();
        await tf.setBackend('webgl');

        if (!isMounted) return;

        detectorRef.current = await posedetection.createDetector(
          posedetection.SupportedModels.MoveNet,
          {
            modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
            modelUrl: '/movenet/model.json',
          }
        );

        if (isMounted) {
          setTfLoaded(true);
        }
      } catch (error) {
        console.error('Error loading TensorFlow model:', error);
      }
    };

    loadDetector();

    return () => {
      isMounted = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (detectorRef.current) {
        detectorRef.current.dispose();
      }
    };
  }, []);

  // ✅ Step 2: Separate effect to run detection logic - only runs when TF is loaded
  useEffect(() => {
    if (!tfLoaded || !detectorRef.current) return; // Don't run until TensorFlow is loaded and detector is ready
    
    let isMounted = true;

    const startTracking = async () => {
      const detector = detectorRef.current;
      const video = videoRef.current?.video;

      if (!detector || !video) return;

      if (drawOnce && timestamp !== undefined) {
        video.currentTime = timestamp;

        await new Promise((resolve) =>
          video.addEventListener('seeked', () => {
            video.pause();
            resolve();
          }, { once: true })
        );

        const poses = await detector.estimatePoses(video);
        if (poses.length && isMounted) {
          drawSkeleton(canvasRef.current, poses[0], video, isTransformed, transformScale, transformTranslateX);
          if (onComplete) onComplete(poses[0].keypoints);
        }
      } else {
        const update = async () => {
          if (!isMounted || video.paused || video.ended) return;

          const poses = await detector.estimatePoses(video);
          if (poses.length && canvasRef.current) {
            const prev = prevKeypointsRef.current;
            const curr = poses[0].keypoints;
            let smoothed = curr;

            if (prev && prev.length === curr.length) {
              smoothed = curr.map((kp, i) => {
                if (!prev[i]) return kp;
                if (kp.score > 0.3 && prev[i].score > 0.3) {
                  return {
                    ...kp,
                    x: prev[i].x * SMOOTHING + kp.x * (1 - SMOOTHING),
                    y: prev[i].y * SMOOTHING + kp.y * (1 - SMOOTHING),
                    score: Math.max(kp.score, prev[i].score),
                  };
                } else {
                  return kp;
                }
              });
            }

            prevKeypointsRef.current = smoothed;
            drawSkeleton(canvasRef.current, { ...poses[0], keypoints: smoothed }, video, isTransformed, transformScale, transformTranslateX);
            
            // Call onComplete with landmarks for scaling calculation
            if (onComplete) onComplete(smoothed);
          }

          rafIdRef.current = video.requestVideoFrameCallback(update);
        };

        rafIdRef.current = video.requestVideoFrameCallback(update);
      }
    };

    startTracking();

    return () => {
      isMounted = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [videoRef, drawOnce, timestamp, onComplete, tfLoaded]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full z-30 pointer-events-none"
      style={{ 
        filter: 'none',
        // Ensure the canvas is always visible
        opacity: 1,
        display: 'block'
      }}
    />
  );
}

// 🧠 Draw MoveNet skeleton on canvas (updated for display mapping with left/right color differentiation)
function drawSkeleton(canvas, pose, video, isTransformed = false, transformScale = 1, transformTranslateX = 0) {
  if (!canvas || !pose || !video) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const keypoints = pose.keypoints;
  const info = getVideoDisplayInfo(video);
  if (!info) return;
  
  // Debug logging for transformed skeletons
  if (isTransformed) {
    console.log('Hogan skeleton debug:', {
      transformScale,
      transformTranslateX,
      canvasSize: { width: canvas.width, height: canvas.height },
      videoInfo: info,
      keypointsCount: keypoints.length
    });
  }
  
  // Set canvas to match displayed video size and account for device pixel ratio
  const dpr = window.devicePixelRatio || 1;
  
  // For transformed videos, canvas should match the FULL size before CSS transform
  // This ensures the skeleton doesn't get clipped when the container is scaled down
  let canvasWidth, canvasHeight;
  if (isTransformed) {
    // Use full video display dimensions (before CSS scaling)
    canvasWidth = info.rectWidth / transformScale;
    canvasHeight = info.rectHeight / transformScale;
  } else {
    // Normal videos use container size
    canvasWidth = info.rectWidth;
    canvasHeight = info.rectHeight;
  }
  
  // Only resize canvas if dimensions changed (expensive operation)
  if (canvas.width !== canvasWidth * dpr || canvas.height !== canvasHeight * dpr) {
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
  }
  
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // For transformed videos, we need to compensate for the container scale
  // The skeleton container is scaled down, so we need to draw bigger to appear normal size
  // NOTE: Actually, since the container itself is transformed via CSS, we don't need compensation
  const compensationScale = 1; // isTransformed ? (1 / transformScale) : 1;
  
  // Use consistent base line width for all skeletons
  const baseLineWidth = 1.25;
  ctx.lineWidth = baseLineWidth;
  
  // Map keypoints from video to display coordinates
  const scaleX = info.width / info.videoWidth;
  const scaleY = info.height / info.videoHeight;
  
  const map = (kp) => {
    // Start with basic video-to-display mapping
    let x = kp.x * scaleX + info.offsetX;
    let y = kp.y * scaleY + info.offsetY;
    
    // For transformed videos, we need to account for the larger canvas size
    // The canvas is now sized for the full video before CSS transform
    if (isTransformed) {
      // Scale coordinates up to match the larger canvas
      x = x / transformScale;
      y = y / transformScale;
    }
    
    // Debug log coordinates for ankle keypoints (leg visibility issue)
    if (isTransformed && (kp === keypoints[15] || kp === keypoints[16])) {
      const inBounds = x >= 0 && x <= canvasWidth && y >= 0 && y <= canvasHeight;
      console.log(`Hogan ankle coordinate (${kp === keypoints[15] ? 'left' : 'right'}):`, {
        original: { x: kp.x, y: kp.y },
        mapped: { x, y },
        score: kp.score,
        canvasBounds: { width: canvasWidth, height: canvasHeight },
        containerBounds: { width: info.rectWidth, height: info.rectHeight },
        transformScale,
        inBounds,
        note: 'Canvas sized for full video, CSS transform will scale down',
        videoDisplayInfo: video ? {
          naturalWidth: video.videoWidth,
          naturalHeight: video.videoHeight,
          displayWidth: video.clientWidth,
          displayHeight: video.clientHeight
        } : null
      });
    }
    
    return {
      x,
      y,
      score: kp.score,
    };
  };

  // Debug: Log overall skeleton bounds for transformed skeleton
  if (isTransformed && keypoints?.length > 0) {
    const visibleKeypoints = keypoints.filter(kp => kp?.score > 0.3);
    if (visibleKeypoints.length > 0) {
      const mappedPoints = visibleKeypoints.map(kp => map(kp));
      const bounds = {
        minX: Math.min(...mappedPoints.map(p => p.x)),
        maxX: Math.max(...mappedPoints.map(p => p.x)),
        minY: Math.min(...mappedPoints.map(p => p.y)),
        maxY: Math.max(...mappedPoints.map(p => p.y))
      };
      
      // Log every 10 frames to avoid spam
      if (Math.random() < 0.1) {
        console.log('Hogan skeleton bounds (full-size canvas):', {
          bounds,
          canvasSize: { width: canvasWidth, height: canvasHeight },
          containerSize: { width: info.rectWidth, height: info.rectHeight },
          transformScale,
          visibleKeypointCount: visibleKeypoints.length,
          ankleKeypoints: {
            left: keypoints[15]?.score > 0.3 ? map(keypoints[15]) : 'not visible',
            right: keypoints[16]?.score > 0.3 ? map(keypoints[16]) : 'not visible'
          },
          note: 'Canvas is full-size, CSS transform scales down entire container'
        });
      }
    }
  }

  // Color configuration for left/right differentiation
  // Use different colors for transformed (Hogan) vs normal (user) skeletons
  const rightColor = isTransformed ? '#ff4081' : '#00ffff';  // Pink for Hogan, cyan for user
  const leftColor = isTransformed ? '#e91e63' : '#ff6600';   // Deep pink for Hogan, orange for user
  const centerColor = isTransformed ? '#ff4081' : '#00ffff'; // Pink for Hogan, cyan for user
  
  // MoveNet keypoint indices:
  // 0: nose, 1: left_eye, 2: right_eye, 3: left_ear, 4: right_ear
  // 5: left_shoulder, 6: right_shoulder, 7: left_elbow, 8: right_elbow
  // 9: left_wrist, 10: right_wrist, 11: left_hip, 12: right_hip
  // 13: left_knee, 14: right_knee, 15: left_ankle, 16: right_ankle
  
  // Define connection pairs with their colors (left limbs use darker color)
  const connectionConfig = [
    // Head connections (center)
    { pair: [0, 1], color: centerColor }, // nose to left eye
    { pair: [1, 3], color: leftColor },   // left eye to left ear
    { pair: [0, 2], color: centerColor }, // nose to right eye  
    { pair: [2, 4], color: rightColor },  // right eye to right ear
    
    // Arms
    { pair: [5, 7], color: leftColor },   // left shoulder to left elbow
    { pair: [7, 9], color: leftColor },   // left elbow to left wrist
    { pair: [6, 8], color: rightColor },  // right shoulder to right elbow
    { pair: [8, 10], color: rightColor }, // right elbow to right wrist
    
    // Torso connections
    { pair: [5, 6], color: centerColor }, // left shoulder to right shoulder
    { pair: [5, 11], color: leftColor },  // left shoulder to left hip
    { pair: [6, 12], color: rightColor }, // right shoulder to right hip
    { pair: [11, 12], color: centerColor }, // left hip to right hip
    
    // Legs  
    { pair: [11, 13], color: leftColor },  // left hip to left knee
    { pair: [13, 15], color: leftColor },  // left knee to left ankle
    { pair: [12, 14], color: rightColor }, // right hip to right knee
    { pair: [14, 16], color: rightColor }, // right knee to right ankle
  ];

  // Draw connections with appropriate colors
  connectionConfig.forEach(({ pair: [i, j], color }) => {
    const kp1 = keypoints[i];
    const kp2 = keypoints[j];
    if (kp1?.score > 0.3 && kp2?.score > 0.3) {
      const p1 = map(kp1);
      const p2 = map(kp2);
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  });

  // Draw keypoints with appropriate colors
  keypoints.forEach((kp, index) => {
    if (kp?.score > 0.3) {
      const p = map(kp);
      
      // Determine color based on keypoint index
      let pointColor;
      if ([1, 3, 5, 7, 9, 11, 13, 15].includes(index)) {
        // Left side keypoints (darker)
        pointColor = leftColor;
      } else if ([2, 4, 6, 8, 10, 12, 14, 16].includes(index)) {
        // Right side keypoints (brighter)  
        pointColor = rightColor;
      } else {
        // Center keypoints (nose)
        pointColor = centerColor;
      }
      
      // Use consistent base radius for all skeletons
      const baseRadius = 2.75;
      const radius = baseRadius; // No compensation needed since CSS transform handles scaling
      
      ctx.fillStyle = pointColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
}

// Moved getVideoDisplayInfo outside the component - see top of file
