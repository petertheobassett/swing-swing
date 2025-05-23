'use client';

import { useEffect, useRef } from 'react';
import * as posedetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs-core';

export default function MotionTracker({ videoRef, drawOnce = false, timestamp, onComplete }) {
  const canvasRef = useRef(null);
  const detectorRef = useRef(null);
  const rafIdRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const start = async () => {
      if (!videoRef.current?.video) return;
      const video = videoRef.current.video;

      await tf.ready();
      await tf.setBackend('webgl');

      // ✅ Load MoveNet
      detectorRef.current = await posedetection.createDetector(
        posedetection.SupportedModels.MoveNet,
        {
          modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        }
      );

      if (drawOnce && timestamp !== undefined) {
        // 🔹 Single-frame detection (e.g. Follow)
        video.currentTime = timestamp;

        await new Promise((resolve) =>
          video.addEventListener('seeked', () => {
            video.pause();
            resolve();
          }, { once: true })
        );

        const poses = await detectorRef.current.estimatePoses(video);
        if (poses.length && isMounted) {
          drawSkeleton(canvasRef.current, poses[0]);
          if (onComplete) onComplete();
        }
      } else {
        // 🔁 Live tracking mode (Setup → Follow)
        const update = async () => {
          if (!isMounted || video.paused || video.ended) return;

          const poses = await detectorRef.current.estimatePoses(video);
          if (poses.length && canvasRef.current) {
            drawSkeleton(canvasRef.current, poses[0]);
          }

          rafIdRef.current = video.requestVideoFrameCallback(update);
        };

        rafIdRef.current = video.requestVideoFrameCallback(update);
      }
    };

    start();

    return () => {
      isMounted = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [videoRef, drawOnce, timestamp]);

  return (
    <canvas
      ref={canvasRef}
        className="absolute inset-0 w-full h-full z-30 pointer-events-none"
    />
  );
}

// 🧠 Draw MoveNet skeleton on canvas
function drawSkeleton(canvas, pose) {
  if (!canvas || !pose) return;

  const ctx = canvas.getContext('2d');
  const keypoints = pose.keypoints;

  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  // 📐 Updated scaling with fallbacks
  const video = canvas._videoRef?.current?.video;
  const inputWidth = pose.inputWidth || video?.videoWidth || canvas.width;
  const inputHeight = pose.inputHeight || video?.videoHeight || canvas.height;

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
