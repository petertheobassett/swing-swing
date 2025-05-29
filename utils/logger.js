/**
 * Enhanced logger utility that can be toggled with a DEBUG flag
 * for selective logging in development vs production.
 */

// Set this to false in production
const DEBUG = process.env.NODE_ENV !== 'production';

/**
 * Logger utility with filtering for production
 */
const logger = {
  log: (...args) => {
    if (DEBUG) console.log(...args);
  },
  
  warn: (...args) => {
    if (DEBUG) console.warn(...args);
    // In production, we might want to log warnings to an analytics service
  },
  
  error: (...args) => {
    // Always log errors, but in production we might want to send to an error tracking service
    console.error(...args);
  },
  
  debug: (...args) => {
    if (DEBUG) console.debug(...args);
  },
  
  info: (...args) => {
    if (DEBUG) console.info(...args);
  },
  
  // Group related logs together (useful for replay operations)
  group: (label) => {
    if (DEBUG) console.group(label);
  },
  
  groupEnd: () => {
    if (DEBUG) console.groupEnd();
  },
  
  // Use as a replacement for verbose logging of video states
  videoState: (video, label = "Video state") => {
    if (!DEBUG) return;
    
    if (!video) {
      console.log(`${label}: Video element not available`);
      return;
    }
    
    console.log(`${label}: {
      currentTime: ${video.currentTime?.toFixed(2)}s, 
      duration: ${video.duration?.toFixed(2)}s,
      paused: ${video.paused},
      ended: ${video.ended},
      readyState: ${video.readyState} (${getReadyStateText(video.readyState)}),
      networkState: ${video.networkState} (${getNetworkStateText(video.networkState)}),
      muted: ${video.muted},
      volume: ${video.volume},
      playbackRate: ${video.playbackRate},
      error: ${video.error ? video.error.message : 'none'}
    }`);
  },
  
  // Log autoplay capability detection
  autoplayCapability: async (video) => {
    if (!DEBUG || !video) return;
    
    try {
      const testPromise = video.play();
      if (testPromise instanceof Promise) {
        await testPromise;
        video.pause();
        console.log("Autoplay capability: ALLOWED");
      } else {
        video.pause();
        console.log("Autoplay capability: UNKNOWN (no promise returned)");
      }
    } catch (error) {
      console.log(`Autoplay capability: BLOCKED (${error.name}: ${error.message})`);
    }
  }
};

// Helper functions for video state descriptions
function getReadyStateText(state) {
  switch (state) {
    case 0: return 'HAVE_NOTHING';
    case 1: return 'HAVE_METADATA';
    case 2: return 'HAVE_CURRENT_DATA';
    case 3: return 'HAVE_FUTURE_DATA';
    case 4: return 'HAVE_ENOUGH_DATA';
    default: return 'UNKNOWN';
  }
}

function getNetworkStateText(state) {
  switch (state) {
    case 0: return 'NETWORK_EMPTY';
    case 1: return 'NETWORK_IDLE';
    case 2: return 'NETWORK_LOADING';
    case 3: return 'NETWORK_NO_SOURCE';
    default: return 'UNKNOWN';
  }
}

export default logger;
