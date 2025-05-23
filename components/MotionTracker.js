'use client';

import { useEffect, useRef } from 'react';
import * as posedetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs-core';

export default function MotionTracker({ videoRef, drawOnce = false, timestamp, onComplete }) {
  const canvasRef = useRef(null);
  const detectorRef = useRef(null);
  const rafIdRef = useRef(null);
  const prevKeypointsRef = useRef(null);
  const SMOOTHING = 0.5;

  // ✅ Step 1: Create and dispose detector ONCE
  useEffect(() => {
    let isMounted = true;

    const loadDetector = async () => {
      await tf.ready();
      await tf.setBackend('webgl');

      detectorRef.current = await posedetection.createDetector(
        posedetection.SupportedModels.MoveNet,
        {
          modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          modelUrl: '/movenet/model.json',
        }
      );

      console.log('✅ Detector loaded');
    };

    loadDetector();

    return () => {
      isMounted = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (detectorRef.current) {
        detectorRef.current.dispose();
        console.log('♻️ Detector disposed');
      }
    };
  }, []);

  // ✅ Step 2: Separate effect to run detection logic
  useEffect(() => {
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
          drawSkeleton(canvasRef.current, poses[0], video);
          if (onComplete) onComplete();
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
            drawSkeleton(canvasRef.current, { ...poses[0], keypoints: smoothed }, video);
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
  }, [videoRef, drawOnce, timestamp, onComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full z-30 pointer-events-none"
      style={{ filter: 'none' }}
    />
  );
}

// 🧠 Draw MoveNet skeleton on canvas
function drawSkeleton(canvas, pose, video) {
  if (!canvas || !pose) return;

  const ctx = canvas.getContext('2d');
  const keypoints = pose.keypoints;

  if (video && video.videoWidth && video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  } else {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  const inputWidth = video?.videoWidth || canvas.width;
  const inputHeight = video?.videoHeight || canvas.height;

  const scaleX = canvas.width / inputWidth;
  const scaleY = canvas.height / inputHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#00ffff';
  ctx.fillStyle = '#00ffff';

  const connectedPairs = [
    [0, 1], [1, 3], [0, 2], [2, 4],
    [5, 7], [7, 9], [6, 8], [8, 10],
    [5, 6], [5, 11], [6, 12],
    [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 12]
  ];

  connectedPairs.forEach(([i, j]) => {
    const kp1 = keypoints[i];
    const kp2 = keypoints[j];
    if (kp1?.score > 0.3 && kp2?.score > 0.3) {
      ctx.beginPath();
      ctx.moveTo(kp1.x * scaleX, kp1.y * scaleY);
      ctx.lineTo(kp2.x * scaleX, kp2.y * scaleY);
      ctx.stroke();
    }
  });

  keypoints.forEach((kp) => {
    if (kp?.score > 0.3) {
      ctx.beginPath();
      ctx.arc(kp.x * scaleX, kp.y * scaleY, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
}
