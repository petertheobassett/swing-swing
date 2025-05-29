"use client";
import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [videoURL, setVideoURL] = useState(null);
  const [recording, setRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const fileInputRef = useRef(null);

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith("video/")) {
      const videoUrl = URL.createObjectURL(file);
      setVideoURL(videoUrl);
    } else {
      alert("Please select a valid video file.");
    }
  }

  function navigateToAnalysis() {
    if (videoURL) {
      // Store video URL in localStorage for the compare page
      localStorage.setItem('swingAnalysisVideo', videoURL);
      router.push('/compare');
    }
  }

  function handleUploadClick() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Camera access is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setMediaStream(stream);
      recordedChunksRef.current = [];
      const mediaRecorder = new window.MediaRecorder(stream, { mimeType: "video/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const videoUrl = URL.createObjectURL(blob);
        setVideoURL(videoUrl);
        setMediaStream(null);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      alert("Could not access camera: " + err.message);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }
    setRecording(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f9f9f9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div className="w-full max-w-[430px] mx-auto px-4 flex flex-col items-center">
        <div className="flex flex-col gap-4 items-center w-full">
          <button
            className="ui-btn-pill"
            onClick={handleUploadClick}
            type="button"
          >
            Upload Video
          </button>
          <input
            type="file"
            accept="video/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <button
            className="ui-btn-pill-filled"
            onClick={recording ? stopRecording : startRecording}
            type="button"
          >
            {recording ? "Stop Recording" : "Capture Video"}
          </button>
        </div>
        {/* Live camera preview */}
        {mediaStream && (
          <video
            autoPlay
            playsInline
            muted
            ref={video => {
              if (video) video.srcObject = mediaStream;
            }}
            style={{ width: "100%", borderRadius: 16, marginTop: 16, marginBottom: 8 }}
          />
        )}
        {/* Preview uploaded or recorded video */}
        {videoURL && (
          <div style={{ width: "100%", marginTop: 16 }}>
            <video
              src={videoURL}
              controls
              style={{ width: "100%", borderRadius: 16, background: "#000" }}
            />
            <button
              className="ui-btn-pill-filled"
              onClick={navigateToAnalysis}
              style={{ 
                marginTop: 16, 
                width: "100%",
                background: "#10b981",
                borderColor: "#10b981"
              }}
              type="button"
            >
              Analyze My Swing →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}