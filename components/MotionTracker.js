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

// --- Enhanced auto phase detection utility ---
function detectSwingPhasesFromPoses({poses, setupTime = 0}) {
  if (!poses || poses.length < 5) {
    // Not enough data, fallback to demo
    return {
      Setup: setupTime.toFixed(2),
      Back: (setupTime + 0.5).toFixed(2),
      Apex: (setupTime + 1.0).toFixed(2),
      Impact: (setupTime + 1.2).toFixed(2),
      Follow: (setupTime + 1.7).toFixed(2)
    };
  }

  // Helper: get average y of valid keypoints
  function getAvgY(pose, indices) {
    const vals = indices.map(i => pose.keypoints[i]).filter(kp => kp && kp.score > 0.3);
    if (!vals.length) return null;
    return vals.reduce((sum, kp) => sum + kp.y, 0) / vals.length;
  }

  // Helper: get lead arm angle (shoulder-elbow-wrist)
  function getLeadArmAngle(pose) {
    // Assume right-handed (lead arm = left), fallback to right if left not visible
    const lShoulder = pose.keypoints[5], lElbow = pose.keypoints[7], lWrist = pose.keypoints[9];
    const rShoulder = pose.keypoints[6], rElbow = pose.keypoints[8], rWrist = pose.keypoints[10];
    let a, b, c;
    if (lShoulder?.score > 0.3 && lElbow?.score > 0.3 && lWrist?.score > 0.3) {
      a = lShoulder; b = lElbow; c = lWrist;
    } else if (rShoulder?.score > 0.3 && rElbow?.score > 0.3 && rWrist?.score > 0.3) {
      a = rShoulder; b = rElbow; c = rWrist;
    } else {
      return null;
    }
    // Angle at elbow (in degrees)
    const ab = {x: a.x - b.x, y: a.y - b.y};
    const cb = {x: c.x - b.x, y: c.y - b.y};
    const dot = ab.x * cb.x + ab.y * cb.y;
    const magAB = Math.sqrt(ab.x * ab.x + ab.y * ab.y);
    const magCB = Math.sqrt(cb.x * cb.x + cb.y * cb.y);
    if (magAB === 0 || magCB === 0) return null;
    let angle = Math.acos(dot / (magAB * magCB));
    return angle * 180 / Math.PI;
  }

  // Build filtered/smoothed y and t arrays using weighted average of wrists, elbows, shoulders, and arm angle
  const rawYs = poses.map(pose => {
    const wristY = getAvgY(pose, [9, 10]);
    const elbowY = getAvgY(pose, [7, 8]);
    const shoulderY = getAvgY(pose, [5, 6]);
    const armAngle = getLeadArmAngle(pose);
    // Weighted sum: wrists (0.4), elbows (0.3), shoulders (0.2), arm angle (0.1, normalized)
    let ySum = 0, wSum = 0;
    if (wristY !== null) { ySum += wristY * 0.4; wSum += 0.4; }
    if (elbowY !== null) { ySum += elbowY * 0.3; wSum += 0.3; }
    if (shoulderY !== null) { ySum += shoulderY * 0.2; wSum += 0.2; }
    // For arm angle, normalize to y-range (map 60-180 deg to 0-100 px, clamp)
    if (armAngle !== null) {
      const normAngle = Math.max(60, Math.min(180, armAngle));
      ySum += ((180 - normAngle) / 120) * 100 * 0.1; // Higher angle (straighter arm) = lower y
      wSum += 0.1;
    }
    return wSum > 0 ? ySum / wSum : null;
  });
  const times = poses.map((p, i) => p.timestamp !== undefined ? p.timestamp : (setupTime + i * 1/30));

  // Simple moving average smoothing (window=3)
  const smoothYs = rawYs.map((y, i, arr) => {
    if (y === null) return null;
    let sum = 0, count = 0;
    for (let j = -1; j <= 1; ++j) {
      if (arr[i + j] !== undefined && arr[i + j] !== null) {
        sum += arr[i + j];
        count++;
      }
    }
    return count > 0 ? sum / count : y;
  });

  // 1. Detect Back: first significant move from setup
  const setupY = smoothYs[0];
  let backIdx = 1;
  for (; backIdx < smoothYs.length; ++backIdx) {
    if (setupY !== null && smoothYs[backIdx] !== null && Math.abs(smoothYs[backIdx] - setupY) > 10) break;
  }

  // 2. Detect Apex: local minimum in y after Back (velocity crosses 0)
  let apexIdx = backIdx;
  for (let i = backIdx + 1; i < smoothYs.length - 1; ++i) {
    if (smoothYs[i-1] !== null && smoothYs[i] !== null && smoothYs[i+1] !== null) {
      if (smoothYs[i] < smoothYs[i-1] && smoothYs[i] < smoothYs[i+1]) {
        apexIdx = i;
        break;
      }
    }
  }

  // 3. Detect Impact: local maximum in y after Apex (velocity crosses 0)
  let impactIdx = apexIdx;
  for (let i = apexIdx + 1; i < smoothYs.length - 1; ++i) {
    if (smoothYs[i-1] !== null && smoothYs[i] !== null && smoothYs[i+1] !== null) {
      if (smoothYs[i] > smoothYs[i-1] && smoothYs[i] > smoothYs[i+1]) {
        impactIdx = i;
        break;
      }
    }
  }

  // 4. Detect Follow: either wrist above head (y < head y) OR y stabilization, whichever comes first
  let followIdx = impactIdx;
  let foundFollow = false;
  for (let i = impactIdx + 1; i < poses.length; ++i) {
    const pose = poses[i];
    const head = pose.keypoints[0]; // nose as head reference
    const lw = pose.keypoints[9], rw = pose.keypoints[10];
    // Check for either wrist above head
    if (head?.score > 0.3 && ((lw?.score > 0.3 && lw.y < head.y) || (rw?.score > 0.3 && rw.y < head.y))) {
      followIdx = i;
      foundFollow = true;
      break;
    }
    // Check for y stabilization (little change for 5+ frames)
    if (i < smoothYs.length - 5 && smoothYs[i] !== null) {
      let stable = true;
      for (let j = 1; j <= 5; ++j) {
        if (smoothYs[i + j] === null || Math.abs(smoothYs[i + j] - smoothYs[i]) > 5) {
          stable = false;
          break;
        }
      }
      if (stable) {
        followIdx = i;
        foundFollow = true;
        break;
      }
    }
  }
  // If not found, fallback to last frame
  if (!foundFollow) {
    followIdx = Math.max(impactIdx, Math.min(poses.length - 1, smoothYs.length - 1));
  }

  // Clamp indices
  backIdx = Math.max(1, Math.min(backIdx, poses.length - 1));
  apexIdx = Math.max(backIdx, Math.min(apexIdx, poses.length - 1));
  impactIdx = Math.max(apexIdx, Math.min(impactIdx, poses.length - 1));
  followIdx = Math.max(impactIdx, Math.min(followIdx, poses.length - 1));

  return {
    Setup: setupTime.toFixed(2),
    Back: times[backIdx].toFixed(2),
    Apex: times[apexIdx].toFixed(2),
    Impact: times[impactIdx].toFixed(2),
    Follow: times[followIdx].toFixed(2)
  };
}

export default function MotionTracker({ 
  videoRef, 
  drawOnce = false, 
  timestamp, 
  onComplete,
  isTransformed = false,
  transformScale = 1,
  transformTranslateX = 0,
  onPhasesDetected // NEW: callback for auto phase detection
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
    let isActive = true;
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
        let poses = [];
        try {
          if (!isActive) return;
          poses = await detector.estimatePoses(video);
        } finally {
          if (window.tf && window.tf.engine) {
            window.tf.engine().disposeVariables();
            window.tf.engine().startScope && window.tf.engine().endScope && window.tf.engine().endScope();
          }
        }
        if (poses.length && isActive) {
          drawSkeleton(canvasRef.current, poses[0], video, isTransformed, transformScale, transformTranslateX);
          if (onComplete) onComplete(poses[0].keypoints);
          // --- Auto phase detection ---
          if (onPhasesDetected) {
            try {
              const detectedPhases = detectSwingPhasesFromPoses({ poses, setupTime: timestamp || 0 });
              onPhasesDetected(detectedPhases);
            } catch (error) {
              console.error('Error detecting swing phases:', error);
            }
          }
        }
      } else {
        const update = async () => {
          if (!isActive || video.paused || video.ended) return;
          let poses = [];
          try {
            poses = await detector.estimatePoses(video);
          } finally {
            if (window.tf && window.tf.engine) {
              window.tf.engine().disposeVariables();
              window.tf.engine().startScope && window.tf.engine().endScope && window.tf.engine().endScope();
            }
          }
          if (poses.length && canvasRef.current && isActive) {
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
            if (onComplete) onComplete(smoothed);
          }
          if (isActive) rafIdRef.current = video.requestVideoFrameCallback(update);
        };
        if (isActive) rafIdRef.current = video.requestVideoFrameCallback(update);
      }
    };
    startTracking();
    return () => {
      isActive = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [videoRef, drawOnce, timestamp, onComplete, tfLoaded, onPhasesDetected]);

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
    
    return {
      x,
      y,
      score: kp.score,
    };
  };

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
