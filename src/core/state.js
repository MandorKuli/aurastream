// --- Global Player State ---
export const state = {
  audio: null,
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  isShuffle: false,
  repeatMode: 'none', // 'none' | 'one' | 'all'
  volume: 0.7,
  isMuted: false,
  lastVolume: 0.7,
  activeView: 'home',
  activePlaylistId: null,
  searchSourceFilter: 'all', // 'all' | 'local' | 'audius' | 'itunes' | 'youtube'
  
  // Multi-Player Engines
  activePlayerEngine: 'html5', // 'html5' | 'youtube' | 'soundcloud'
  ytPlayer: null,
  ytPlayerReady: false,
  scWidget: null,
  scWidgetReady: false,

  // Web Audio Visualizer & EQ variables
  audioContext: null,
  analyser: null,
  sourceNode: null,
  eqBassNode: null,
  eqTrebleNode: null,
  reverbNode: null,
  pannerNode: null,
  spatialEnabled: false,
  forceFullSongs: true, // Default to finding full songs on YouTube
  spatialAngle: 0,
  visualizerActive: false,
  visualizerStyle: 0, // Palettes: 0: Purple/Indigo, 1: Cyan/Emerald, 2: Magenta/Pink
  animationFrameId: null,
  
  // Remix Mode
  remixMode: 'normal', // 'normal' | 'nightcore' | 'slowed'
  
  // Karaoke Mode
  currentLyrics: [], // Array of { time, text }
  
  // Transitions
  fadeInterval: null
};
