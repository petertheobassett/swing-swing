'use client';

import { useRef, useState, useEffect } from 'react';
import SwingPlayer from '@/components/SwingPlayer';
import MotionTracker from '@/components/MotionTracker'; // ✅ Ensure this is imported

// 🎥 Default fallback video used before uploads are implemented
const FALLBACK_VIDEO_URL = '/videos/test-clip.mp4';

// 🏌️ List of swing phases to be marked by the user
const swingPhases = ['Setup', 'Back', 'Apex', 'Impact', 'Follow'];

export default function ComparePage() {
  // 🔗 Core player + app state
  const videoRef = useRef(null);
  const progressBarRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState(FALLBACK_VIDEO_URL);
  const [duration, setDuration] = useState(0);
  const [phases, setPhases] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopRange, setLoopRange] = useState(null);
  const [showSkeleton, setShowSkeleton] = useState(false); // ✅ Trigger skeleton render
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // 🧠 Store current timestamp for a given swing phase
  const handleMarkPhase = (phase) => {
    setPhases((prev) => ({
      ...prev,
      [phase]: currentTime.toFixed(2),
    }));
  };

  // ✅ Only show action buttons when all phases are marked
  const allPhasesMarked = swingPhases.every((phase) => phases[phase]);

  // 🎯 Seek on drag (copied from swingplayer-dev)
  const handleDrag = (e) => {
    if (duration === 0) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const seekTo = duration * percent;
    videoRef.current?.seekTo?.(seekTo);
  };

  // Imperatively handle touchmove with passive: false
  useEffect(() => {
    const bar = progressBarRef.current;
    if (!bar) return;
    const handleTouchMove = (e) => {
      if (isDragging) {
        e.preventDefault();
        handleDrag(e);
      }
    };
    bar.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      bar.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isDragging, duration]);

  return (
    <main className="flex flex-col min-h-screen w-full bg-white text-neutral-900 font-sans">
      <div className="w-full max-w-[430px] mx-auto px-4 pt-4 flex flex-col items-center">

        {/* 🏷 App title */}
        <h1 className="absolute top-4 left-1/2 -translate-x-1/2 z-20 text-base font-semibold bg-black/60 text-white px-3 py-1 rounded-md">
          Swing-Swing
        </h1>

        {/* 🎥 Swing video player */}
        <div className="relative w-full aspect-[9/16] max-h-[78vh] mb-4 flex flex-col items-center">
          <SwingPlayer
            ref={videoRef}
            videoUrl={videoUrl}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            currentTime={currentTime}
            setCurrentTime={setCurrentTime}
            setDuration={setDuration}
          />
          {/* ▶️ Play / Pause Controls + 📊 Progress bar with golfball playhead */}
          <div className="relative mt-4 flex flex-row items-center justify-center w-full gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-all backdrop-blur-md shadow-sm"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <span>⏸️</span> : <span>▶️</span>}
            </button>
            <div
              ref={progressBarRef}
              className="h-4 bg-gray-300 rounded cursor-pointer relative overflow-visible flex-1"
              style={{ width: '90%' }}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsDragging(true);
                handleDrag(e);
              }}
              onTouchStart={(e) => {
                setIsDragging(true);
                handleDrag(e);
              }}
              onMouseMove={(e) => {
                if (isDragging) {
                  e.preventDefault();
                  handleDrag(e);
                }
              }}
              onContextMenu={e => e.preventDefault()}
            >
              {/* ⬛ Progress fill */}
              <div
                className="h-full bg-blue-500 rounded transition-all duration-75"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              {/* 🔘 Draggable dot on top of bar */}
              <div
                className={`absolute left-0 top-1/2 w-6 h-6 bg-white border-2 border-blue-500 rounded-full shadow z-10 flex items-center justify-center ${
                  isDragging ? 'scale-125' : ''
                }`}
                style={{
                  left: `${(currentTime / duration) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  transition: 'transform 0.15s ease',
                  pointerEvents: 'auto',
                }}
              >
                {/* Golfball dimples using SVG pattern */}
                <svg width="80%" height="80%" viewBox="0 0 40 40" className="rounded-full" style={{ display: 'block' }}>
                  <defs>
                    <pattern id="golf-dimples" patternUnits="userSpaceOnUse" width="8" height="8">
                      <circle cx="4" cy="4" r="1.2" fill="#d1d5db" />
                    </pattern>
                  </defs>
                  <circle cx="20" cy="20" r="18" fill="url(#golf-dimples)" />
                </svg>
              </div>
            </div>
          </div>
          {/* 
            🧠 When triggered, run pose detection at the 'Follow' phase and 
            render a one-time skeleton overlay using MoveNet.
          */}
          {showSkeleton && (
            <MotionTracker
              videoRef={videoRef}
              timestamp={parseFloat(phases.Follow)}
              drawOnce={false} // ✅ Live mode
              onComplete={() => console.log('✅ Skeleton rendered')}
            />
          )}
        </div>
        {/* ⛳️ Phase marker buttons */}
        <div className="w-full grid grid-cols-5 gap-1 mb-2">
          {swingPhases.map((phase) => (
            <button
              key={phase}
              onClick={() => handleMarkPhase(phase)}
              className="flex flex-col items-center justify-center rounded-md border border-neutral-300 bg-white hover:bg-neutral-100 text-[10px] font-medium text-neutral-700 text-center leading-tight transition p-1 select-none"
            >
              <span className="font-semibold text-xs leading-tight">{phase}</span>
              <span className="text-[10px] text-neutral-500">
                {phases[phase] ? `${phases[phase]}s` : '—'}
              </span>
            </button>
          ))}
        </div>

        {/* 🔁 Action buttons: replay and (eventually) compare */}
        {allPhasesMarked && (
          <div className="w-full flex gap-2 mt-2">
            {/* 🔁 Replay swing segment from Setup to Follow */}
            <button
              onClick={() => {
                const setupTime = parseFloat(phases.Setup);
                const followTime = parseFloat(phases.Follow);

                if (!isNaN(setupTime) && !isNaN(followTime)) {
                  setLoopRange([setupTime, followTime]);

                  const videoEl = videoRef.current?.video;
                  if (videoEl) {
                    videoEl.pause();
                    videoEl.currentTime = setupTime;
                    videoEl.play();
                    setIsPlaying(true);

                    // Remove any previous listener
                    videoEl.onended = null;
                    videoEl.ontimeupdate = null;
                    videoEl.ontimeupdate = () => {
                      if (videoEl.currentTime >= followTime) {
                        videoEl.pause();
                        setIsPlaying(false);
                        videoEl.ontimeupdate = null;
                      }
                    };
                  }

                  // ✅ Trigger skeleton after phases are confirmed
                  setShowSkeleton(false);
                  setTimeout(() => setShowSkeleton(true), 100); // forces remount
                }
              }}
              className="w-1/2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-sm text-neutral-800 font-medium rounded-lg transition"
            >
              Replay Swing
            </button>

            {/* 🧪 Placeholder for future Hogan overlay or comparison view */}
            <button
              onClick={() => {
                alert('Comparison view coming soon!');
              }}
              className="w-1/2 px-4 py-2 bg-black text-white hover:bg-neutral-800 text-sm font-medium rounded-lg transition"
            >
              Load Comparison
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
