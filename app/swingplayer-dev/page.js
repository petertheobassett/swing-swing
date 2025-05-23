'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import SwingPlayer from '@/components/SwingPlayer';

export default function SwingTestPage() {
  // 🎛 State management
  const playerRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // 🧼 Clean up drag state
  useEffect(() => {
    const stopDrag = () => setIsDragging(false);
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('touchend', stopDrag);
    return () => {
      window.removeEventListener('mouseup', stopDrag);
      window.removeEventListener('touchend', stopDrag);
    };
  }, []);

  // 🎯 Seek on drag
  const handleDrag = (e) => {
    if (duration === 0) return; // avoid NaN when video hasn't loaded

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const seekTo = duration * percent;

    playerRef.current?.seekTo?.(seekTo);
  };

  return (
    <div className="p-4 bg-neutral-950 min-h-screen text-white">
      <h1 className="text-xl font-bold mb-4">🎥 SwingPlayer Dev</h1>

      {/* 🖥 Video Component + Progress Bar in same container */}
      <div className="w-full max-w-md mx-auto">
        <SwingPlayer
          ref={playerRef}
          videoUrl="https://firebasestorage.googleapis.com/v0/b/swing-swing-e1982.firebasestorage.app/o/swing-uploads%2F1747711434555_test-clip.mp4?alt=media&token=58e3b123-157a-4e4c-9a77-0c166d7d220a"
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          currentTime={currentTime}
          setCurrentTime={setCurrentTime}
          setDuration={setDuration}
        />
        {/* 📊 Progress bar with playhead, matches video width */}
        <div className="relative mt-4 touch-none flex justify-center" style={{ width: '100%' }}>
          <div
            className="h-4 bg-gray-300 rounded cursor-pointer relative overflow-visible" // allow dot to overflow
            style={{ width: '90%' }} // Centered bar, 90% width of container
            onMouseDown={(e) => {
              setIsDragging(true);
              handleDrag(e);
            }}
            onTouchStart={(e) => {
              setIsDragging(true);
              handleDrag(e);
            }}
            onMouseMove={(e) => {
              if (isDragging) handleDrag(e);
            }}
            onTouchMove={(e) => {
              if (isDragging) handleDrag(e);
            }}
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
      </div>

      {/* 🎛 Controls */}
      <div className="mt-6 space-y-4">
        {/* ▶️ Play / Pause */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-all backdrop-blur-md shadow-sm"
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          {/* Removed time readout */}
        </div>
      </div>
    </div>
  );
}
