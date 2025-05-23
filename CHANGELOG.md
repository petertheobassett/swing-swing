# Changelog

## [0.0.3] - 2025-05-22

### Added
- Custom video player UI with draggable golfball playhead, custom progress bar, and play/pause controls.
- Marking of swing phases (Setup, Back, Apex, Impact, Follow) with accurate video timestamps, displayed on each button.
- Disabled text selection on phase marker buttons for better UX.
- "Replay Swing" button that plays the video from the Setup to Follow timestamps and auto-pauses at the end.
- Robust replay logic: video element is now exposed via ref from SwingPlayer, removing DOM query fallbacks.
- Prevented unwanted scrolling and context menus during playhead drag.
- Cleaned up and modernized state and event handling for reliability and maintainability.

## [0.0.1] - Initial Swing Setup and Custom Video Player

### Added
- Fallback video preload for dev/testing
- Custom video player with:
  - Play/pause toggle
  - Timeline scrubber
  - Overlayed controls at bottom of video
- Phase buttons: Setup, Back, Apex, Impact, Follow
- Timestamps recorded on tap
- Continue button activates when all phases are marked
- Mobile-first responsive layout for 430px width
- Clean Tailwind 3 styles with compact layout
- Context menu disabled on timeline to support drag-scrubbing
