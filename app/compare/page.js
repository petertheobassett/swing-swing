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
  const [isPlaying, setIsPlaying] = useState(false); // default to false so video does not play on mount
  const [loopRange, setLoopRange] = useState(null);
  const [skeletonReady, setSkeletonReady] = useState(false); // new state
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

  // 🎯 Seek on drag (classic version: update video immediately on drag)
  const handleDrag = (e) => {
    if (duration === 0) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const seekTo = duration * percent;
    videoRef.current?.seekTo?.(seekTo); // Seek video immediately
    setCurrentTime(seekTo); // Update playhead immediately
  };

  // During drag, update UI playhead/progress bar
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
    if (isDragging) {
      bar.addEventListener('touchmove', handleTouchMove, { passive: false });
      return () => {
        bar.removeEventListener('touchmove', handleTouchMove);
      };
    }
    // If not dragging, do nothing (no event listener)
    return undefined;
  }, [isDragging, duration]);

  // Handler for when loader/instructions are hidden
  const handleLoaderHidden = () => {
    // Prevent infinite re-renders by checking current state
    setSkeletonReady((ready) => {
      if (!ready) return true;
      return ready;
    });
  };

  // Only show skeleton when loader/instructions are hidden
  const showSkeleton = skeletonReady;

  return (
    <main className="flex flex-col min-h-[100svh] w-full bg-white text-neutral-900 font-sans overflow-y-auto">
      {/* 🏷 App logo, always visible and centered at the very top with custom drop shadow */}
      <div className="fixed top-0 left-0 w-full flex justify-center items-center z-50 pointer-events-none select-none" style={{height: '3rem'}}>
        <img
          src="/swing-swing-logo.svg"
          alt="Swing Swing Logo"
          className="h-10 w-auto brightness-0"
          style={{
            background: 'white',
            borderRadius: '50%',
            padding: '15px',
            boxSizing: 'content-box',
            filter: 'none' // Remove all drop shadow and glow
          }}
          draggable="false"
        />
      </div>
      <div className="w-full max-w-[430px] mx-auto px-4 pt-4 flex flex-col items-center">
        {/* 🎥 Swing video player */}
        <div className="relative w-full aspect-[9/16] flex flex-col items-center mb-8">
          <SwingPlayer
            ref={videoRef}
            videoUrl={videoUrl}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            currentTime={currentTime}
            setCurrentTime={setCurrentTime}
            setDuration={setDuration}
            onLoaderHidden={handleLoaderHidden}
          />
          {/* 🧠 Skeleton overlay (if enabled) */}
          {showSkeleton && (
            <MotionTracker
              videoRef={videoRef}
              drawOnce={!isPlaying} // If paused, draw once at current frame; if playing, live
              timestamp={currentTime} // Always update on currentTime change
              onComplete={() => {}}
            />
          )}
        </div>
      </div>

      {/* Sticky controls area overlays video at bottom */}
      <div className="fixed bottom-0 left-0 w-full bg-white z-30 px-4 pt-2 pb-4 flex flex-col items-center pointer-events-auto select-none sm:static sm:bg-transparent sm:pt-0 sm:pb-0">
        {/* Controls + phase buttons in a flex column, with controls centered between video and phase buttons */}
        <div className="w-full max-w-[430px] flex flex-col items-center" style={{ minHeight: '110px' }}>
          {/* ▶️ Play / Pause Controls + 📊 Progress bar with golfball playhead */}
          <div className="flex flex-row items-center justify-center w-full gap-3 select-none mb-auto">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="group flex items-center justify-center w-10.5 h-10.5 rounded-full bg-white/90 hover:bg-blue-500 transition-colors shadow-lg border-2 border-white focus:outline-none focus:ring-2 focus:ring-blue-400 select-none"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="6" y="5" width="4" height="14" rx="1.5" fill="#222" />
                  <rect x="14" y="5" width="4" height="14" rx="1.5" fill="#222" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 5L19 12L6 19V5Z" fill="#222" />
                </svg>
              )}
            </button>
            <div
              ref={progressBarRef}
              className="h-4 bg-gray-300 rounded cursor-pointer relative overflow-visible flex-1 select-none"
              style={{ width: '90%', WebkitUserSelect: 'none', userSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
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
                className={`absolute left-0 top-1/2 w-[2.2rem] h-[2.2rem] bg-white border-1.5 border-blue-500 rounded-full shadow z-10 flex items-center justify-center ${
                  isDragging ? 'scale-125' : ''
                }`}
                style={{
                  left: `${(currentTime / duration) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  transition: isDragging ? 'none' : 'transform 0.15s ease',
                  pointerEvents: 'auto',
                }}
              >
                {/* Golfball dimples using SVG pattern */}
                <svg width="88%" height="88%" viewBox="0 0 40 40" className="rounded-full" style={{ display: 'block' }}>
                  <defs>
                    <pattern id="golf-dimples" patternUnits="userSpaceOnUse" width="8" height="8">
                      <circle cx="4" cy="4" r="1.0" fill="#d1d5db" />
                    </pattern>
                  </defs>
                  <circle cx="20" cy="20" r="18" fill="url(#golf-dimples)" />
                </svg>
              </div>
            </div>
          </div>
          {/* ⛳️ Phase marker buttons */}
          <div className="w-full grid grid-cols-5 gap-2 mt-auto mb-2">
            {swingPhases.map((phase) => {
              const isMarked = !!phases[phase];
              return (
                <button
                  key={phase}
                  onClick={() => handleMarkPhase(phase)}
                  className={`flex flex-col items-center justify-center rounded-full px-2 py-1 transition-all duration-200 shadow-sm border focus:outline-none focus:ring-2 focus:ring-blue-400 select-none
                    ${isMarked
                      ? 'border-blue-600 text-blue-700 scale-105 shadow-md bg-transparent'
                      : 'border-neutral-200 text-neutral-800 hover:bg-blue-50 hover:border-blue-400 hover:scale-105 bg-transparent'}
                  `}
                  style={{ minWidth: '0', minHeight: '0' }}
                >
                  <span className={`text-xs font-normal leading-tight ${isMarked ? 'text-blue-700' : 'text-blue-700'}`}>{phase}</span>
                  <span className={`text-[10px] font-normal ${isMarked ? 'text-blue-300' : 'text-neutral-400'}`}
                    style={{ letterSpacing: '0.01em' }}>
                    {phases[phase] ? `${phases[phase]}s` : '—'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {/* 🔁 Action buttons: replay and (eventually) compare */}
        {allPhasesMarked && (
          <div className="w-full max-w-[430px] flex gap-2 mt-2">
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
                  setSkeletonReady(false);
                  setTimeout(() => setSkeletonReady(true), 100); // forces remount
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
