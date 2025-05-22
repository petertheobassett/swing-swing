'use client';

import { useEffect, useRef, useState } from 'react';

const FALLBACK_VIDEO_URL =
  'https://firebasestorage.googleapis.com/v0/b/swing-swing-e1982.firebasestorage.app/o/swing-uploads%2F1747711434555_test-clip.mp4?alt=media&token=58e3b123-157a-4e4c-9a77-0c166d7d220a';

const swingPhases = ['Setup', 'Back', 'Apex', 'Impact', 'Follow'];

export default function ComparePage() {
  const [videoUrl, setVideoUrl] = useState(FALLBACK_VIDEO_URL);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [phases, setPhases] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleMarkPhase = (phase) => {
    setPhases((prev) => ({
      ...prev,
      [phase]: currentTime.toFixed(2),
    }));
  };

  const allPhasesMarked = swingPhases.every((phase) => phases[phase]);

  return (
    <main className="flex flex-col min-h-screen w-full bg-white text-neutral-900 font-sans">
      <div className="w-full max-w-[430px] mx-auto px-4 py-6 flex flex-col items-center">
        <h1 className="text-2xl font-semibold text-center mb-6 tracking-tight">Swing-Swing</h1>

        {/* ✅ Custom video player with overlay controls */}
        <div className="relative w-full aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-md mb-6">
          <video
            ref={videoRef}
            src={videoUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            playsInline
            className="w-full h-full object-contain"
          />
          <div className="absolute bottom-0 left-0 w-full px-4 py-3 bg-black/60 backdrop-blur-md flex items-center gap-3 z-10">
            <button
              onClick={togglePlay}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black text-sm font-bold"
            >
              {isPlaying ? '❚❚' : '▶️'}
            </button>
            <input
              type="range"
              min="0"
              max={duration}
              step="0.01"
              value={currentTime}
              onChange={handleSeek}
              onContextMenu={(e) => e.preventDefault()} // ✅ prevent right-click menu on timeline
              className="w-full accent-white"
            />
          </div>
        </div>

        {/* ✅ Phase buttons */}
        <div className="w-full grid grid-cols-5 gap-1 mb-4">
          {swingPhases.map((phase) => (
            <button
              key={phase}
              onClick={() => handleMarkPhase(phase)}
              className="flex flex-col items-center justify-center rounded-md border border-neutral-300 bg-white hover:bg-neutral-100 text-[10px] font-medium text-neutral-700 text-center leading-tight transition p-1"
            >
              <span className="font-semibold text-xs leading-tight">{phase}</span>
              <span className="text-[10px] text-neutral-500">
                {phases[phase] ? `${phases[phase]}s` : '—'}
              </span>
            </button>
          ))}
        </div>

        {/* ✅ Continue button */}
        {allPhasesMarked && (
          <button className="w-full px-4 py-3 bg-black text-white rounded-lg font-medium text-sm tracking-tight hover:bg-neutral-800 transition">
            Continue to Overlay →
          </button>
        )}
      </div>
    </main>
  );
}
