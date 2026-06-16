/**
 * AuraStream Main Application Controller
 * Handles HTML5 audio playback, YouTube API player, SoundCloud widget API,
 * IndexedDB local databasing, dynamic visualizer loops, and view switches.
 */

import { db } from './db.js';
import { api } from './api.js';

// --- Global Player State ---
const state = {
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

// --- DOM Cache ---
const DOM = {
  // Navigation
  menuItems: document.querySelectorAll('.menu-item'),
  views: document.querySelectorAll('.content-view'),
  sidebarPlaylists: document.getElementById('sidebar-playlists-list'),
  
  // Search
  globalSearch: document.getElementById('global-search-input'),
  voiceSearchBtn: document.getElementById('voice-search-btn'),
  searchTitleText: document.getElementById('search-title-text'),
  searchResultsList: document.getElementById('search-results-list'),
  filterAll: document.getElementById('filter-search-all'),
  filterLocal: document.getElementById('filter-search-local'),
  filterAudius: document.getElementById('filter-search-audius'),
  filterItunes: document.getElementById('filter-search-itunes'),
  filterYoutube: document.getElementById('filter-search-youtube'),
  
  // Discover View
  trendingGrid: document.getElementById('trending-grid'),
  homeLocalGrid: document.getElementById('home-local-grid'),
  trendingRefreshBtn: document.getElementById('trending-refresh-btn'),
  heroPlayBtn: document.getElementById('hero-play-trending-btn'),
  homeGotoUploadBtn: document.getElementById('home-goto-upload-btn'),
  
  // Favorites View
  favoritesList: document.getElementById('favorites-list'),
  playAllFavsBtn: document.getElementById('play-all-favorites-btn'),
  
  // Playlists View
  playlistsGrid: document.getElementById('playlists-grid'),
  createPlaylistBtn: document.getElementById('create-playlist-btn'),
  playlistDetailContent: document.getElementById('playlist-detail-content'),
  
  // Upload View
  dropzone: document.getElementById('file-dropzone'),
  audioFileInput: document.getElementById('audio-file-input'),
  browseFilesBtn: document.getElementById('browse-files-btn'),
  uploadForm: document.getElementById('upload-form'),
  uploadTitle: document.getElementById('upload-title'),
  uploadArtist: document.getElementById('upload-artist'),
  uploadAlbum: document.getElementById('upload-album'),
  uploadGenre: document.getElementById('upload-genre'),
  uploadCoverInput: document.getElementById('upload-cover'),
  browseCoverBtn: document.getElementById('browse-cover-btn'),
  coverPreviewFilename: document.getElementById('cover-preview-filename'),
  uploadFeedback: document.getElementById('upload-file-feedback'),
  uploadSubmitBtn: document.getElementById('upload-submit-btn'),
  uploadedTracksList: document.getElementById('uploaded-tracks-list'),
  deleteAllLocalBtn: document.getElementById('delete-all-local-btn'),
  
  // Player Bar
  playerCover: document.getElementById('player-track-cover'),
  playerTitle: document.getElementById('player-track-title'),
  playerArtist: document.getElementById('player-track-artist'),
  playerFavBtn: document.getElementById('player-track-fav-btn'),
  playerPlayBtn: document.getElementById('player-play-btn'),
  playerPrevBtn: document.getElementById('player-prev-btn'),
  playerNextBtn: document.getElementById('player-next-btn'),
  playerShuffleBtn: document.getElementById('player-shuffle-btn'),
  playerRepeatBtn: document.getElementById('player-repeat-btn'),
  playerTimeCurrent: document.getElementById('player-time-current'),
  playerTimeDuration: document.getElementById('player-time-duration'),
  playerTimelineContainer: document.getElementById('player-timeline-container'),
  playerTimelineBar: document.getElementById('player-timeline-bar'),
  playerVolumeBtn: document.getElementById('player-volume-btn'),
  playerVolumeSlider: document.getElementById('player-volume-slider'),
  playerVolumeBar: document.getElementById('player-volume-bar'),
  playerToggleVisBtn: document.getElementById('player-toggle-vis-btn'),
  headerVisualizerBtn: document.getElementById('header-visualizer-btn'),
  playerQueueBtn: document.getElementById('player-queue-btn'),
  
  // Floating Video Card (YouTube)
  floatingVideoPlayer: document.getElementById('floating-video-player'),
  videoDragHandle: document.getElementById('video-player-drag-handle'),
  videoMinimizeBtn: document.getElementById('video-minimize-btn'),
  videoCloseBtn: document.getElementById('video-close-btn'),
  
  // Visualizer View
  visCover: document.getElementById('vis-cover'),
  visDiscOuter: document.getElementById('vis-disc-outer'),
  visTitle: document.getElementById('vis-title'),
  visArtist: document.getElementById('vis-artist'),
  visSourceTag: document.getElementById('vis-source-tag'),
  visDurationTag: document.getElementById('vis-duration-tag'),
  visCanvas: document.getElementById('visualizer-canvas'),
  toggleVisStyleBtn: document.getElementById('toggle-vis-style'),
  
  // Modals
  modalCreatePlaylist: document.getElementById('modal-create-playlist'),
  modalCreatePlaylistClose: document.getElementById('modal-create-playlist-close'),
  modalCreatePlaylistCancel: document.getElementById('modal-create-playlist-cancel'),
  createPlaylistFormSubmit: document.getElementById('create-playlist-form'),
  
  modalAddToPlaylist: document.getElementById('modal-add-to-playlist'),
  modalAddToPlaylistClose: document.getElementById('modal-add-playlist-close'),
  modalAddToPlaylistCancel: document.getElementById('modal-add-playlist-cancel'),
  addPlaylistOptionsContainer: document.getElementById('add-playlist-options-container'),
  
  // New Modals (Lyrics, EQ, Settings)
  playerLyricsBtn: document.getElementById('player-lyrics-btn'),
  modalLyrics: document.getElementById('modal-lyrics'),
  modalLyricsClose: document.getElementById('modal-lyrics-close'),
  lyricsContent: document.getElementById('lyrics-content'),
  
  playerEqBtn: document.getElementById('player-eq-btn'),
  modalEq: document.getElementById('modal-eq'),
  modalEqClose: document.getElementById('modal-eq-close'),
  eqBass: document.getElementById('eq-bass'),
  eqTreble: document.getElementById('eq-treble'),
  eqBassVal: document.getElementById('eq-bass-val'),
  eqTrebleVal: document.getElementById('eq-treble-val'),
  eqSpatialToggle: document.getElementById('eq-spatial-toggle'),
  eqResetBtn: document.getElementById('eq-reset-btn'),
  remixRadios: document.getElementsByName('remix_mode'),

  sidebarSettingsBtn: document.getElementById('sidebar-settings-btn'),
  sidebarLoginBtn: document.getElementById('sidebar-login-btn'),
  modalSettings: document.getElementById('modal-settings'),
  modalSettingsClose: document.getElementById('modal-settings-close'),
  modalLogin: document.getElementById('modal-login'),
  modalLoginClose: document.getElementById('modal-login-close'),
  loginEmailInput: document.getElementById('login-email'),
  loginPasswordInput: document.getElementById('login-password'),
  loginSubmitBtn: document.getElementById('login-submit-btn'),
  registerSubmitBtn: document.getElementById('register-submit-btn'),
  modalProfile: document.getElementById('modal-profile'),
  modalProfileClose: document.getElementById('modal-profile-close'),
  profileNameText: document.getElementById('profile-name-text'),
  profileEmailText: document.getElementById('profile-email-text'),
  profileSyncBtn: document.getElementById('profile-sync-btn'),
  profileEditBtn: document.getElementById('profile-edit-btn'),
  profileLogoutBtn: document.getElementById('profile-logout-btn'),
  settingsExportBtn: document.getElementById('settings-export-btn'),
  settingsImportBtn: document.getElementById('settings-import-btn'),
  settingsImportFile: document.getElementById('settings-import-file'),
  settingsFullsongToggle: document.getElementById('settings-fullsong-toggle'),

  partyRoomBtn: document.getElementById('party-room-btn'),

  // Stats View
  statsContainer: document.getElementById('stats-content-container'),

  // Toast
  toastContainer: document.getElementById('toast-container')
};

// Store current audio blob URLs to release memory leaks later
const activeBlobUrls = new Map();

// Track temporarily selected for playlist operation
let playlistTargetTrack = null;
// Track temporarily uploaded data
let uploadedFileData = {
  audioBlob: null,
  duration: 0,
  coverDataUrl: ''
};

// --- Toast System ---
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i>
    <span>${message}</span>
  `;
  DOM.toastContainer.appendChild(toast);
  
  setTimeout(() => toast.classList.add('active'), 50);
  
  setTimeout(() => {
    toast.classList.remove('active');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// --- Helper Functions ---
function formatTime(seconds) {
  if (isNaN(seconds) || seconds === null) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// --- LRC Parser ---
function parseLRC(lrcText) {
  const lines = lrcText.split('\n');
  const parsed = [];
  const timeRegex = /\[(\d{2}):(\d{2}\.\d{2,3})\]/;
  lines.forEach(line => {
    const match = timeRegex.exec(line);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseFloat(match[2]);
      const text = line.replace(timeRegex, '').trim();
      parsed.push({
        time: (minutes * 60) + seconds,
        text: text || '♪'
      });
    }
  });
  return parsed;
}

// --- Smooth DJ Transition Helper ---
function fadeAudioVolume(targetVolume, durationMs = 1000) {
  return new Promise(resolve => {
    if (state.activePlayerEngine !== 'html5' || !state.audio) return resolve();
    
    // Clear any existing fade intervals
    if (state.fadeInterval) {
      clearInterval(state.fadeInterval);
      state.fadeInterval = null;
    }

    const steps = 20;
    const stepTime = durationMs / steps;
    const currentVol = state.audio.volume;
    const diff = targetVolume - currentVol;
    const stepVol = diff / steps;
    
    if (diff === 0) return resolve();

    let currentStep = 0;
    state.fadeInterval = setInterval(() => {
      currentStep++;
      let newVol = currentVol + (stepVol * currentStep);
      newVol = Math.max(0, Math.min(1, newVol));
      state.audio.volume = newVol;
      
      if (currentStep >= steps) {
        clearInterval(state.fadeInterval);
        state.fadeInterval = null;
        resolve();
      }
    }, stepTime);
  });
}

// --- View Router ---
function navigateToView(viewId, params = {}) {
  state.activeView = viewId;
  
  DOM.menuItems.forEach(item => {
    if (item.getAttribute('data-view') === viewId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  DOM.views.forEach(view => {
    if (view.id === `view-${viewId}`) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });

  if (viewId === 'home') {
    loadLocalTracksHome();
  } else if (viewId === 'favorites') {
    loadFavoritesList();
  } else if (viewId === 'playlists') {
    loadPlaylistsGrid();
  } else if (viewId === 'upload') {
    loadUploadedTracksList();
  } else if (viewId === 'playlist-detail' && params.playlistId) {
    state.activePlaylistId = params.playlistId;
    loadPlaylistDetail(params.playlistId);
  } else if (viewId === 'visualizer') {
    initVisualizerCanvas();
    if (state.currentTrack) {
      DOM.visTitle.textContent = state.currentTrack.title || 'Unknown Title';
      DOM.visArtist.textContent = state.currentTrack.artist || 'Unknown Artist';
      DOM.visCover.src = state.currentTrack.coverUrl || '';
      DOM.visCover.alt = state.currentTrack.title || 'Cover';
      DOM.visSourceTag.textContent = `SOURCE: ${(state.currentTrack.source || 'NONE').toUpperCase()}`;
      DOM.visDurationTag.textContent = formatTime(state.currentTrack.duration || 0);
    }
  } else if (viewId === 'stats') {
    renderStatsView();
  }
}

// --- Playback Engine Core ---
function initAudioEngine() {
  state.audio = new Audio();
  state.audio.crossOrigin = 'anonymous'; // Enable CORS for remote analysis
  
  DOM.playerVolumeBar.style.width = `${state.volume * 100}%`;
  state.audio.volume = state.volume;

  // HTML5 audio engine event listeners
  state.audio.addEventListener('play', () => {
    if (state.activePlayerEngine === 'html5') {
      state.isPlaying = true;
      updatePlaybackControlsUI();
    }
  });

  state.audio.addEventListener('pause', () => {
    if (state.activePlayerEngine === 'html5') {
      state.isPlaying = false;
      updatePlaybackControlsUI();
    }
  });

  state.audio.addEventListener('ended', () => {
    if (state.activePlayerEngine === 'html5') {
      handleTrackEnded();
    }
  });

  state.audio.addEventListener('error', async (e) => {
    if (state.activePlayerEngine === 'html5') {
      console.warn('Audio playback error on HTML5:', e);
      
      // Fallback to YouTube Iframe Player if the stream fails
      if (state.currentTrack && (state.currentTrack.source === 'youtube' || state.currentTrack.source === 'itunes')) {
        showToast('Local stream unreachable. Falling back to YouTube Player...', 'warning');
        
        try {
          let videoId;
          if (state.currentTrack.source === 'youtube') {
            videoId = state.currentTrack.streamUrl;
          } else {
            // For iTunes, get video ID
            videoId = await resolveYouTubeVideoId(state.currentTrack.artist, state.currentTrack.title);
          }
            
          if (videoId) {
            state.audio.src = ''; // Clear broken source
            state.activePlayerEngine = 'youtube';
            DOM.floatingVideoPlayer.classList.add('active');
            playYouTubeVideo(videoId);
            return; // Successfully diverted to youtube player
          }
        } catch (err) {
          console.error('Fallback resolution failed:', err);
        }
        
        // If everything fails and it's iTunes, play 30s preview
        if (state.currentTrack.source === 'itunes' && state.currentTrack.streamUrl && state.currentTrack.streamUrl.includes('apple.com')) {
          showToast('Playing 30-sec preview instead.', 'warning');
          state.audio.src = state.currentTrack.streamUrl;
          state.audio.load();
          state.audio.play().catch(err => console.error(err));
          return;
        }
      }
      
      showToast('Failed to stream audio file.', 'error');
      state.isPlaying = false;
      updatePlaybackControlsUI();
    }
  });

  // Bootstrap SoundCloud SDK Widget
  const scIframe = document.getElementById('soundcloud-widget-iframe');
  try {
    state.scWidget = SC.Widget(scIframe);
    state.scWidget.bind(SC.Widget.Events.READY, () => {
      state.scWidgetReady = true;
      state.scWidget.setVolume(state.volume * 100);
      console.log('SoundCloud Widget connected successfully');
    });

    state.scWidget.bind(SC.Widget.Events.PLAY, () => {
      if (state.activePlayerEngine === 'soundcloud') {
        state.isPlaying = true;
        updatePlaybackControlsUI();
      }
    });

    state.scWidget.bind(SC.Widget.Events.PAUSE, () => {
      if (state.activePlayerEngine === 'soundcloud') {
        state.isPlaying = false;
        updatePlaybackControlsUI();
      }
    });

    state.scWidget.bind(SC.Widget.Events.FINISH, () => {
      if (state.activePlayerEngine === 'soundcloud') {
        handleTrackEnded();
      }
    });
  } catch (err) {
    console.warn('SoundCloud widget API not available:', err);
  }

  // Bootstrap YouTube IFrame (simple direct src approach - no JS API needed)
  loadYouTubeIframe();
  
  // Start general polling loop for timeline tracking (unifies YT, SoundCloud & HTML5 progress)
  startTimelineTrackerLoop();
}

/**
 * Loads a YouTube video using direct iframe src (no JS API needed).
 * This is more reliable than the YT.Player JS API.
 */
function loadYouTubeIframe() {
  // Create the iframe element inside the container
  const container = document.getElementById('youtube-player-container');
  if (!container) return;

  const iframe = document.createElement('iframe');
  iframe.id = 'yt-iframe';
  iframe.style.cssText = 'width:100%;height:100%;border:none;';
  iframe.allow = 'autoplay; encrypted-media';
  iframe.allowFullscreen = true;
  iframe.src = 'about:blank';
  container.appendChild(iframe);
  
  state.ytPlayer = iframe; // Store reference to iframe element
  state.ytPlayerReady = true; // Always ready since it's just an iframe
  console.log('YouTube iframe player ready');
}

/**
 * Plays a YouTube video by updating the iframe src directly.
 * @param {string} videoId - YouTube video ID
 */
function playYouTubeVideo(videoId) {
  const iframe = document.getElementById('yt-iframe');
  if (!iframe) return;
  // Use embed URL with autoplay and no related videos
  iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3`;
  state.ytPlayerReady = true;
}

/**
 * Stops YouTube iframe playback by clearing its src.
 */
function stopYouTubeVideo() {
  const iframe = document.getElementById('yt-iframe');
  if (iframe) {
    iframe.src = 'about:blank';
  }
}


function startTimelineTrackerLoop() {
  setInterval(() => {
    if (!state.isPlaying || !state.currentTrack) return;

    let currentPlayTime = 0;

    if (state.activePlayerEngine === 'html5') {
      if (state.audio && !isNaN(state.audio.duration)) {
        currentPlayTime = state.audio.currentTime;
        const duration = state.audio.duration;
        const percent = (currentPlayTime / duration) * 100;
        DOM.playerTimelineBar.style.width = `${percent}%`;
        DOM.playerTimeCurrent.textContent = formatTime(currentPlayTime);
        DOM.playerTimeDuration.textContent = formatTime(duration);
      }
    } else if (state.activePlayerEngine === 'youtube' && state.ytPlayerReady) {
      // When using raw iframe embed, we can't access getCurrentTime/getDuration
      // The iframe sandbox blocks cross-origin JS API access.
      // We show the track's known duration and skip live progress.
      try {
        if (typeof state.ytPlayer.getCurrentTime === 'function') {
          currentPlayTime = state.ytPlayer.getCurrentTime();
          const duration = state.ytPlayer.getDuration();
          if (duration > 0) {
            const percent = (currentPlayTime / duration) * 100;
            DOM.playerTimelineBar.style.width = `${percent}%`;
            DOM.playerTimeCurrent.textContent = formatTime(currentPlayTime);
            DOM.playerTimeDuration.textContent = formatTime(duration);
          }
        } else if (state.currentTrack && state.currentTrack.duration) {
          // Show known duration from search metadata
          DOM.playerTimeDuration.textContent = formatTime(state.currentTrack.duration);
        }
      } catch (err) {
        // ignore iframe cross-origin access errors
      }
    } else if (state.activePlayerEngine === 'soundcloud' && state.scWidgetReady) {
      state.scWidget.getPosition((ms) => {
        state.scWidget.getDuration((durationMs) => {
          currentPlayTime = ms / 1000;
          const duration = durationMs / 1000;
          if (duration > 0) {
            const percent = (currentPlayTime / duration) * 100;
            DOM.playerTimelineBar.style.width = `${percent}%`;
            DOM.playerTimeCurrent.textContent = formatTime(currentPlayTime);
            DOM.playerTimeDuration.textContent = formatTime(duration);
          }
          syncLyricsUI(currentPlayTime);
        });
      });
    }

    if (state.activePlayerEngine !== 'soundcloud') {
      syncLyricsUI(currentPlayTime);
    }

    // 8D SPATIAL AUDIO ANIMATION
    if (state.spatialEnabled && state.pannerNode && state.activePlayerEngine === 'html5') {
      state.spatialAngle += 0.05; // speed of rotation
      const x = Math.sin(state.spatialAngle) * 3;
      const z = Math.cos(state.spatialAngle) * 3;
      state.pannerNode.positionX.value = x;
      state.pannerNode.positionZ.value = z;
    }

    // IMMERSIVE BEAT-SYNC BACKGROUND
    if (state.analyser && state.activePlayerEngine === 'html5') {
      const bufferLength = state.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      state.analyser.getByteFrequencyData(dataArray);
      
      // Calculate bass energy (first 10 bins)
      let bassSum = 0;
      for (let i = 0; i < 10; i++) {
        bassSum += dataArray[i];
      }
      const bassAvg = bassSum / 10;
      const bassEnergy = bassAvg / 255;
      
      const beatScale = 1 + (bassEnergy * 0.05); // max 1.05
      const beatGlow = bassEnergy * 0.4; // max 0.4
      
      document.documentElement.style.setProperty('--beat-scale', beatScale);
      document.documentElement.style.setProperty('--beat-glow', beatGlow);
    } else {
      document.documentElement.style.setProperty('--beat-scale', 1);
      document.documentElement.style.setProperty('--beat-glow', 0);
    }

  }, 250);
}

function syncLyricsUI(currentTime) {
  if (!state.currentLyrics || state.currentLyrics.length === 0) return;
  if (!DOM.modalLyrics.classList.contains('active')) return;

  // Find the active lyric line
  let activeIndex = -1;
  for (let i = 0; i < state.currentLyrics.length; i++) {
    if (currentTime >= state.currentLyrics[i].time) {
      activeIndex = i;
    } else {
      break;
    }
  }

  if (activeIndex !== -1 && state.lastLyricIndex !== activeIndex) {
    state.lastLyricIndex = activeIndex;
    
    // Highlight UI
    const lines = DOM.lyricsContent.querySelectorAll('.lyric-line');
    lines.forEach(l => l.classList.remove('active'));
    
    if (lines[activeIndex]) {
      lines[activeIndex].classList.add('active');
      
      // Auto-scroll logic: scroll the container so the active line is near the middle
      const container = DOM.lyricsContent;
      const targetLine = lines[activeIndex];
      const offset = targetLine.offsetTop - (container.clientHeight / 2) + (targetLine.clientHeight / 2);
      
      container.scrollTo({
        top: Math.max(0, offset),
        behavior: 'smooth'
      });
    }
  }
}

// Resolves YouTube video ID using a multi-stage approach (Invidious search API, Piped API, and YouTube scraping as final fallback)
async function resolveYouTubeVideoId(artist, title) {
  const query = encodeURIComponent(`${artist} - ${title} official audio`);
  console.log(`Resolving video ID for: ${artist} - ${title}`);
  
  const invidiousHosts = [
    'https://yt.chocolatemoo53.com',
    'https://inv.thepixora.com',
    'https://invidious.tiekoetter.com',
    'https://invidious.lunar.icu',
    'https://invidious.nerdvpn.de'
  ];

  const pipedHosts = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.tokhmi.xyz',
    'https://api.piped.yt'
  ];

  const proxies = [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, // Try allorigins first (doesn't block payload sizes)
    (url) => `https://corsproxy.io/?${url}`
  ];

  // Stage 1: Try Invidious API search (extremely light JSON payload)
  for (const host of invidiousHosts) {
    const searchUrl = `${host}/api/v1/search?q=${query}&type=video`;
    
    // Try direct fetch first (for users running local setups or instances supporting CORS)
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2500);
      const response = await fetch(searchUrl, { signal: controller.signal });
      clearTimeout(id);
      
      if (response.ok) {
        const json = await response.json();
        if (Array.isArray(json) && json.length > 0) {
          const video = json.find(item => item.type === 'video' || item.videoId);
          if (video && video.videoId) {
            console.log(`Resolved video ID "${video.videoId}" via direct Invidious search on ${host}`);
            return video.videoId;
          }
        }
      }
    } catch (err) {
      console.warn(`Direct Invidious search failed on ${host}, trying proxies...`);
    }

    // Try via CORS proxies
    for (const getProxyUrl of proxies) {
      try {
        const proxyUrl = getProxyUrl(searchUrl);
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 4000); // 4s timeout for proxies
        const response = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(id);
        
        if (response.ok) {
          const json = await response.json();
          if (Array.isArray(json) && json.length > 0) {
            const video = json.find(item => item.type === 'video' || item.videoId);
            if (video && video.videoId) {
              console.log(`Resolved video ID "${video.videoId}" via proxied Invidious search on ${host}`);
              return video.videoId;
            }
          }
        }
      } catch (err) {
        console.warn(`Proxied Invidious search failed on ${host} via proxy:`, err);
      }
    }
  }

  // Stage 2: Try Piped API search
  for (const host of pipedHosts) {
    const searchUrl = `${host}/search?q=${query}&filter=videos`;
    
    // Try direct fetch first
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2500);
      const response = await fetch(searchUrl, { signal: controller.signal });
      clearTimeout(id);
      
      if (response.ok) {
        const json = await response.json();
        const items = json.streamItems || [];
        const videoItem = items.find(item => item.type === 'video');
        if (videoItem && videoItem.url) {
          const match = videoItem.url.match(/[?&]v=([^&#]*)/);
          const videoId = match ? match[1] : videoItem.url.replace('/watch?v=', '');
          if (videoId) {
            console.log(`Resolved video ID "${videoId}" via direct Piped search on ${host}`);
            return videoId;
          }
        }
      }
    } catch (err) {
      console.warn(`Direct Piped fetch failed on ${host}, trying proxies...`);
    }

    // Try via CORS proxies
    for (const getProxyUrl of proxies) {
      try {
        const proxyUrl = getProxyUrl(searchUrl);
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 4000);
        const response = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(id);
        
        if (response.ok) {
          const json = await response.json();
          const items = json.streamItems || [];
          const videoItem = items.find(item => item.type === 'video');
          if (videoItem && videoItem.url) {
            const match = videoItem.url.match(/[?&]v=([^&#]*)/);
            const videoId = match ? match[1] : videoItem.url.replace('/watch?v=', '');
            if (videoId) {
              console.log(`Resolved video ID "${videoId}" via proxied Piped search on ${host}`);
              return videoId;
            }
          }
        }
      } catch (err) {
        console.warn(`Proxied Piped fetch failed on ${host} via proxy:`, err);
      }
    }
  }

  // Stage 3: Fallback to YouTube scraping (only via AllOrigins to avoid 413 payload size blocks)
  console.warn('Invidious and Piped resolution failed. Falling back to YouTube page scraping...');
  const scrapeUrl = `https://www.youtube.com/results?search_query=${query}`;
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(scrapeUrl)}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000); // 5s timeout for scraping
    const response = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(id);

    if (response.ok) {
      const html = await response.text();
      const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
      if (match && match[1]) {
        console.log(`Resolved video ID "${match[1]}" via YouTube scrape`);
        return match[1];
      }
    }
  } catch (err) {
    console.warn('Scraping fallback failed:', err);
  }
  
  return null;
}

// Global variable for Invidious host configuration
let invidiousHost = null;
const fallbackInvidiousHosts = [
  'https://yt.chocolatemoo53.com',
  'https://inv.thepixora.com',
  'https://invidious.tiekoetter.com',
  'https://invidious.lunar.icu',
  'https://invidious.nerdvpn.de'
];

async function resolveInvidiousHost() {
  if (invidiousHost) return invidiousHost;
  try {
    const response = await fetch('https://api.invidious.io/instances.json?sort_by=health');
    if (response.ok) {
      const instances = await response.json();
      const healthy = instances
        .map(item => item[1])
        .filter(cfg => cfg.type === 'https' && cfg.monitor && cfg.monitor.status === 'up')
        .map(cfg => cfg.uri);
      
      if (healthy && healthy.length > 0) {
        invidiousHost = healthy[0];
        console.log(`Resolved Invidious API host: ${invidiousHost}`);
        return invidiousHost;
      }
    }
  } catch (err) {
    console.warn('Invidious bootstrap failed, trying fallbacks...');
  }
  
  invidiousHost = fallbackInvidiousHosts[Math.floor(Math.random() * fallbackInvidiousHosts.length)];
  console.log(`Using fallback Invidious host: ${invidiousHost}`);
  return invidiousHost;
}

async function getInvidiousAudioUrl(videoId) {
  const backendBase = window.AURA_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`);
  return `${backendBase}/api/stream/${videoId}`;
}

async function playTrack(track, contextQueue = null) {
  try {
    if (state.audioContext && state.audioContext.state === 'suspended') {
      state.audioContext.resume();
    }
    
    // 1. Manage Playback Queue
    if (contextQueue && Array.isArray(contextQueue)) {
      state.queue = [...contextQueue];
      state.queueIndex = state.queue.findIndex(t => t.id === track.id);
    } else {
      const inQueueIndex = state.queue.findIndex(t => t.id === track.id);
      if (inQueueIndex !== -1) {
        state.queueIndex = inQueueIndex;
      } else {
        state.queue.push(track);
        state.queueIndex = state.queue.length - 1;
      }
    }

    // Log the play for Aura Wrapped (Listening Stats)
    db.logTrackPlay(track);

    // 2. Full Song Playback via Backend Audio Proxy (iTunes & YouTube)
    // Uses yt-dlp backend to extract and proxy audio — NO mini player needed!
    if ((track.source === 'itunes' || track.source === 'youtube') && state.forceFullSongs) {
      state.activePlayerEngine = 'html5';
      DOM.floatingVideoPlayer.classList.remove('active');
      
      // Stop other engines immediately
      state.audio.pause();
      stopYouTubeVideo();
      if (state.scWidgetReady) state.scWidget.pause();

      state.currentTrack = track;
      
      try {
        // Get video ID
        let videoId;
        if (track.source === 'youtube') {
          videoId = track.streamUrl;
        } else {
          showToast(`Finding full track for "${track.title}"...`, 'info');
          videoId = await resolveYouTubeVideoId(track.artist, track.title);
        }
        
        if (videoId) {
          // Check if backend is reachable
          let backendAlive = false;
          try {
            const backendBase = window.AURA_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`);
            const probe = await fetch(`${backendBase}/api/health`, {
              method: 'GET',
              signal: AbortSignal.timeout(3000)
            });
            backendAlive = probe.ok;
          } catch (_) {
            backendAlive = false;
          }

          if (backendAlive) {
            // 🎵 Stream audio via backend proxy — pure HTML5 <audio>, no iframe!
            const backendBase = window.AURA_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`);
            const streamUrl = `${backendBase}/api/stream/${videoId}`;
            state.audio.src = streamUrl;
            state.audio.load();
            
            // Timeout: if audio doesn't start within 10s, show error
            let streamTimeout = setTimeout(() => {
              if (state.currentTrack && state.currentTrack.id === track.id && 
                  (state.audio.paused || state.audio.readyState < 2)) {
                console.warn('Backend stream timeout');
                // Fall back to preview for iTunes, or show error for YouTube
                if (track.source === 'itunes' && track.streamUrl) {
                  showToast('Stream timeout. Playing 30-sec preview.', 'warning');
                  state.audio.src = track.streamUrl;
                  state.audio.load();
                  state.audio.play().catch(e => console.warn(e));
                } else {
                  showToast('Stream timeout. Please check backend server.', 'error');
                }
              }
            }, 10000);
            
            state.audio.play().then(() => {
              clearTimeout(streamTimeout);
              showToast('🎵 Streaming full song (no mini player!)', 'success');
            }).catch(e => {
              clearTimeout(streamTimeout);
              console.warn('Backend stream play failed:', e);
              if (track.source === 'itunes' && track.streamUrl) {
                showToast('Stream failed. Playing 30-sec preview.', 'warning');
                state.audio.src = track.streamUrl;
                state.audio.load();
                state.audio.play().catch(err => console.warn(err));
              } else {
                showToast('Playback failed. Is the backend running?', 'error');
              }
            });
            state.audio.volume = state.volume;
            initWebAudioContext();
          } else {
            // Backend is down — fall back gracefully
            if (track.source === 'itunes' && track.streamUrl) {
              showToast('Backend offline. Playing 30-sec preview.', 'warning');
              state.audio.src = track.streamUrl;
              state.audio.load();
              state.audio.play().catch(e => console.warn(e));
              state.audio.volume = state.volume;
              initWebAudioContext();
            } else {
              // YouTube tracks: last resort = iframe (but warn user)
              showToast('Backend offline. Start the Python server for full audio!', 'warning');
              state.activePlayerEngine = 'youtube';
              DOM.floatingVideoPlayer.classList.add('active');
              playYouTubeVideo(videoId);
            }
          }
        } else {
          // Could not find video ID — play 30s iTunes preview if available
          if (track.source === 'itunes' && track.streamUrl) {
            showToast('Could not find full track. Playing 30-sec preview.', 'warning');
            state.audio.src = track.streamUrl;
            state.audio.load();
            state.audio.play().catch(e => console.warn(e));
            state.audio.volume = state.volume;
            initWebAudioContext();
          } else {
            showToast('Could not resolve video. Please try another track.', 'error');
          }
        }
      } catch (err) {
        console.error('Full playback resolution failed:', err);
        if (track.source === 'itunes' && track.streamUrl) {
          showToast('Playback error. Playing 30-sec preview.', 'warning');
          state.audio.src = track.streamUrl;
          state.audio.load();
          state.audio.play().catch(e => console.warn(e));
          state.audio.volume = state.volume;
          initWebAudioContext();
        } else {
          showToast('Playback failed.', 'error');
        }
      }

      state.isPlaying = true;
      updatePlayerBarUI();
      updatePlaybackControlsUI();
      return;
    }

    state.currentTrack = track;

    // 3. Stop all player engines smoothly
    if (state.activePlayerEngine === 'html5' && !state.audio.paused) {
      await fadeAudioVolume(0, 400); // Crossfade out
    }
    state.audio.pause();
    stopYouTubeVideo(); // Stop iframe-based YouTube player
    if (state.scWidgetReady) state.scWidget.pause();

    // 4. Divert to Brand Player Engine (only for non-full-song mode)
    if (track.source === 'youtube') {
      // When forceFullSongs is OFF, use iframe as before
      state.activePlayerEngine = 'youtube';
      DOM.floatingVideoPlayer.classList.add('active');

      const videoId = track.streamUrl;
      showToast(`Streaming "${track.title}" from YouTube Music`, 'success');
      playYouTubeVideo(videoId);

    } else if (track.source === 'soundcloud') {
      state.activePlayerEngine = 'soundcloud';
      DOM.floatingVideoPlayer.classList.remove('active');
      
      if (state.scWidgetReady) {
        state.scWidget.load(track.streamUrl, { auto_play: true, show_artwork: false });
        state.scWidget.setVolume(state.volume * 100);
      } else {
        showToast('SoundCloud widget loading...', 'warning');
      }
    } else {
      // HTML5 Engine (local tracks, audius)
      state.activePlayerEngine = 'html5';
      DOM.floatingVideoPlayer.classList.remove('active');

      let audioSrc = '';
      if (activeBlobUrls.has(track.id)) {
        URL.revokeObjectURL(activeBlobUrls.get(track.id));
        activeBlobUrls.delete(track.id);
      }

      if (track.source === 'local') {
        // Fetch binary data from indexedDB or OPFS
        const audioData = await db.getLocalTrackAudio(track.id);
        
        // Cleanup previous local blob URL to prevent memory leak
        if (state.currentBlobUrl) {
          URL.revokeObjectURL(state.currentBlobUrl);
          state.currentBlobUrl = null;
        }

        // Check if audioData is a File (OPFS) or Blob (IndexedDB)
        if (audioData instanceof File || audioData instanceof Blob) {
          audioSrc = URL.createObjectURL(audioData);
          state.currentBlobUrl = audioSrc;
        } else {
          throw new Error("Invalid local audio data format");
        }
        activeBlobUrls.set(track.id, audioSrc);
      } else {
        audioSrc = track.streamUrl;
      }

      state.audio.src = audioSrc;
      state.audio.load();
      state.audio.volume = 0; // Start at 0 for fade in
      state.audio.play().catch(e => console.warn(e));
      fadeAudioVolume(state.volume, 800); // Fade in
      
      // Start audio visualizer context
      initWebAudioContext();
    }

    state.isPlaying = true;
    updatePlayerBarUI();
    updatePlaybackControlsUI();

  } catch (err) {
    console.error('PlayTrack error:', err);
  }
}

async function pauseTrack() {
  state.isPlaying = false;
  updatePlaybackControlsUI();
  
  if (state.activePlayerEngine === 'html5') {
    await fadeAudioVolume(0, 400);
    state.audio.pause();
  } else if (state.activePlayerEngine === 'youtube') {
    // For iframe-based YouTube, stop video by clearing src
    stopYouTubeVideo();
    DOM.floatingVideoPlayer.classList.remove('active');
  } else if (state.activePlayerEngine === 'soundcloud' && state.scWidgetReady) {
    state.scWidget.pause();
  }
}

async function resumeTrack() {
  if (!state.currentTrack) {
    if (state.queue.length > 0) playTrack(state.queue[0]);
    return;
  }

  state.isPlaying = true;
  updatePlaybackControlsUI();
  
  if (state.audioContext && state.audioContext.state === 'suspended') {
    state.audioContext.resume();
  }
  
  if (state.activePlayerEngine === 'html5') {
    state.audio.volume = 0;
    state.audio.play().catch(e => console.warn(e));
    fadeAudioVolume(state.volume, 400);
  } else if (state.activePlayerEngine === 'youtube') {
    // For iframe YouTube, re-play the current track
    if (state.currentTrack) {
      DOM.floatingVideoPlayer.classList.add('active');
      playYouTubeVideo(state.currentTrack.streamUrl);
    }
  } else if (state.activePlayerEngine === 'soundcloud' && state.scWidgetReady) {
    state.scWidget.play();
  }
}

function nextTrack() {
  if (state.queue.length === 0) return;
  
  if (state.isShuffle) {
    state.queueIndex = Math.floor(Math.random() * state.queue.length);
  } else {
    state.queueIndex = (state.queueIndex + 1) % state.queue.length;
  }
  
  playTrack(state.queue[state.queueIndex]);
}

function prevTrack() {
  if (state.queue.length === 0) return;
  
  state.queueIndex = state.queueIndex - 1;
  if (state.queueIndex < 0) {
    state.queueIndex = state.queue.length - 1;
  }
  
  playTrack(state.queue[state.queueIndex]);
}

async function handleTrackEnded() {
  if (state.repeatMode === 'one') {
    if (state.activePlayerEngine === 'html5') {
      state.audio.currentTime = 0;
      state.audio.play().catch(e => console.error(e));
    } else if (state.activePlayerEngine === 'youtube') {
      // Replay by re-loading the YouTube iframe
      if (state.currentTrack) playYouTubeVideo(state.currentTrack.streamUrl);
    } else if (state.activePlayerEngine === 'soundcloud' && state.scWidgetReady) {
      state.scWidget.seekTo(0);
      state.scWidget.play();
    }
  } else if (state.repeatMode === 'all' || state.queueIndex < state.queue.length - 1) {
    nextTrack();
  } else {
    // --- SMART AUTO-DJ (Infinite Mix Algorithm) ---
    showToast('Auto-DJ is analyzing your taste...', 'info');
    try {
      let query = 'trending music';
      const currentArtist = state.currentTrack?.artist || '';
      
      try {
        // 1. Analyze User's Listening History Profile
        const topTracks = await db.getTopTracks();
        
        if (topTracks && topTracks.length > 0) {
          // Count plays per artist
          const artistCounts = {};
          topTracks.forEach(t => {
            artistCounts[t.artist] = (artistCounts[t.artist] || 0) + (t.playCount || 1);
          });
          
          // Get top 3 artists to add variety
          const sortedArtists = Object.keys(artistCounts).sort((a, b) => artistCounts[b] - artistCounts[a]);
          const topArtists = sortedArtists.slice(0, 3);
          
          // Pick a random top artist to avoid playing the same #1 artist infinitely
          const randomFavorite = topArtists[Math.floor(Math.random() * topArtists.length)];
          
          // 2. Blend current vibe with their historical profile
          if (currentArtist && currentArtist !== randomFavorite) {
            query = `${currentArtist} and ${randomFavorite} similar songs`;
          } else {
            query = `${randomFavorite} best songs radio`;
          }
        } else if (currentArtist) {
          query = `${currentArtist} popular songs`;
        }
      } catch(e) {
        console.warn('Auto-DJ history analysis failed:', e);
        query = currentArtist ? `${currentArtist} radio` : 'trending music 2026';
      }

      console.log('Smart Auto-DJ generated query:', query);
      const results = await api.searchTracks(query);
      
      if (results && results.length > 0) {
        // Filter out tracks already in queue
        const newTracks = results.filter(rt => !state.queue.find(qt => qt.id === rt.id)).slice(0, 5);
        if (newTracks.length > 0) {
          state.queue.push(...newTracks);
          nextTrack();
          showToast(`Auto-DJ added ${newTracks.length} personalized tracks!`, 'success');
          return;
        }
      }
    } catch (err) {
      console.error('Smart Auto-DJ failed:', err);
    }

    state.isPlaying = false;
    updatePlaybackControlsUI();
  }
}

// --- Player Bar UI Syncer ---
async function updatePlayerBarUI() {
  if (!state.currentTrack) return;
  
  const track = state.currentTrack;
  
  DOM.playerTitle.textContent = track.title;
  DOM.playerArtist.textContent = track.artist;
  DOM.playerCover.alt = track.title;
  DOM.playerCover.src = track.coverUrl || '';

  // Brand-Specific Badging colors in Player Bar Title
  const titleClassList = ['youtube', 'soundcloud', 'spotify', 'local', 'audius'];
  titleClassList.forEach(c => DOM.playerTitle.classList.remove(c));
  if (titleClassList.includes(track.source)) {
    DOM.playerTitle.classList.add(track.source);
  }

  // Media Session API (Hardware media keys & Lockscreen info)
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || 'AuraStream',
      artwork: track.coverUrl ? [{ src: track.coverUrl, sizes: '512x512', type: 'image/jpeg' }] : []
    });
  }

  // Check Favorites database matching
  const isFav = await db.isFavorite(track.id);
  if (isFav) {
    DOM.playerFavBtn.innerHTML = '<i class="fa-solid fa-heart fav-active"></i>';
    DOM.playerFavBtn.classList.add('fav-active');
  } else {
    DOM.playerFavBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
    DOM.playerFavBtn.classList.remove('fav-active');
  }

  // Sync Visualizer View if open
  if (state.activeView === 'visualizer') {
    DOM.visTitle.textContent = track.title;
    DOM.visArtist.textContent = track.artist;
    DOM.visCover.src = track.coverUrl || '';
    DOM.visCover.alt = track.title;
    DOM.visSourceTag.textContent = `SOURCE: ${track.source.toUpperCase()}`;
    DOM.visDurationTag.textContent = formatTime(track.duration);
  }

  // Highlight rows in active track lists
  document.querySelectorAll('.track-row').forEach(row => {
    if (row.getAttribute('data-id') === track.id) {
      row.classList.add('active');
    } else {
      row.classList.remove('active');
    }
  });
}

function updatePlaybackControlsUI() {
  if (state.isPlaying) {
    DOM.playerPlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    DOM.playerCover.classList.add('playing');
    if (state.activeView === 'visualizer') {
      DOM.visDiscOuter.classList.add('playing');
    }
  } else {
    DOM.playerPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    DOM.playerCover.classList.remove('playing');
    if (state.activeView === 'visualizer') {
      DOM.visDiscOuter.classList.remove('playing');
    }
  }

  if (state.isShuffle) {
    DOM.playerShuffleBtn.classList.add('active');
  } else {
    DOM.playerShuffleBtn.classList.remove('active');
  }

  DOM.playerRepeatBtn.classList.remove('active');
  if (state.repeatMode === 'one') {
    DOM.playerRepeatBtn.innerHTML = '<i class="fa-solid fa-repeat"></i><span style="font-size: 0.5rem; position: absolute; bottom: 0;">1</span>';
    DOM.playerRepeatBtn.classList.add('active');
  } else if (state.repeatMode === 'all') {
    DOM.playerRepeatBtn.innerHTML = '<i class="fa-solid fa-repeat"></i>';
    DOM.playerRepeatBtn.classList.add('active');
  } else {
    DOM.playerRepeatBtn.innerHTML = '<i class="fa-solid fa-repeat"></i>';
  }
}

// --- Aura Wrapped (Stats) View ---
async function renderStatsView() {
  DOM.statsContainer.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading stats...</div>';
  const topTracks = await db.getTopTracks();
  
  if (topTracks.length === 0) {
    DOM.statsContainer.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted);">
        <i class="fa-solid fa-ghost" style="font-size: 3rem; margin-bottom: 16px;"></i>
        <p>No listening history found yet. Go play some music!</p>
      </div>`;
    return;
  }

  // Calculate top artist
  const artistCounts = {};
  let totalPlays = 0;
  topTracks.forEach(t => {
    artistCounts[t.artist] = (artistCounts[t.artist] || 0) + t.playCount;
    totalPlays += t.playCount;
  });
  const topArtist = Object.keys(artistCounts).reduce((a, b) => artistCounts[a] > artistCounts[b] ? a : b);

  let html = `
    <div style="background: linear-gradient(135deg, var(--primary), #ec4899); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; box-shadow: 0 10px 25px rgba(236,72,153,0.3);">
      <h3 style="font-size: 1.2rem; margin-bottom: 8px; color: white; opacity: 0.9;">Your Top Artist</h3>
      <h2 style="font-size: 2.5rem; margin-bottom: 8px; color: white; text-shadow: 0 2px 10px rgba(0,0,0,0.3);">${topArtist}</h2>
      <p style="color: rgba(255,255,255,0.8); font-size: 0.95rem;">${artistCounts[topArtist]} plays out of ${totalPlays} total</p>
    </div>
    
    <h3 style="color: var(--text-secondary); margin-bottom: 12px; font-size: 1rem; border-bottom: 1px solid var(--border-glass); padding-bottom: 8px;">Top 10 Tracks</h3>
  `;

  topTracks.slice(0, 10).forEach((track, index) => {
    html += `
      <div class="track-row track-row-stats" style="background: rgba(0,0,0,0.2); border: 1px solid var(--border-glass); cursor: default;">
        <div class="track-col-number" style="font-size: 1.2rem; font-weight: bold; color: var(--primary);">${index + 1}</div>
        <div class="track-col-title">
          <img src="${track.coverUrl || 'assets/album-default.svg'}" alt="Cover" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover;">
          <div class="track-info">
            <span class="track-name" style="font-size: 1rem; color: var(--text-primary);">${track.title}</span>
            <span class="track-artist">${track.artist}</span>
          </div>
        </div>
        <div class="track-col-album" style="justify-content: flex-end; padding-right: 20px;">
          <span style="background: var(--primary); padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; color: white; font-weight: 500;">
            <i class="fa-solid fa-play" style="font-size: 0.7rem; margin-right: 4px;"></i> ${track.playCount}
          </span>
        </div>
      </div>
    `;
  });

  DOM.statsContainer.innerHTML = html;
}

// --- Reverb Impulse Synthesizer ---
function createReverbImpulseResponse(audioContext) {
  // Create a 2 second impulse response
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * 2.5; 
  const impulse = audioContext.createBuffer(2, length, sampleRate);
  
  for (let i = 0; i < 2; i++) {
    const channelData = impulse.getChannelData(i);
    for (let j = 0; j < length; j++) {
      // Exponential decay white noise
      channelData[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, 3);
    }
  }
  return impulse;
}

// --- Web Audio Visualizer API ---
function initWebAudioContext() {
  if (state.audioContext) return;
  
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioContextClass();
    
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 256;
    
    state.sourceNode = state.audioContext.createMediaElementSource(state.audio);
    
    // Equalizer Filters
    state.eqBassNode = state.audioContext.createBiquadFilter();
    state.eqBassNode.type = 'lowshelf';
    state.eqBassNode.frequency.value = 150;
    
    state.eqTrebleNode = state.audioContext.createBiquadFilter();
    state.eqTrebleNode.type = 'highshelf';
    state.eqTrebleNode.frequency.value = 4000;

    // Reverb Node (Convolver)
    state.reverbNode = state.audioContext.createConvolver();
    state.reverbNode.buffer = createReverbImpulseResponse(state.audioContext);
    
    // Panner Node (8D Audio)
    state.pannerNode = state.audioContext.createPanner();
    state.pannerNode.panningModel = 'HRTF';
    state.pannerNode.distanceModel = 'inverse';
    state.pannerNode.refDistance = 1;
    state.pannerNode.maxDistance = 10000;
    state.pannerNode.rolloffFactor = 1;
    state.pannerNode.coneInnerAngle = 360;
    state.pannerNode.coneOuterAngle = 0;
    state.pannerNode.coneOuterGain = 0;
    // Set listener to origin
    if (state.audioContext.listener.positionX) {
      state.audioContext.listener.positionX.value = 0;
      state.audioContext.listener.positionY.value = 0;
      state.audioContext.listener.positionZ.value = 0;
    } else {
      state.audioContext.listener.setPosition(0, 0, 0);
    }
    
    // Dry/Wet Reverb Mixer (Gain)
    state.reverbGainNode = state.audioContext.createGain();
    state.reverbGainNode.gain.value = 0; // 0 = Dry (Normal), 0.5 = Wet (Slowed + Reverb)

    state.dryGainNode = state.audioContext.createGain();
    state.dryGainNode.gain.value = 1;

    // Restore UI values if moved before playback started
    if (DOM.eqBass) state.eqBassNode.gain.value = parseInt(DOM.eqBass.value) || 0;
    if (DOM.eqTreble) state.eqTrebleNode.gain.value = parseInt(DOM.eqTreble.value) || 0;

    // Connect routing graph:
    // Source -> Bass -> Treble -> (Split to Dry and Reverb) -> Panner -> Analyser -> Destination
    state.sourceNode.connect(state.eqBassNode);
    state.eqBassNode.connect(state.eqTrebleNode);
    
    // Split
    state.eqTrebleNode.connect(state.dryGainNode);
    state.eqTrebleNode.connect(state.reverbNode);
    
    // Reverb to its gain
    state.reverbNode.connect(state.reverbGainNode);
    
    // Merge Dry and Reverb -> Panner
    state.dryGainNode.connect(state.pannerNode);
    state.reverbGainNode.connect(state.pannerNode);
    
    // Panner -> Analyser -> Destination
    state.pannerNode.connect(state.analyser);
    state.analyser.connect(state.audioContext.destination);

    // Apply remix mode if it was changed before playing
    applyRemixMode(state.remixMode);

  } catch (error) {
    console.warn('Web Audio node CORS error. Visualizer running in mathematical simulation mode.', error);
  }
}

function initVisualizerCanvas() {
  if (state.visualizerActive) return;
  state.visualizerActive = true;
  
  const canvas = DOM.visCanvas;
  let gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  
  if (!gl) {
    console.error('WebGL not supported');
    return;
  }

  const resizeCanvas = () => {
    canvas.width = canvas.parentElement.clientWidth * window.devicePixelRatio;
    canvas.height = 180 * window.devicePixelRatio;
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Phase 1: GLSL Cosmic Shader
  const vsSource = `
    attribute vec4 aVertexPosition;
    void main() { gl_Position = aVertexPosition; }
  `;

  const fsSource = `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_bass;
    uniform float u_treble;
    uniform vec3 u_color1;
    uniform vec3 u_color2;

    mat2 rot(float a) {
        float s = sin(a), c = cos(a);
        return mat2(c, -s, s, c);
    }

    float star(vec2 uv, float flare) {
        float d = length(uv);
        float m = 0.05 / d;
        float rays = max(0.0, 1.0 - abs(uv.x * uv.y * 1000.0));
        m += rays * flare;
        uv *= rot(3.1415 / 4.0);
        rays = max(0.0, 1.0 - abs(uv.x * uv.y * 1000.0));
        m += rays * 0.3 * flare;
        m *= smoothstep(1.0, 0.2, d);
        return m;
    }

    float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
    }

    vec3 starLayer(vec2 uv) {
        vec3 col = vec3(0.0);
        vec2 gv = fract(uv) - 0.5;
        vec2 id = floor(uv);
        for(int y=-1;y<=1;y++){
            for(int x=-1;x<=1;x++){
                vec2 offs = vec2(x, y);
                float n = hash21(id + offs);
                float size = fract(n * 345.32);
                float star_val = star(gv - offs - vec2(n, fract(n*34.0)) + 0.5, smoothstep(0.8, 1.0, size));
                vec3 color = sin(u_color1 * fract(n*2345.2) * 123.2) * 0.5 + 0.5;
                color = color * vec3(1.0, 0.5, 1.0 + size);
                col += star_val * size * color;
            }
        }
        return col;
    }

    void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
        float t = u_time * 0.02;
        uv *= rot(t);
        
        vec3 col = vec3(0.0);
        // Warp speed effect on bass
        float speed = u_time * (0.1 + u_bass * 0.015);
        
        for(float i=0.0; i<1.0; i+=0.25) {
            float depth = fract(i + speed);
            float scale = mix(20.0, 0.5, depth);
            float fade = depth * smoothstep(1.0, 0.9, depth);
            col += starLayer(uv * scale + i * 453.2) * fade;
        }
        
        float core = 0.1 / length(uv);
        col += mix(u_color2, u_color1, sin(u_time)*0.5+0.5) * core * (u_treble * 0.01);
        
        gl_FragColor = vec4(col, 1.0);
    }
  `;

  function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader error: ' + gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  const programInfo = {
    program: shaderProgram,
    attribLocations: { vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition') },
    uniformLocations: {
      resolution: gl.getUniformLocation(shaderProgram, 'u_resolution'),
      time: gl.getUniformLocation(shaderProgram, 'u_time'),
      bass: gl.getUniformLocation(shaderProgram, 'u_bass'),
      treble: gl.getUniformLocation(shaderProgram, 'u_treble'),
      color1: gl.getUniformLocation(shaderProgram, 'u_color1'),
      color2: gl.getUniformLocation(shaderProgram, 'u_color2'),
    },
  };

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0]), gl.STATIC_DRAW);

  const colorPalettes = [
    { start: [139/255, 92/255, 246/255], end: [99/255, 102/255, 241/255], hexStart: '#8b5cf6', hexEnd: '#6366f1' },
    { start: [6/255, 182/255, 212/255], end: [16/255, 185/255, 129/255], hexStart: '#06b6d4', hexEnd: '#10b981' },
    { start: [236/255, 72/255, 153/255], end: [168/255, 85/255, 247/255], hexStart: '#ec4899', hexEnd: '#a855f7' }
  ];

  let startTime = Date.now();

  function renderFrame() {
    if (!state.visualizerActive) return;
    state.animationFrameId = requestAnimationFrame(renderFrame);
    
    const bufferLength = state.analyser ? state.analyser.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);
    
    if (state.analyser && state.isPlaying && state.activePlayerEngine === 'html5') {
      state.analyser.getByteFrequencyData(dataArray);
    } else {
      const t2 = Date.now() * 0.004;
      for (let i = 0; i < bufferLength; i++) {
        if (state.isPlaying) {
          dataArray[i] = Math.abs(Math.sin(i * 0.1 + t2) * Math.cos(i * 0.05 + t2 * 0.5)) * 140 + Math.random() * 20;
        } else {
          dataArray[i] = Math.max(10, Math.sin(i * 0.15 + t2 * 0.25) * 8 + 8);
        }
      }
    }

    let bassEnergy = 0;
    for (let i = 0; i < 8; i++) bassEnergy += dataArray[i];
    const averageBass = bassEnergy / 8;

    let trebleEnergy = 0;
    for (let i = bufferLength - 16; i < bufferLength; i++) trebleEnergy += dataArray[i];
    const averageTreble = trebleEnergy / 16;
    
    if (DOM.visCover) {
      const hexToRgba = (hex, alpha) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };
      const palette = colorPalettes[state.visualizerStyle];
      const scale = 1 + (Math.max(0, averageBass - 120) / 135) * 0.15;
      const glowIntensity = Math.max(0, averageBass - 100) / 155; 
      DOM.visCover.style.transform = `scale(${scale})`;
      if (glowIntensity > 0.05) {
        DOM.visCover.style.boxShadow = `0 20px 60px ${hexToRgba(palette.hexStart, glowIntensity)}, 0 0 40px ${hexToRgba(palette.hexEnd, glowIntensity)}`;
      } else {
        DOM.visCover.style.boxShadow = '0 10px 40px rgba(0,0,0,0.5)';
      }
    }

    gl.clearColor(0.02, 0.03, 0.04, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    gl.useProgram(programInfo.program);

    const time = (Date.now() - startTime) / 1000;
    gl.uniform2f(programInfo.uniformLocations.resolution, canvas.width, canvas.height);
    gl.uniform1f(programInfo.uniformLocations.time, time);
    gl.uniform1f(programInfo.uniformLocations.bass, averageBass);
    gl.uniform1f(programInfo.uniformLocations.treble, averageTreble);
    
    const p = colorPalettes[state.visualizerStyle];
    gl.uniform3f(programInfo.uniformLocations.color1, p.start[0], p.start[1], p.start[2]);
    gl.uniform3f(programInfo.uniformLocations.color2, p.end[0], p.end[1], p.end[2]);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  renderFrame();
  
  // Prevent Memory Leak: Pause visualizer when tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.animationFrameId) {
        cancelAnimationFrame(state.animationFrameId);
        state.animationFrameId = null;
      }
    } else {
      if (state.isPlaying && !state.animationFrameId) {
        renderFrame();
      }
    }
  });
}
function stopVisualizerCanvas() {
  state.visualizerActive = false;
  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
  }
}

// --- Dynamic List Renderer ---
function createTrackRowDOM(track, index, parentList) {
  const row = document.createElement('div');
  row.className = 'track-row';
  row.setAttribute('data-id', track.id);
  
  if (state.currentTrack && state.currentTrack.id === track.id) {
    row.classList.add('active');
  }

  // Source badges styling
  let badgeIcon = '<i class="fa-solid fa-cloud" title="Audius"></i>';
  if (track.source === 'itunes') badgeIcon = '<i class="fa-brands fa-apple" title="iTunes Previews"></i>';
  if (track.source === 'local') badgeIcon = '<i class="fa-solid fa-database" title="Local Storage"></i>';
  if (track.source === 'youtube') badgeIcon = '<i class="fa-brands fa-youtube" style="color:#ef4444;" title="YouTube Music"></i>';
  if (track.source === 'soundcloud') badgeIcon = '<i class="fa-brands fa-soundcloud" style="color:#ff5500;" title="SoundCloud"></i>';

  row.innerHTML = `
    <div class="track-index">${index + 1}</div>
    <img class="track-row-img" src="${track.coverUrl || ''}" alt="${track.title}">
    <div class="track-details-col">
      <span class="track-title">${track.title}</span>
      <span class="track-artist">${badgeIcon} ${track.artist}</span>
    </div>
    <div class="track-album-col">${track.album}</div>
    <div class="track-time-col">${formatTime(track.duration)}</div>
    <div class="track-actions-col">
      <button class="track-action-btn add-to-playlist-btn" title="Add to Playlist"><i class="fa-solid fa-folder-plus"></i></button>
      <button class="track-action-btn favorite-btn" title="Favorite"></button>
    </div>
  `;

  row.addEventListener('click', (e) => {
    if (e.target.closest('.track-action-btn')) return;
    playTrack(track, parentList);
  });

  const favBtn = row.querySelector('.favorite-btn');
  const syncFavBtn = async () => {
    const isFav = await db.isFavorite(track.id);
    if (isFav) {
      favBtn.innerHTML = '<i class="fa-solid fa-heart fav-active"></i>';
      favBtn.classList.add('fav-active');
    } else {
      favBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
      favBtn.classList.remove('fav-active');
    }
  };
  syncFavBtn();

  favBtn.addEventListener('click', async () => {
    try {
      const isFav = await db.toggleFavorite(track);
      syncFavBtn();
      if (state.currentTrack && state.currentTrack.id === track.id) {
        updatePlayerBarUI();
      }
      showToast(isFav ? 'Added to favorites.' : 'Removed from favorites.', 'success');
      if (state.activeView === 'favorites') {
        loadFavoritesList();
      }
    } catch (err) {
      console.error(err);
    }
  });

  row.querySelector('.add-to-playlist-btn').addEventListener('click', () => {
    playlistTargetTrack = track;
    openAddToPlaylistModal();
  });

  return row;
}

// --- 1. Discover View Controller ---
async function fetchTrendingTracks() {
  DOM.trendingGrid.innerHTML = `
    <div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted);">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 12px; color: var(--primary);"></i>
      <p>Loading real-time Top Tracks from iTunes Charts...</p>
    </div>
  `;

  const trending = await api.getTrendingTracks();
  DOM.trendingGrid.innerHTML = '';
  
  if (trending.length === 0) {
    DOM.trendingGrid.innerHTML = `
      <div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 12px;"></i>
        <p>Could not connect to API discovery nodes. Using fallback.</p>
      </div>
    `;
    return;
  }

  trending.slice(0, 12).forEach(track => {
    const card = document.createElement('div');
    card.className = 'music-card';
    card.innerHTML = `
      <span class="card-badge itunes" style="background: rgba(255, 42, 109, 0.8);">iTunes</span>
      <div class="card-img-container">
        <img class="card-img" src="${track.coverUrl || ''}" alt="${track.title}">
        <button class="card-play-btn"><i class="fa-solid fa-play"></i></button>
      </div>
      <div class="card-title">${track.title}</div>
      <div class="card-subtitle">${track.artist}</div>
    `;

    card.querySelector('.card-play-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      playTrack(track, trending);
    });
    
    card.addEventListener('click', () => {
      playTrack(track, trending);
    });

    DOM.trendingGrid.appendChild(card);
  });
}

async function loadLocalTracksHome() {
  const localTracks = await db.getLocalTracks();
  DOM.homeLocalGrid.innerHTML = '';

  if (localTracks.length === 0) {
    DOM.homeLocalGrid.innerHTML = `
      <div class="music-card special-card-create" id="home-create-card-trigger">
        <div class="create-icon-btn"><i class="fa-solid fa-plus"></i></div>
        <div class="card-title">Upload Music</div>
        <div class="card-subtitle">Import your own files</div>
      </div>
    `;
    
    DOM.homeLocalGrid.querySelector('#home-create-card-trigger').addEventListener('click', () => {
      navigateToView('upload');
    });
    return;
  }

  localTracks.slice(0, 6).forEach(track => {
    const card = document.createElement('div');
    card.className = 'music-card';
    card.innerHTML = `
      <span class="card-badge local">Local</span>
      <div class="card-img-container">
        <img class="card-img" src="${track.coverUrl || ''}" alt="${track.title}">
        <button class="card-play-btn"><i class="fa-solid fa-play"></i></button>
      </div>
      <div class="card-title">${track.title}</div>
      <div class="card-subtitle">${track.artist}</div>
    `;

    card.querySelector('.card-play-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      playTrack(track, localTracks);
    });
    
    card.addEventListener('click', () => {
      playTrack(track, localTracks);
    });

    DOM.homeLocalGrid.appendChild(card);
  });
}

// --- 2. Search View Controller ---
let currentSearchQuery = '';
async function executeGlobalSearch(query) {
  if (!query || query.trim() === '') return;
  currentSearchQuery = query;

  DOM.searchResultsList.innerHTML = `
    <div style="padding: 40px; text-align: center; color: var(--text-muted);">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 2.2rem; margin-bottom: 12px; color: var(--primary);"></i>
      <p>Searching all popular sources...</p>
    </div>
  `;

  navigateToView('search');
  DOM.searchTitleText.textContent = `Search Results for "${query}"`;

  // SoundCloud direct URL pasting bypass play check
  if (query.toLowerCase().includes('soundcloud.com/')) {
    showToast('SoundCloud Link detected! Loading track...', 'success');
    const scTrack = {
      id: `soundcloud_${Date.now()}`,
      title: 'SoundCloud Shared Link',
      artist: 'SoundCloud Music',
      album: 'SoundCloud Stream',
      coverUrl: 'assets/album-default.svg',
      streamUrl: query,
      duration: 180,
      source: 'soundcloud'
    };
    renderSearchResults([scTrack]);
    return;
  }

  const cloudResults = await api.searchTracks(query);
  const localTracks = await db.getLocalTracks();
  const matchedLocal = localTracks.filter(t => 
    t.title.toLowerCase().includes(query.toLowerCase()) || 
    t.artist.toLowerCase().includes(query.toLowerCase())
  );

  const allResults = [...matchedLocal, ...cloudResults];
  renderSearchResults(allResults);
}

function renderSearchResults(results) {
  DOM.searchResultsList.innerHTML = '';
  
  let filtered = [...results];
  if (state.searchSourceFilter === 'local') {
    filtered = results.filter(t => t.source === 'local');
  } else if (state.searchSourceFilter === 'audius') {
    filtered = results.filter(t => t.source === 'audius');
  } else if (state.searchSourceFilter === 'itunes') {
    filtered = results.filter(t => t.source === 'itunes');
  } else if (state.searchSourceFilter === 'youtube') {
    filtered = results.filter(t => t.source === 'youtube');
  }

  if (filtered.length === 0) {
    DOM.searchResultsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-ban"></i></div>
        <div class="empty-state-text">No tracks found</div>
        <div class="empty-state-subtext">Try another filter source tag.</div>
      </div>
    `;
    return;
  }

  filtered.forEach((track, i) => {
    const row = createTrackRowDOM(track, i, filtered);
    DOM.searchResultsList.appendChild(row);
  });
}

function updateSearchFilterButtons() {
  const btns = [DOM.filterAll, DOM.filterLocal, DOM.filterAudius, DOM.filterItunes, DOM.filterYoutube];
  btns.forEach(btn => {
    btn.className = 'modal-btn cancel';
    btn.style.padding = '6px 16px';
    btn.style.fontSize = '0.8rem';
  });

  if (state.searchSourceFilter === 'all') DOM.filterAll.className = 'modal-btn confirm';
  if (state.searchSourceFilter === 'local') DOM.filterLocal.className = 'modal-btn confirm';
  if (state.searchSourceFilter === 'audius') DOM.filterAudius.className = 'modal-btn confirm';
  if (state.searchSourceFilter === 'itunes') DOM.filterItunes.className = 'modal-btn confirm';
  if (state.searchSourceFilter === 'youtube') DOM.filterYoutube.className = 'modal-btn confirm';
}

// --- 3. Favorites Controller ---
async function loadFavoritesList() {
  const favorites = await db.getFavorites();
  DOM.favoritesList.innerHTML = '';

  if (favorites.length === 0) {
    DOM.favoritesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-regular fa-heart"></i></div>
        <div class="empty-state-text">No favorites yet</div>
        <div class="empty-state-subtext">Favorite songs will show up here.</div>
      </div>
    `;
    DOM.playAllFavsBtn.disabled = true;
    return;
  }

  DOM.playAllFavsBtn.disabled = false;
  favorites.forEach((track, i) => {
    const row = createTrackRowDOM(track, i, favorites);
    DOM.favoritesList.appendChild(row);
  });
}

// --- 4. Playlists Screen Controller ---
async function loadPlaylistsGrid() {
  const playlists = await db.getPlaylists();
  DOM.playlistsGrid.innerHTML = '';

  const createCard = document.createElement('div');
  createCard.className = 'music-card special-card-create';
  createCard.innerHTML = `
    <div class="create-icon-btn"><i class="fa-solid fa-plus"></i></div>
    <div class="card-title">Create Playlist</div>
    <div class="card-subtitle">Build lists</div>
  `;
  createCard.addEventListener('click', () => {
    openCreatePlaylistModal();
  });
  DOM.playlistsGrid.appendChild(createCard);

  playlists.forEach(playlist => {
    const card = document.createElement('div');
    card.className = 'music-card';
    card.innerHTML = `
      <div class="card-img-container">
        <img class="card-img" src="${playlist.coverUrl || ''}" alt="${playlist.name}">
        <button class="card-play-btn"><i class="fa-solid fa-play"></i></button>
      </div>
      <div class="card-title">${playlist.name}</div>
      <div class="card-subtitle">${playlist.tracks.length} tracks</div>
    `;

    card.querySelector('.card-play-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (playlist.tracks.length > 0) {
        playTrack(playlist.tracks[0], playlist.tracks);
      } else {
        showToast('Playlist is empty.', 'error');
      }
    });

    card.addEventListener('click', () => {
      navigateToView('playlist-detail', { playlistId: playlist.id });
    });

    DOM.playlistsGrid.appendChild(card);
  });
}

async function loadSidebarPlaylists() {
  const playlists = await db.getPlaylists();
  DOM.sidebarPlaylists.innerHTML = '';

  if (playlists.length === 0) {
    DOM.sidebarPlaylists.innerHTML = `
      <div style="padding: 12px; font-size: 0.8rem; color: var(--text-muted); text-align: center;">
        No playlists
      </div>
    `;
    return;
  }

  playlists.forEach(playlist => {
    const link = document.createElement('a');
    link.className = 'menu-link';
    link.style.padding = '8px 12px';
    link.style.fontSize = '0.85rem';
    link.innerHTML = `<i class="fa-solid fa-list-music" style="font-size: 0.9rem;"></i> <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${playlist.name}</span>`;
    
    link.addEventListener('click', () => {
      navigateToView('playlist-detail', { playlistId: playlist.id });
    });
    
    DOM.sidebarPlaylists.appendChild(link);
  });
}

// --- 5. Playlist Detail View ---
async function loadPlaylistDetail(id) {
  const playlist = await db.getPlaylist(id);
  if (!playlist) {
    showToast('Playlist not found', 'error');
    navigateToView('playlists');
    return;
  }

  DOM.playlistDetailContent.innerHTML = `
    <div class="playlist-header">
      <img class="playlist-header-img" src="${playlist.coverUrl || ''}" alt="${playlist.name}">
      <div class="playlist-header-info">
        <span class="playlist-header-type">PLAYLIST</span>
        <h1 class="playlist-header-name">${playlist.name}</h1>
        <p class="playlist-header-desc">${playlist.description || 'Custom playlist.'}</p>
        <div class="playlist-header-meta">
          <span>Created on AuraStream</span>
          <span>${playlist.tracks.length} tracks</span>
        </div>
      </div>
    </div>

    <div class="playlist-controls-row">
      <button class="playlist-play-btn" id="playlist-detail-play" ${playlist.tracks.length === 0 ? 'disabled' : ''}>
        <i class="fa-solid fa-play"></i>
      </button>
      <button class="playlist-delete-btn" id="playlist-detail-delete"><i class="fa-solid fa-trash-can"></i> Delete Playlist</button>
    </div>

    <div class="tracks-list-container" id="playlist-detail-list">
      <!-- Tracks -->
    </div>
  `;

  const playBtn = DOM.playlistDetailContent.querySelector('#playlist-detail-play');
  playBtn.addEventListener('click', () => {
    if (playlist.tracks.length > 0) {
      playTrack(playlist.tracks[0], playlist.tracks);
    }
  });

  const deleteBtn = DOM.playlistDetailContent.querySelector('#playlist-detail-delete');
  deleteBtn.addEventListener('click', async () => {
    if (confirm(`Delete playlist "${playlist.name}"?`)) {
      await db.deletePlaylist(id);
      showToast('Playlist deleted.', 'success');
      loadSidebarPlaylists();
      navigateToView('playlists');
    }
  });

  const tracksListContainer = DOM.playlistDetailContent.querySelector('#playlist-detail-list');
  if (playlist.tracks.length === 0) {
    tracksListContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-folder-open"></i></div>
        <div class="empty-state-text">Playlist is empty</div>
        <div class="empty-state-subtext">Add songs from search or discover menus.</div>
      </div>
    `;
    return;
  }

  playlist.tracks.forEach((track, i) => {
    const row = document.createElement('div');
    row.className = 'track-row';
    row.setAttribute('data-id', track.id);
    if (state.currentTrack && state.currentTrack.id === track.id) {
      row.classList.add('active');
    }

    row.innerHTML = `
      <div class="track-index">${i + 1}</div>
      <img class="track-row-img" src="${track.coverUrl || ''}" alt="${track.title}">
      <div class="track-details-col">
        <span class="track-title">${track.title}</span>
        <span class="track-artist">${track.artist}</span>
      </div>
      <div class="track-album-col">${track.album}</div>
      <div class="track-time-col">${formatTime(track.duration)}</div>
      <div class="track-actions-col">
        <button class="track-action-btn remove-playlist-track-btn" style="color: #ef4444;" title="Remove"><i class="fa-solid fa-circle-minus"></i></button>
      </div>
    `;

    row.addEventListener('click', (e) => {
      if (e.target.closest('.track-action-btn')) return;
      playTrack(track, playlist.tracks);
    });

    row.querySelector('.remove-playlist-track-btn').addEventListener('click', async () => {
      try {
        await db.removeTrackFromPlaylist(playlist.id, track.id);
        showToast('Track removed.', 'success');
        loadPlaylistDetail(playlist.id);
        loadSidebarPlaylists();
      } catch (err) {
        console.error(err);
      }
    });

    tracksListContainer.appendChild(row);
  });
}

// --- 6. Upload View Controller ---
function initUploadFormLogic() {
  const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    DOM.dropzone.addEventListener(eventName, preventDefaults, false);
  });

  DOM.dropzone.addEventListener('dragover', () => {
    DOM.dropzone.classList.add('dragover');
  });

  DOM.dropzone.addEventListener('dragleave', () => {
    DOM.dropzone.classList.remove('dragover');
  });

  DOM.dropzone.addEventListener('drop', (e) => {
    DOM.dropzone.classList.remove('dragover');
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      processAudioFile(files[0]);
    }
  });

  DOM.browseFilesBtn.addEventListener('click', () => {
    DOM.audioFileInput.click();
  });

  DOM.audioFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      processAudioFile(e.target.files[0]);
    }
  });

  DOM.browseCoverBtn.addEventListener('click', () => {
    DOM.uploadCoverInput.click();
  });

  DOM.uploadCoverInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      DOM.coverPreviewFilename.textContent = `Selected: ${file.name}`;
      DOM.coverPreviewFilename.style.display = 'block';

      const reader = new FileReader();
      reader.onload = (event) => {
        uploadedFileData.coverDataUrl = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  DOM.uploadForm.addEventListener('submit', async () => {
    const title = DOM.uploadTitle.value.trim();
    const artist = DOM.uploadArtist.value.trim();
    const album = DOM.uploadAlbum.value.trim() || 'Single';
    const genre = DOM.uploadGenre.value.trim() || 'Unknown';

    if (!title || !artist || !uploadedFileData.audioBlob) {
      showToast('Please fill all required fields.', 'error');
      return;
    }

    DOM.uploadSubmitBtn.disabled = true;
    DOM.uploadSubmitBtn.textContent = 'Storing file...';

    const newTrack = {
      id: `local_${Date.now()}`,
      title: title,
      artist: artist,
      album: album,
      genre: genre,
      coverUrl: uploadedFileData.coverDataUrl || '',
      duration: uploadedFileData.duration || 0,
      audioBlob: uploadedFileData.audioBlob,
      source: 'local',
      addedAt: Date.now()
    };

    try {
      await db.saveLocalTrack(newTrack);
      showToast('Track saved locally in browser!', 'success');
      
      DOM.uploadForm.reset();
      DOM.uploadTitle.disabled = true;
      DOM.uploadArtist.disabled = true;
      DOM.uploadAlbum.disabled = true;
      DOM.uploadGenre.disabled = true;
      DOM.browseCoverBtn.disabled = true;
      DOM.coverPreviewFilename.style.display = 'none';
      DOM.uploadSubmitBtn.disabled = true;
      DOM.uploadSubmitBtn.textContent = 'Save Track to IndexedDB';
      
      uploadedFileData = { audioBlob: null, duration: 0, coverDataUrl: '' };
      DOM.uploadFeedback.textContent = 'No file selected. Please select or drag a file.';
      
      loadUploadedTracksList();
      loadLocalTracksHome();
    } catch (error) {
      console.error(error);
      showToast('Failed to save file.', 'error');
      DOM.uploadSubmitBtn.disabled = false;
      DOM.uploadSubmitBtn.textContent = 'Save Track to IndexedDB';
    }
  });

  DOM.deleteAllLocalBtn.addEventListener('click', async () => {
    if (confirm('Delete all uploaded tracks?')) {
      try {
        const localTracks = await db.getLocalTracks();
        for (const t of localTracks) {
          await db.deleteLocalTrack(t.id);
        }
        showToast('Library cleared.', 'success');
        loadUploadedTracksList();
        loadLocalTracksHome();
      } catch (err) {
        console.error(err);
      }
    }
  });
}

function processAudioFile(file) {
  const validTypes = ['audio/mp3', 'audio/wav', 'audio/mpeg', 'audio/x-wav'];
  if (!validTypes.includes(file.type) && !file.name.endsWith('.mp3') && !file.name.endsWith('.wav')) {
    showToast('Please upload MP3 or WAV files.', 'error');
    return;
  }

  if (file.size > 50 * 1024 * 1024) {
    showToast('File is too large (max 50MB).', 'error');
    return;
  }

  DOM.uploadFeedback.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Reading file metadata...`;

  uploadedFileData.audioBlob = file;

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const reader = new FileReader();

  reader.onload = function(e) {
    const arrayBuffer = e.target.result;
    audioContext.decodeAudioData(arrayBuffer, function(buffer) {
      uploadedFileData.duration = Math.round(buffer.duration);
      
      let autoTitle = file.name.replace(/\.[^/.]+$/, "");
      let autoArtist = 'Local Artist';
      
      if (autoTitle.includes('-')) {
        const parts = autoTitle.split('-');
        autoArtist = parts[0].trim();
        autoTitle = parts[1].trim();
      }

      DOM.uploadTitle.value = autoTitle;
      DOM.uploadArtist.value = autoArtist;
      DOM.uploadAlbum.value = 'Single';
      DOM.uploadGenre.value = 'Local Upload';

      DOM.uploadTitle.disabled = false;
      DOM.uploadArtist.disabled = false;
      DOM.uploadAlbum.disabled = false;
      DOM.uploadGenre.disabled = false;
      DOM.browseCoverBtn.disabled = false;
      DOM.uploadSubmitBtn.disabled = false;

      DOM.uploadFeedback.innerHTML = `<span style="color: var(--accent);"><i class="fa-solid fa-circle-check"></i> Ready to save: ${file.name}</span>`;
    }, function() {
      DOM.uploadTitle.value = file.name.replace(/\.[^/.]+$/, "");
      DOM.uploadArtist.value = 'Local Artist';
      DOM.uploadTitle.disabled = false;
      DOM.uploadArtist.disabled = false;
      DOM.uploadSubmitBtn.disabled = false;
      DOM.uploadFeedback.innerHTML = `<span style="color: var(--accent);"><i class="fa-solid fa-circle-check"></i> Ready: ${file.name}</span>`;
    });
  };

  reader.readAsArrayBuffer(file);
}

async function loadUploadedTracksList() {
  const localTracks = await db.getLocalTracks();
  DOM.uploadedTracksList.innerHTML = '';

  if (localTracks.length === 0) {
    DOM.uploadedTracksList.innerHTML = `
      <div class="empty-state" style="padding: 30px 0;">
        <div class="empty-state-icon" style="font-size: 2rem;"><i class="fa-solid fa-database"></i></div>
        <div class="empty-state-text">No uploads yet</div>
        <div class="empty-state-subtext">Upload files above to save them.</div>
      </div>
    `;
    return;
  }

  localTracks.forEach((track, i) => {
    const row = document.createElement('div');
    row.className = 'track-row';
    row.setAttribute('data-id', track.id);
    if (state.currentTrack && state.currentTrack.id === track.id) {
      row.classList.add('active');
    }

    row.innerHTML = `
      <div class="track-index">${i + 1}</div>
      <img class="track-row-img" src="${track.coverUrl || ''}" alt="${track.title}">
      <div class="track-details-col">
        <span class="track-title">${track.title}</span>
        <span class="track-artist">${track.artist}</span>
      </div>
      <div class="track-album-col">${track.album}</div>
      <div class="track-time-col">${formatTime(track.duration)}</div>
      <div class="track-actions-col">
        <button class="track-action-btn delete-track-btn" style="color: #ef4444;" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    `;

    row.addEventListener('click', (e) => {
      if (e.target.closest('.track-action-btn')) return;
      playTrack(track, localTracks);
    });

    row.querySelector('.delete-track-btn').addEventListener('click', async () => {
      if (confirm(`Delete "${track.title}"?`)) {
        try {
          await db.deleteLocalTrack(track.id);
          showToast('Track deleted.', 'success');
          loadUploadedTracksList();
          loadLocalTracksHome();
        } catch (err) {
          console.error(err);
        }
      }
    });

    DOM.uploadedTracksList.appendChild(row);
  });
}

// --- Modals Controller System ---
function openCreatePlaylistModal() {
  DOM.modalCreatePlaylist.classList.add('active');
}

function closeCreatePlaylistModal() {
  DOM.modalCreatePlaylist.classList.remove('active');
  DOM.createPlaylistFormSubmit.reset();
}

async function handleCreatePlaylistSubmit() {
  const name = document.getElementById('playlist-name').value.trim();
  const desc = document.getElementById('playlist-desc').value.trim();

  if (!name) return;

  try {
    const playlist = await db.createPlaylist(name, desc);
    showToast(`Playlist "${playlist.name}" created!`, 'success');
    closeCreatePlaylistModal();
    loadPlaylistsGrid();
    loadSidebarPlaylists();
  } catch (error) {
    console.error(error);
    showToast('Failed to create playlist.', 'error');
  }
}

async function openAddToPlaylistModal() {
  if (!playlistTargetTrack) return;
  
  DOM.addPlaylistOptionsContainer.innerHTML = '';
  const playlists = await db.getPlaylists();
  
  if (playlists.length === 0) {
    DOM.addPlaylistOptionsContainer.innerHTML = `
      <div style="padding: 20px; text-align: center; color: var(--text-muted);">
        <p style="margin-bottom: 12px;">No playlists yet.</p>
        <button class="hero-btn" id="modal-goto-create-playlist" style="padding: 6px 12px; font-size: 0.8rem; margin: 0 auto;">
          Create One
        </button>
      </div>
    `;
    
    DOM.addPlaylistOptionsContainer.querySelector('#modal-goto-create-playlist').addEventListener('click', () => {
      closeAddToPlaylistModal();
      openCreatePlaylistModal();
    });
  } else {
    playlists.forEach(playlist => {
      const option = document.createElement('div');
      option.className = 'track-row';
      option.style.gridTemplateColumns = '50px 1fr auto';
      option.style.padding = '8px 12px';
      
      const containsTrack = playlist.tracks.some(t => t.id === playlistTargetTrack.id);
      
      option.innerHTML = `
        <img class="track-row-img" src="${playlist.coverUrl || ''}" alt="${playlist.name}">
        <div class="track-details-col">
          <span class="track-title" style="font-size: 0.9rem;">${playlist.name}</span>
          <span class="track-artist" style="font-size: 0.75rem;">${playlist.tracks.length} songs</span>
        </div>
        <div>
          ${containsTrack 
            ? '<span style="color: var(--accent); font-size: 0.8rem; font-weight:600;"><i class="fa-solid fa-check"></i> Added</span>' 
            : '<button class="modal-btn confirm select-playlist-btn" style="padding: 4px 10px; font-size: 0.75rem;">Add</button>'}
        </div>
      `;

      if (!containsTrack) {
        option.querySelector('.select-playlist-btn').addEventListener('click', async () => {
          try {
            await db.addTrackToPlaylist(playlist.id, playlistTargetTrack);
            showToast(`Added to "${playlist.name}".`, 'success');
            closeAddToPlaylistModal();
            loadSidebarPlaylists();
            if (state.activeView === 'playlist-detail' && state.activePlaylistId === playlist.id) {
              loadPlaylistDetail(playlist.id);
            }
          } catch (err) {
            console.error(err);
          }
        });
      }

      DOM.addPlaylistOptionsContainer.appendChild(option);
    });
  }

  DOM.modalAddToPlaylist.classList.add('active');
}

function closeAddToPlaylistModal() {
  DOM.modalAddToPlaylist.classList.remove('active');
  playlistTargetTrack = null;
}

// --- Player Timeline Navigation ---
function seekAudio(e) {
  if (!state.currentTrack) return;
  
  const rect = DOM.playerTimelineContainer.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const totalWidth = rect.width;
  const percent = Math.min(1, Math.max(0, offsetX / totalWidth));
  
  if (state.activePlayerEngine === 'html5' && state.audio && !isNaN(state.audio.duration)) {
    state.audio.currentTime = percent * state.audio.duration;
  } else if (state.activePlayerEngine === 'youtube' && state.ytPlayerReady) {
    if (typeof state.ytPlayer.getDuration === 'function' && typeof state.ytPlayer.seekTo === 'function') {
      const duration = state.ytPlayer.getDuration();
      state.ytPlayer.seekTo(percent * duration, true);
    }
  } else if (state.activePlayerEngine === 'soundcloud' && state.scWidgetReady && typeof state.scWidget.getDuration === 'function') {
    state.scWidget.getDuration((durationMs) => {
      if (typeof state.scWidget.seekTo === 'function') {
        state.scWidget.seekTo(percent * durationMs);
      }
    });
  }
}

function adjustVolume(e) {
  const rect = DOM.playerVolumeSlider.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const totalWidth = rect.width;
  const percent = Math.min(1, Math.max(0, offsetX / totalWidth));
  
  state.volume = percent;
  state.isMuted = false;
  
  // Sync to active engines
  if (state.audio) state.audio.volume = state.volume;
  if (state.ytPlayerReady && typeof state.ytPlayer.setVolume === 'function') state.ytPlayer.setVolume(state.volume * 100);
  if (state.scWidgetReady && typeof state.scWidget.setVolume === 'function') state.scWidget.setVolume(state.volume * 100);
  
  DOM.playerVolumeBar.style.width = `${percent * 100}%`;
  updateVolumeButtonUI();
}

function toggleMute() {
  if (state.isMuted) {
    state.isMuted = false;
    state.volume = state.lastVolume;
  } else {
    state.isMuted = true;
    state.lastVolume = state.volume;
    state.volume = 0;
  }

  if (state.audio) state.audio.volume = state.volume;
  if (state.ytPlayerReady && typeof state.ytPlayer.setVolume === 'function') state.ytPlayer.setVolume(state.volume * 100);
  if (state.scWidgetReady && typeof state.scWidget.setVolume === 'function') state.scWidget.setVolume(state.volume * 100);
  
  DOM.playerVolumeBar.style.width = `${state.volume * 100}%`;
  updateVolumeButtonUI();
}

function updateVolumeButtonUI() {
  const icon = DOM.playerVolumeBtn.querySelector('i');
  icon.className = 'fa-solid';
  
  if (state.volume === 0 || state.isMuted) {
    icon.classList.add('fa-volume-xmark');
  } else if (state.volume < 0.3) {
    icon.classList.add('fa-volume-off');
  } else if (state.volume < 0.7) {
    icon.classList.add('fa-volume-low');
  } else {
    icon.classList.add('fa-volume-high');
  }
}

// --- Floating Video player Draggable logic ---
function makePlayerDraggable() {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  DOM.videoDragHandle.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    // Only drag on handle, not controls
    if (e.target.closest('.video-control-btn')) return;
    
    e = e || window.event;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    const top = (DOM.floatingVideoPlayer.offsetTop - pos2);
    const left = (DOM.floatingVideoPlayer.offsetLeft - pos1);
    
    DOM.floatingVideoPlayer.style.top = top + "px";
    DOM.floatingVideoPlayer.style.left = left + "px";
    DOM.floatingVideoPlayer.style.bottom = "auto";
    DOM.floatingVideoPlayer.style.right = "auto";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// --- Remix Modes (Speed & Pitch) ---
function applyRemixMode(mode) {
  state.remixMode = mode;
  let rate = 1.0;
  let reverbWet = 0;
  let dryMix = 1;
  let preservesPitch = true;

  if (mode === 'nightcore') {
    rate = 1.25;
    preservesPitch = false;
  } else if (mode === 'slowed') {
    rate = 0.85;
    preservesPitch = false;
    reverbWet = 0.6;
    dryMix = 0.8;
  }

  // Apply to HTML5 Audio
  if (state.audio) {
    state.audio.playbackRate = rate;
    state.audio.preservesPitch = preservesPitch;
    if (state.audio.webkitPreservesPitch !== undefined) state.audio.webkitPreservesPitch = preservesPitch;
    if (state.audio.mozPreservesPitch !== undefined) state.audio.mozPreservesPitch = preservesPitch;
  }

  // Apply to YouTube
  if (state.ytPlayerReady && state.ytPlayer.setPlaybackRate) {
    state.ytPlayer.setPlaybackRate(rate);
  }

  // Apply to Reverb (Web Audio API)
  if (state.reverbGainNode && state.dryGainNode) {
    state.reverbGainNode.gain.setTargetAtTime(reverbWet, state.audioContext.currentTime, 0.1);
    state.dryGainNode.gain.setTargetAtTime(dryMix, state.audioContext.currentTime, 0.1);
  }
}

// --- Event Bindings & Bootstrap ---
function bindEvents() {
  // Media Session API Actions
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => resumeTrack());
    navigator.mediaSession.setActionHandler('pause', () => pauseTrack());
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
  }

  DOM.menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.getAttribute('data-view');
      if (view) navigateToView(view);
    });
  });

  // Remix Mode bindings
  if (DOM.remixRadios) {
    DOM.remixRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        applyRemixMode(e.target.value);
      });
    });
  }

  // Mobile Swipe Gestures on Player Bar
  let touchStartX = 0;
  const playerBar = document.querySelector('.player-bar');
  if (playerBar) {
    playerBar.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    playerBar.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      const deltaX = touchEndX - touchStartX;

      if (deltaX < -50) {
        // Swipe Left -> Next Track
        nextTrack();
      } else if (deltaX > 50) {
        // Swipe Right -> Prev Track
        prevTrack();
      }
    }, { passive: true });
  }

  DOM.globalSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      executeGlobalSearch(DOM.globalSearch.value.trim());
    }
  });

  DOM.globalSearch.addEventListener('input', (e) => {
    if (e.target.value.trim() === '' && state.activeView === 'search') {
      navigateToView('home');
    }
  });

  // Voice Command implementation
  if (DOM.voiceSearchBtn) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID'; // support indonesian / local
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      DOM.voiceSearchBtn.addEventListener('click', () => {
        showToast('Listening...', 'info');
        DOM.voiceSearchBtn.style.color = 'var(--primary)';
        recognition.start();
      });

      recognition.addEventListener('result', (e) => {
        const transcript = e.results[0][0].transcript;
        DOM.globalSearch.value = transcript;
        showToast(`Heard: "${transcript}"`, 'success');
        DOM.voiceSearchBtn.style.color = '';
        executeGlobalSearch(transcript);
      });

      recognition.addEventListener('end', () => {
        DOM.voiceSearchBtn.style.color = '';
      });

      recognition.addEventListener('error', (e) => {
        showToast(`Voice error: ${e.error}`, 'error');
        DOM.voiceSearchBtn.style.color = '';
      });
    } else {
      DOM.voiceSearchBtn.style.display = 'none';
    }
  }

  DOM.filterAll.addEventListener('click', () => {
    state.searchSourceFilter = 'all';
    updateSearchFilterButtons();
    executeGlobalSearch(currentSearchQuery);
  });
  
  DOM.filterLocal.addEventListener('click', () => {
    state.searchSourceFilter = 'local';
    updateSearchFilterButtons();
    executeGlobalSearch(currentSearchQuery);
  });
  
  DOM.filterAudius.addEventListener('click', () => {
    state.searchSourceFilter = 'audius';
    updateSearchFilterButtons();
    executeGlobalSearch(currentSearchQuery);
  });
  
  DOM.filterItunes.addEventListener('click', () => {
    state.searchSourceFilter = 'itunes';
    updateSearchFilterButtons();
    executeGlobalSearch(currentSearchQuery);
  });

  DOM.filterYoutube.addEventListener('click', () => {
    state.searchSourceFilter = 'youtube';
    updateSearchFilterButtons();
    executeGlobalSearch(currentSearchQuery);
  });

  DOM.trendingRefreshBtn.addEventListener('click', () => {
    fetchTrendingTracks();
  });

  DOM.heroPlayBtn.addEventListener('click', () => {
    const trendingCards = Array.from(DOM.trendingGrid.querySelectorAll('.music-card'));
    if (trendingCards.length > 0) {
      trendingCards[0].click();
    } else {
      fetchTrendingTracks().then(() => {
        const fresh = Array.from(DOM.trendingGrid.querySelectorAll('.music-card'));
        if (fresh.length > 0) fresh[0].click();
      });
    }
  });

  DOM.homeGotoUploadBtn.addEventListener('click', () => {
    navigateToView('upload');
  });

  DOM.playAllFavsBtn.addEventListener('click', async () => {
    const favorites = await db.getFavorites();
    if (favorites.length > 0) {
      playTrack(favorites[0], favorites);
    }
  });

  DOM.playerPlayBtn.addEventListener('click', () => {
    if (state.isPlaying) {
      pauseTrack();
    } else {
      resumeTrack();
    }
  });

  DOM.playerNextBtn.addEventListener('click', () => nextTrack());
  DOM.playerPrevBtn.addEventListener('click', () => prevTrack());
  
  DOM.playerShuffleBtn.addEventListener('click', () => {
    state.isShuffle = !state.isShuffle;
    updatePlaybackControlsUI();
    showToast(state.isShuffle ? 'Queue shuffled.' : 'Normal play order.', 'info');
  });

  DOM.playerRepeatBtn.addEventListener('click', () => {
    if (state.repeatMode === 'none') {
      state.repeatMode = 'all';
    } else if (state.repeatMode === 'all') {
      state.repeatMode = 'one';
    } else {
      state.repeatMode = 'none';
    }
    updatePlaybackControlsUI();
  });

  DOM.playerFavBtn.addEventListener('click', async () => {
    if (!state.currentTrack) return;
    try {
      const isFav = await db.toggleFavorite(state.currentTrack);
      updatePlayerBarUI();
      showToast(isFav ? 'Added to favorites.' : 'Removed from favorites.', 'success');
      if (state.activeView === 'favorites') {
        loadFavoritesList();
      }
    } catch (err) {
      console.error(err);
    }
  });

  let isSeeking = false;
  DOM.playerTimelineContainer.addEventListener('mousedown', (e) => {
    isSeeking = true;
    seekAudio(e);
  });

  window.addEventListener('mousemove', (e) => {
    if (isSeeking) seekAudio(e);
  });

  window.addEventListener('mouseup', () => {
    isSeeking = false;
  });

  let isVolumeDragging = false;
  DOM.playerVolumeSlider.addEventListener('mousedown', (e) => {
    isVolumeDragging = true;
    adjustVolume(e);
  });

  window.addEventListener('mousemove', (e) => {
    if (isVolumeDragging) adjustVolume(e);
  });

  window.addEventListener('mouseup', () => {
    isVolumeDragging = false;
  });

  DOM.playerVolumeBtn.addEventListener('click', () => toggleMute());

  const handleVisToggle = () => {
    if (state.activeView === 'visualizer') {
      navigateToView('home');
      stopVisualizerCanvas();
    } else {
      navigateToView('visualizer');
    }
  };
  DOM.playerToggleVisBtn.addEventListener('click', handleVisToggle);
  DOM.headerVisualizerBtn.addEventListener('click', handleVisToggle);

  DOM.playerQueueBtn.addEventListener('click', () => {
    showToast('Play queue matches playlist order.', 'info');
  });

  DOM.toggleVisStyleBtn.addEventListener('click', () => {
    state.visualizerStyle = (state.visualizerStyle + 1) % 3;
    const styles = ['Cyber Purple', 'Emerald Forest', 'Pink Neon'];
    showToast(`Visualizer toggled: ${styles[state.visualizerStyle]}`, 'success');
  });

  // Floating Player Close / Minimize
  DOM.videoCloseBtn.addEventListener('click', () => {
    DOM.floatingVideoPlayer.classList.remove('active');
    pauseTrack();
  });

  DOM.videoMinimizeBtn.addEventListener('click', () => {
    DOM.floatingVideoPlayer.classList.toggle('minimized');
    const isMin = DOM.floatingVideoPlayer.classList.contains('minimized');
    DOM.videoMinimizeBtn.innerHTML = isMin ? '<i class="fa-solid fa-window-restore"></i>' : '<i class="fa-solid fa-minus"></i>';
  });

  makePlayerDraggable();

  // Playlist Modals
  DOM.createPlaylistBtn.addEventListener('click', () => openCreatePlaylistModal());
  DOM.modalCreatePlaylistClose.addEventListener('click', () => closeCreatePlaylistModal());
  DOM.modalCreatePlaylistCancel.addEventListener('click', () => closeCreatePlaylistModal());
  DOM.createPlaylistFormSubmit.addEventListener('submit', () => handleCreatePlaylistSubmit());
  
  DOM.modalAddToPlaylistClose.addEventListener('click', () => closeAddToPlaylistModal());
  DOM.modalAddToPlaylistCancel.addEventListener('click', () => closeAddToPlaylistModal());

  initUploadFormLogic();

  // ── Mobile Sidebar Hamburger ──────────────────────────────
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const sidebar      = document.getElementById('sidebar');
  const backdrop     = document.getElementById('sidebar-backdrop');

  function openMobileSidebar()  { sidebar?.classList.add('open');    backdrop?.classList.add('active'); }
  function closeMobileSidebar() { sidebar?.classList.remove('open'); backdrop?.classList.remove('active'); }

  hamburgerBtn?.addEventListener('click', openMobileSidebar);
  backdrop?.addEventListener('click', closeMobileSidebar);
  document.querySelectorAll('.menu-item').forEach(item =>
    item.addEventListener('click', () => { if (window.innerWidth <= 768) closeMobileSidebar(); })
  );

  // ── About / Info Modal ────────────────────────────────────
  const modalAbout      = document.getElementById('modal-about');
  const modalAboutClose = document.getElementById('modal-about-close');
  const modalAboutOk    = document.getElementById('modal-about-ok');

  function openAboutModal()  { modalAbout?.classList.add('active'); }
  function closeAboutModal() { modalAbout?.classList.remove('active'); }

  document.getElementById('about-btn')?.addEventListener('click', openAboutModal);
  modalAboutClose?.addEventListener('click', closeAboutModal);
  modalAboutOk?.addEventListener('click',    closeAboutModal);
  modalAbout?.addEventListener('click', e => { if (e.target === modalAbout) closeAboutModal(); });

  // ── Keyboard Shortcuts Modal ──────────────────────────────
  const modalShortcuts      = document.getElementById('modal-shortcuts');
  const modalShortcutsClose = document.getElementById('modal-shortcuts-close');

  function openShortcutsModal()  { modalShortcuts?.classList.add('active'); }
  function closeShortcutsModal() { modalShortcuts?.classList.remove('active'); }

  modalShortcutsClose?.addEventListener('click', closeShortcutsModal);
  modalShortcuts?.addEventListener('click', e => { if (e.target === modalShortcuts) closeShortcutsModal(); });

  // Modals: Lyrics, EQ, Settings
  // Lyrics
  DOM.playerLyricsBtn?.addEventListener('click', async () => {
    if (!state.currentTrack) return;
    DOM.modalLyrics.classList.add('active');
    DOM.lyricsContent.innerHTML = '<div style="text-align: center; margin-top: 20px;"><i class="fa-solid fa-circle-notch fa-spin"></i><p style="margin-top: 10px;">Finding Best Lyrics...</p></div>';
    
    state.currentLyrics = [];
    state.lastLyricIndex = -1;

    // Try synced lyrics from LRCLIB first
    let lyricsData = await api.fetchSyncedLyrics(state.currentTrack.artist, state.currentTrack.title);
    
    if (lyricsData) {
      if (lyricsData.synced) {
        state.currentLyrics = parseLRC(lyricsData.text);
        
        // Render interactive UI
        DOM.lyricsContent.innerHTML = '';
        state.currentLyrics.forEach((lyric, idx) => {
          const span = document.createElement('span');
          span.className = 'lyric-line';
          span.textContent = lyric.text;
          span.addEventListener('click', () => {
            // Seek to this lyric time
            if (state.activePlayerEngine === 'html5' && state.audio) {
              state.audio.currentTime = lyric.time;
            } else if (state.activePlayerEngine === 'youtube' && state.ytPlayerReady && state.ytPlayer.seekTo) {
               state.ytPlayer.seekTo(lyric.time, true);
            }
          });
          DOM.lyricsContent.appendChild(span);
        });
      } else {
        // Render plain text nicely formatted
        DOM.lyricsContent.innerHTML = `<div style="white-space: pre-wrap; font-size: 1.1rem; line-height: 1.8; text-align: center; opacity: 0.8;">${lyricsData.text}</div>`;
      }
    } else {
      // Fallback to legacy lyrics.ovh
      const lyrics = await api.fetchLyrics(state.currentTrack.artist, state.currentTrack.title);
      if (lyrics) {
        DOM.lyricsContent.innerHTML = `<div style="white-space: pre-wrap; font-size: 1.1rem; line-height: 1.8; text-align: center; opacity: 0.8;">${lyrics}</div>`;
      } else {
        DOM.lyricsContent.innerHTML = '<div style="text-align: center;"><p style="color: var(--text-muted);">Lyrics not found for this track.</p><i class="fa-solid fa-music" style="font-size: 3rem; color: var(--border-glass); margin-top: 40px;"></i></div>';
      }
    }
  });
  DOM.modalLyricsClose?.addEventListener('click', () => DOM.modalLyrics.classList.remove('active'));
  DOM.modalLyrics?.addEventListener('click', e => { if (e.target === DOM.modalLyrics) DOM.modalLyrics.classList.remove('active'); });

  // EQ
  DOM.playerEqBtn?.addEventListener('click', () => {
    DOM.modalEq.classList.add('active');
  });
  DOM.modalEqClose?.addEventListener('click', () => DOM.modalEq.classList.remove('active'));
  DOM.modalEq?.addEventListener('click', e => { if (e.target === DOM.modalEq) DOM.modalEq.classList.remove('active'); });
  
  DOM.eqBass?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    DOM.eqBassVal.textContent = `${val > 0 ? '+' : ''}${val} dB`;
    if (state.eqBassNode) state.eqBassNode.gain.value = val;
  });
  DOM.eqTreble?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    DOM.eqTrebleVal.textContent = `${val > 0 ? '+' : ''}${val} dB`;
    if (state.eqTrebleNode) state.eqTrebleNode.gain.value = val;
  });
  DOM.eqSpatialToggle?.addEventListener('change', (e) => {
    state.spatialEnabled = e.target.checked;
    if (!state.spatialEnabled && state.pannerNode) {
      state.pannerNode.positionX.value = 0;
      state.pannerNode.positionY.value = 0;
      state.pannerNode.positionZ.value = 0;
    }
  });
  DOM.eqResetBtn?.addEventListener('click', () => {
    DOM.eqBass.value = 0;
    DOM.eqTreble.value = 0;
    DOM.eqBassVal.textContent = '0 dB';
    DOM.eqTrebleVal.textContent = '0 dB';
    if (state.eqBassNode) state.eqBassNode.gain.value = 0;
    if (state.eqTrebleNode) state.eqTrebleNode.gain.value = 0;
    if (DOM.eqSpatialToggle) {
      DOM.eqSpatialToggle.checked = false;
      state.spatialEnabled = false;
      if (state.pannerNode) {
        state.pannerNode.positionX.value = 0;
        state.pannerNode.positionY.value = 0;
        state.pannerNode.positionZ.value = 0;
      }
    }
  });

  // Settings / Backup & Restore
  DOM.sidebarSettingsBtn?.addEventListener('click', async () => {
    DOM.settingsFullsongToggle.checked = state.forceFullSongs;
    const currentBackend = await db.getSetting('backendUrl');
    if (currentBackend) {
      DOM.settingsBackendUrl.value = currentBackend;
      window.AURA_BACKEND_URL = currentBackend;
    }
    DOM.modalSettings.classList.add('active');
    if (window.innerWidth <= 768) closeMobileSidebar();
  });
  
  DOM.settingsFullsongToggle.addEventListener('change', (e) => {
    state.forceFullSongs = e.target.checked;
    showToast(state.forceFullSongs ? 'Full songs enabled (YouTube lookup)' : 'Instant 30s previews enabled', 'info');
  });

  DOM.settingsBackendSave?.addEventListener('click', async () => {
    const url = DOM.settingsBackendUrl.value.trim();
    if (url) {
      // Basic validation
      if (!url.startsWith('http')) {
        showToast('URL must start with http:// or https://', 'error');
        return;
      }
      await db.saveSetting('backendUrl', url);
      window.AURA_BACKEND_URL = url;
      showToast('Backend URL saved', 'success');
    } else {
      await db.saveSetting('backendUrl', null);
      window.AURA_BACKEND_URL = null;
      showToast('Backend URL reset to auto-detect', 'info');
    }
  });

  DOM.sidebarLoginBtn?.addEventListener('click', async () => {
    if (db.currentUser) {
      DOM.profileNameText.textContent = db.currentUser.name || 'User';
      DOM.profileEmailText.textContent = db.currentUser.email || 'No email';
      DOM.modalProfile.classList.add('active');
    } else {
      DOM.modalLogin.classList.add('active');
    }
    if (window.innerWidth <= 768) closeMobileSidebar();
  });
  
  // Login Modal Handlers
  DOM.modalLoginClose?.addEventListener('click', () => DOM.modalLogin.classList.remove('active'));
  DOM.modalLogin?.addEventListener('click', e => { if (e.target === DOM.modalLogin) DOM.modalLogin.classList.remove('active'); });

  // Profile Modal Handlers
  DOM.modalProfileClose?.addEventListener('click', () => DOM.modalProfile.classList.remove('active'));
  DOM.modalProfile?.addEventListener('click', e => { if (e.target === DOM.modalProfile) DOM.modalProfile.classList.remove('active'); });

  DOM.profileLogoutBtn?.addEventListener('click', async () => {
    await db.logout();
    DOM.modalProfile.classList.remove('active');
    showToast('Logged out successfully.', 'info');
  });

  DOM.profileEditBtn?.addEventListener('click', async () => {
    const newName = prompt('Enter your new display name:', db.currentUser?.name || '');
    if (newName && newName.trim() !== '') {
      db.currentUser.name = newName.trim();
      await db.saveSetting('currentUser', db.currentUser);
      DOM.profileNameText.textContent = db.currentUser.name;
      showToast('Profile name updated!', 'success');
      await db.syncToCloud();
    }
  });

  DOM.profileSyncBtn?.addEventListener('click', async () => {
    showToast('Initiating Cloud Sync...', 'info');
    await db.syncToCloud();
    showToast('Data Synced with Cloud!', 'success');
  });

  DOM.loginSubmitBtn?.addEventListener('click', async () => {
    const email = DOM.loginEmailInput.value.trim();
    const pwd = DOM.loginPasswordInput.value;
    if (!email || pwd.length < 6) {
      showToast('Email & password (min 6 chars) required.', 'error');
      return;
    }
    showToast('Authenticating...', 'info');
    try {
      await db.login(email, pwd);
      DOM.modalLogin.classList.remove('active');
      showToast(`Welcome back, ${db.currentUser.name}!`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  DOM.registerSubmitBtn?.addEventListener('click', async () => {
    const email = DOM.loginEmailInput.value.trim();
    const pwd = DOM.loginPasswordInput.value;
    if (!email || pwd.length < 6) {
      showToast('Email & password (min 6 chars) required.', 'error');
      return;
    }
    showToast('Creating account...', 'info');
    try {
      await db.register(email, pwd);
      DOM.modalLogin.classList.remove('active');
      showToast(`Welcome, ${db.currentUser.name}! Account created.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
  DOM.modalSettingsClose?.addEventListener('click', () => DOM.modalSettings.classList.remove('active'));
  DOM.modalSettings?.addEventListener('click', e => { if (e.target === DOM.modalSettings) DOM.modalSettings.classList.remove('active'); });
  
  DOM.settingsExportBtn?.addEventListener('click', async () => {
    try {
      const jsonStr = await db.exportData();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aurastream_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Data exported successfully!', 'success');
    } catch (e) {
      showToast('Export failed.', 'error');
    }
  });

  DOM.settingsImportBtn?.addEventListener('click', () => {
    DOM.settingsImportFile.click();
  });

  DOM.settingsImportFile?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        await db.importData(event.target.result);
        showToast('Data imported successfully! Reloading...', 'success');
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        showToast('Invalid backup file.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset
  });

  // ── Global Keyboard Shortcuts ─────────────────────────────
  document.addEventListener('keydown', e => {
    const tag = document.activeElement.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        state.isPlaying ? pauseTrack() : (state.currentTrack && resumeTrack());
        break;
      case 'ArrowRight': e.preventDefault(); playNextTrack(); break;
      case 'ArrowLeft':  e.preventDefault(); playPrevTrack(); break;
      case 'm': case 'M': DOM.playerVolumeBtn.click(); break;
      case 'f': case 'F': if (state.currentTrack) DOM.playerFavBtn.click(); break;
      case 'v': case 'V': navigateToView('visualizer'); break;
      case 's': case 'S': DOM.playerShuffleBtn.click(); break;
      case 'r': case 'R': DOM.playerRepeatBtn.click(); break;
      case '?': openShortcutsModal(); break;
      case 'Escape':
        closeAboutModal();
        closeShortcutsModal();
        closeMobileSidebar();
        DOM.modalLyrics?.classList.remove('active');
        DOM.modalEq?.classList.remove('active');
        DOM.modalSettings?.classList.remove('active');
        break;
    }
  });

  // Party Room (Listen Together via Firebase Realtime Database)
  let partyRoomRef = null;
  let partyRoomId = null;

  DOM.partyRoomBtn?.addEventListener('click', () => {
    if (partyRoomRef) {
      showToast('You are already in a Party Room.', 'warning');
      return;
    }
    
    if (typeof firebase === 'undefined' || typeof firebase.database === 'undefined') {
      showToast('Firebase SDK is missing or not configured.', 'error');
      return;
    }

    showToast('Connecting to Cloud...', 'info');
    
    // Check URL to see if we are joining or hosting
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');

    try {
      const db = firebase.database();
      
      if (roomParam) {
        // Join Room
        partyRoomId = roomParam;
        partyRoomRef = db.ref('partyRooms/' + partyRoomId);
        
        showToast(`Joined Party Room: ${partyRoomId}`, 'success');
        DOM.partyRoomBtn.style.color = '#10b981'; // Green
        DOM.partyRoomBtn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Connected';
        
        // Listen for host playback changes
        partyRoomRef.on('value', (snapshot) => {
          const data = snapshot.val();
          if (data) handlePartyRoomData(data);
        });

        // Notify we joined (optional, just writing a timestamp to 'lastActivity')
        partyRoomRef.update({ joinerActivity: Date.now() });
        
      } else {
        // Host Room
        partyRoomId = 'aura-' + Math.random().toString(36).substring(2, 8);
        partyRoomRef = db.ref('partyRooms/' + partyRoomId);
        
        partyRoomRef.set({
          createdAt: Date.now(),
          hostActive: true
        });

        // Clean up when disconnect
        partyRoomRef.onDisconnect().remove();

        const shareUrl = `${window.location.origin}${window.location.pathname}?room=${partyRoomId}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
          showToast('Party Room created! Link copied to clipboard.', 'success');
          DOM.partyRoomBtn.style.color = '#10b981';
          DOM.partyRoomBtn.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> Hosting`;
        }).catch(() => {
          showToast(`Room ID: ${partyRoomId} (copy to URL ?room=${partyRoomId})`, 'success');
        });

        // Listen for joiner activity
        partyRoomRef.child('joinerActivity').on('value', (snap) => {
          if (snap.val()) {
            showToast('A friend joined your party!', 'success');
            sendSyncData();
          }
        });
      }
    } catch (err) {
      console.error(err);
      showToast(`Database error. Make sure Firebase is configured.`, 'error');
      partyRoomRef = null;
    }
  });

  function handlePartyRoomData(data) {
    if (data.track) {
      if (!state.currentTrack || state.currentTrack.id !== data.track.id) {
        showToast(`Host playing: ${data.track.title}`, 'info');
        playTrack(data.track);
      } else {
        // If time diff is > 2s, sync
        if (state.activePlayerEngine === 'html5' && state.audio && Math.abs(state.audio.currentTime - data.time) > 2) {
           state.audio.currentTime = data.time;
        }
      }
      if (data.isPlaying && !state.isPlaying) resumeTrack();
      if (!data.isPlaying && state.isPlaying) pauseTrack();
    }
  }

  function sendSyncData() {
    if (partyRoomRef && partyRoomId && !urlParamsHasRoom()) {
      partyRoomRef.update({
        track: state.currentTrack,
        time: state.audio ? state.audio.currentTime : 0,
        isPlaying: state.isPlaying,
        updatedAt: Date.now()
      });
    }
  }

  // Periodic sync for host
  setInterval(() => {
    if (partyRoomRef && partyRoomId && !urlParamsHasRoom()) { 
      sendSyncData();
    }
  }, 3000);

  function urlParamsHasRoom() {
    return new URLSearchParams(window.location.search).get('room');
  }

  // --- Offline Handling ---
  window.addEventListener('offline', () => {
    showToast('You are offline. Some features are disabled.', 'error');
    DOM.globalSearch.disabled = true;
    document.documentElement.style.setProperty('--primary', '#9ca3af'); // Gray out theme slightly
  });

  window.addEventListener('online', () => {
    showToast('Back online! Syncing...', 'success');
    DOM.globalSearch.disabled = false;
    document.documentElement.style.setProperty('--primary', '#10b981'); // Restore theme
    db.syncToCloud();
  });

  // Initial check
  if (!navigator.onLine) {
    DOM.globalSearch.disabled = true;
  }
}


async function bootstrap() {
  console.log('Bootstrapping AuraStream multi-API application...');
  initAudioEngine();
  bindEvents();
  
  window.addEventListener('aurastream:cloud-synced', () => {
    loadSidebarPlaylists();
    if (state.activeView === 'favorites') loadFavoritesList();
    if (state.activeView === 'playlists') loadPlaylistsGrid();
    showToast('Data Synced with Cloud!', 'success');
  });

  try {
    await db.init();
    
    // Load backend configuration
    const savedBackend = await db.getSetting('backendUrl');
    if (savedBackend) {
      window.AURA_BACKEND_URL = savedBackend;
    }

    loadLocalTracksHome();
    loadSidebarPlaylists();
    fetchTrendingTracks();
  } catch (error) {
    console.error('Database failure:', error);
    showToast('Failed to open database storage.', 'error');
  }
}

bootstrap();
