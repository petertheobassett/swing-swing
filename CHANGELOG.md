# Changelog

## [0.0.5] - 2025-05-29

### Added
#### Complete Golf Swing Analysis Application
- **Professional Golfer Comparison**: Compare user swing with Ben Hogan's professional swing side-by-side
- **Motion Tracking & Skeleton Overlay**: Real-time pose detection with MoveNet AI model displaying skeleton overlay on both videos
- **Visual Differentiation**: User skeleton (cyan/orange) vs Professional skeleton (pink/magenta) for clear distinction
- **Smart Video Synchronization**: Duration-based playback rate matching - both videos start at "Back" phase with Hogan's video automatically sped up/slowed down to match user's swing duration
- **Advanced Playback Controls**: Speed adjustment buttons (0.25x, 0.5x, 1x, 2x) with synchronized playback between videos
- **Context-Aware UI**: Play button transforms to "Replay" when all swing phases are marked
- **Seamless Navigation**: Upload/capture video → mark swing phases → navigate to professional comparison
- **Transform-Aware Coordinate Mapping**: Fixed skeleton positioning for scaled/transformed video containers
- **Canvas Optimization**: Proper canvas sizing and device pixel ratio handling for crisp skeleton rendering
- **Memory Management**: Efficient TensorFlow.js loading, detector lifecycle management, and resource cleanup

#### Technical Improvements
- **Enhanced MotionTracker**: Transform-aware coordinate mapping for CSS-scaled containers
- **Fixed Canvas Positioning**: Resolved skeleton leg visibility issues through proper canvas sizing compensation
- **Coordinate System Fixes**: Accurate skeleton overlay positioning regardless of video transformations
- **UI Polish**: Removed debugging artifacts and synchronized status indicators for production-ready appearance
- **Performance Optimization**: Lazy loading of TensorFlow.js models and efficient pose detection
- **Cross-Platform Compatibility**: Device pixel ratio handling for crisp rendering on all displays

#### User Experience
- **Professional Analysis Workflow**: Complete end-to-end golf swing analysis with AI-powered insights
- **Visual Motion Tracking**: Real-time skeleton overlay with smooth keypoint interpolation
- **Synchronized Comparison**: Professional golfer reference with intelligent timing synchronization
- **Clean Modern UI**: Polished interface with consistent visual design and intuitive controls
- **Mobile-Optimized**: Responsive design supporting various screen sizes and orientations

## [0.0.4] - 2025-05-23

### Added
Changelog Summary (2025-05-23)
Loader & Progress Bar

Added a minimum loader duration (2 seconds) to SwingPlayer.js so the loader/progress bar is always visible for at least 2 seconds, even if the video loads instantly. This improves UX and makes the loading state more noticeable.
MotionTracker Memory Leak

Refactored MotionTracker.js to ensure the MoveNet detector is created and disposed only once per component lifecycle, and to properly clean up animation frames and detector resources. This helps reduce GPU memory usage and prevents memory leaks.
Touch Drag Progress Bar

Fixed a "Maximum update depth exceeded" error in page.js by only adding the touchmove event listener for the progress bar when dragging is active, and properly removing it when dragging ends.
Skeleton Overlay Logic

Made the skeleton overlay (MotionTracker) logic idempotent to prevent infinite re-renders when toggling its visibility after the loader/instructions are hidden.
UI/UX Polish

Explicitly removed all drop shadow and glow effects from the logo via inline CSS.
Ensured the loader progress bar and instructional text logic are robust and visually consistent.

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
