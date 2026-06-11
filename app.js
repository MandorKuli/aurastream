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

  // Web Audio Visualizer variables
  audioContext: null,
  analyser: null,
  sourceNode: null,
  visualizerActive: false,
  visualizerStyle: 0, // Palettes: 0: Purple/Indigo, 1: Cyan/Emerald, 2: Magenta/Pink
  animationFrameId: null
};

// --- DOM Cache ---
const DOM = {
  // Navigation
  menuItems: document.querySelectorAll('.menu-item'),
  views: document.querySelectorAll('.content-view'),
  sidebarPlaylists: document.getElementById('sidebar-playlists-list'),
  
  // Search
  globalSearch: document.getElementById('global-search-input'),
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
      console.warn('Audio playback error:', e);
      
      // Try secondary proxy stream if Invidious host fails
      if (state.currentTrack && (state.currentTrack.source === 'youtube' || state.currentTrack.source === 'itunes')) {
        showToast('Playback issue. Retrying with another stream host...', 'warning');
        
        // Reset cached host and pick a different one
        invidiousHost = null;
        const usedHosts = state._usedInvidiousHosts || new Set();
        usedHosts.add(invidiousHost);
        state._usedInvidiousHosts = usedHosts;
        
        // Pick another host not yet tried
        const nextHost = fallbackInvidiousHosts.find(h => !usedHosts.has(h));
        if (nextHost) {
          invidiousHost = nextHost;
        } else {
          invidiousHost = fallbackInvidiousHosts[Math.floor(Math.random() * fallbackInvidiousHosts.length)];
          state._usedInvidiousHosts = new Set(); // Reset tracking
        }
        
        try {
          let videoId;
          if (state.currentTrack.source === 'youtube') {
            videoId = state.currentTrack.streamUrl;
          } else {
            // For iTunes, try to get video ID again
            videoId = await resolveYouTubeVideoId(state.currentTrack.artist, state.currentTrack.title);
          }
            
          if (videoId) {
            const streamUrl = `${invidiousHost}/latest_version?id=${videoId}&itag=140&local=true`;
            state.audio.src = streamUrl;
            state.audio.load();
            state.audio.play().catch(err => console.error(err));
            return; // Exit error handler since we retried
          }
        } catch (err) {
          console.error('Secondary proxy resolution failed:', err);
        }
        
        // If all Invidious hosts fail and it's iTunes, fall back to 30s preview
        if (state.currentTrack.source === 'itunes' && state.currentTrack.streamUrl) {
          showToast('Streaming failed. Playing 30-sec preview.', 'warning');
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

    if (state.activePlayerEngine === 'html5') {
      if (state.audio && !isNaN(state.audio.duration)) {
        const current = state.audio.currentTime;
        const duration = state.audio.duration;
        const percent = (current / duration) * 100;
        DOM.playerTimelineBar.style.width = `${percent}%`;
        DOM.playerTimeCurrent.textContent = formatTime(current);
        DOM.playerTimeDuration.textContent = formatTime(duration);
      }
    } else if (state.activePlayerEngine === 'youtube' && state.ytPlayerReady) {
      try {
        const current = state.ytPlayer.getCurrentTime();
        const duration = state.ytPlayer.getDuration();
        if (duration > 0) {
          const percent = (current / duration) * 100;
          DOM.playerTimelineBar.style.width = `${percent}%`;
          DOM.playerTimeCurrent.textContent = formatTime(current);
          DOM.playerTimeDuration.textContent = formatTime(duration);
        }
      } catch (err) {
        // ignore iframe access warning
      }
    } else if (state.activePlayerEngine === 'soundcloud' && state.scWidgetReady) {
      state.scWidget.getPosition((ms) => {
        state.scWidget.getDuration((durationMs) => {
          const current = ms / 1000;
          const duration = durationMs / 1000;
          if (duration > 0) {
            const percent = (current / duration) * 100;
            DOM.playerTimelineBar.style.width = `${percent}%`;
            DOM.playerTimeCurrent.textContent = formatTime(current);
            DOM.playerTimeDuration.textContent = formatTime(duration);
          }
        });
      });
    }
  }, 250);
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
  const host = await resolveInvidiousHost();
  return `${host}/latest_version?id=${videoId}&itag=140&local=true`;
}

async function playTrack(track, contextQueue = null) {
  try {
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

    // 2. iTunes Full Playback Bypass via Invidious Audio Stream
    // We resolve a YouTube video ID, then stream audio directly via Invidious
    // This does NOT require the YouTube IFrame API to be ready.
    if (track.source === 'itunes') {
      state.activePlayerEngine = 'html5';
      DOM.floatingVideoPlayer.classList.remove('active');
      
      // Stop other engines immediately
      state.audio.pause();
      stopYouTubeVideo();
      if (state.scWidgetReady) state.scWidget.pause();

      state.currentTrack = track;
      showToast(`Finding full track for "${track.title}"...`, 'info');
      
      try {
        const videoId = await resolveYouTubeVideoId(track.artist, track.title);
        
        if (videoId) {
          // Try Invidious audio stream first, fall back to YouTube iframe
          const host = await resolveInvidiousHost();
          const streamUrl = `${host}/latest_version?id=${videoId}&itag=140&local=true`;
          
          state.audio.src = streamUrl;
          state.audio.load();
          
          // Set timeout: if audio doesn't play within 5s, switch to YouTube iframe
          let streamTimeout = setTimeout(() => {
            if (state.currentTrack && state.currentTrack.id === track.id && 
                (state.audio.paused || state.audio.readyState < 2)) {
              console.warn('Invidious stream timeout, switching to YouTube iframe');
              state.audio.src = '';
              state.activePlayerEngine = 'youtube';
              DOM.floatingVideoPlayer.classList.add('active');
              playYouTubeVideo(videoId);
              showToast('Streaming via YouTube Music', 'success');
            }
          }, 5000);
          
          state.audio.play().then(() => {
            clearTimeout(streamTimeout);
            showToast('Streaming full song', 'success');
          }).catch(e => {
            clearTimeout(streamTimeout);
            console.warn('Invidious stream failed, falling back to YouTube iframe:', e);
            state.audio.src = '';
            state.activePlayerEngine = 'youtube';
            DOM.floatingVideoPlayer.classList.add('active');
            playYouTubeVideo(videoId);
            showToast('Streaming via YouTube Music', 'success');
          });
          state.audio.volume = state.volume;
          initWebAudioContext();
        } else {
          // Could not find video ID — play 30s iTunes preview
          showToast('Could not find full track. Playing 30-sec preview.', 'warning');
          state.audio.src = track.streamUrl;
          state.audio.load();
          state.audio.play().catch(e => console.warn(e));
          state.audio.volume = state.volume;
          initWebAudioContext();
        }
      } catch (err) {
        console.error('iTunes full playback resolution failed:', err);
        showToast('Playback error. Playing 30-sec preview.', 'warning');
        state.audio.src = track.streamUrl;
        state.audio.load();
        state.audio.play().catch(e => console.warn(e));
        state.audio.volume = state.volume;
        initWebAudioContext();
      }

      state.isPlaying = true;
      updatePlayerBarUI();
      updatePlaybackControlsUI();
      return;
    }

    state.currentTrack = track;

    // 3. Stop all player engines
    state.audio.pause();
    stopYouTubeVideo(); // Stop iframe-based YouTube player
    if (state.scWidgetReady) state.scWidget.pause();

    // 4. Divert to Brand Player Engine
    if (track.source === 'youtube') {
      state.activePlayerEngine = 'youtube';
      DOM.floatingVideoPlayer.classList.add('active');

      const videoId = track.streamUrl; // YouTube tracks store videoId as streamUrl
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
        const audioBlob = await db.getLocalTrackAudio(track.id);
        audioSrc = URL.createObjectURL(audioBlob);
        activeBlobUrls.set(track.id, audioSrc);
      } else {
        audioSrc = track.streamUrl;
      }

      state.audio.src = audioSrc;
      state.audio.load();
      state.audio.play().catch(e => console.warn(e));
      state.audio.volume = state.volume;
      
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

function pauseTrack() {
  state.isPlaying = false;
  if (state.activePlayerEngine === 'html5') {
    state.audio.pause();
  } else if (state.activePlayerEngine === 'youtube') {
    // For iframe-based YouTube, stop video by clearing src
    stopYouTubeVideo();
    DOM.floatingVideoPlayer.classList.remove('active');
  } else if (state.activePlayerEngine === 'soundcloud' && state.scWidgetReady) {
    state.scWidget.pause();
  }
}

function resumeTrack() {
  if (!state.currentTrack) {
    if (state.queue.length > 0) playTrack(state.queue[0]);
    return;
  }

  state.isPlaying = true;
  if (state.activePlayerEngine === 'html5') {
    state.audio.play().catch(e => console.warn(e));
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

function handleTrackEnded() {
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

function updateTimelineUI() {
  // Backwards compatibility, handled now by startTimelineTrackerLoop interval
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
    state.sourceNode.connect(state.analyser);
    state.analyser.connect(state.audioContext.destination);
  } catch (error) {
    console.warn('Web Audio node CORS error. Visualizer running in mathematical simulation mode.', error);
  }
}

function initVisualizerCanvas() {
  if (state.visualizerActive) return;
  state.visualizerActive = true;
  
  const canvas = DOM.visCanvas;
  const ctx = canvas.getContext('2d');
  
  const resizeCanvas = () => {
    canvas.width = canvas.parentElement.clientWidth * window.devicePixelRatio;
    canvas.height = 180 * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  const colorPalettes = [
    { bg: 'rgba(15, 17, 26, 0.4)', start: '#8b5cf6', end: '#6366f1' },
    { bg: 'rgba(11, 23, 20, 0.4)', start: '#06b6d4', end: '#10b981' },
    { bg: 'rgba(23, 11, 22, 0.4)', start: '#ec4899', end: '#a855f7' }
  ];

  function renderFrame() {
    if (!state.visualizerActive) return;
    
    state.animationFrameId = requestAnimationFrame(renderFrame);
    
    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;
    
    ctx.fillStyle = 'rgba(6, 7, 10, 0.2)';
    ctx.fillRect(0, 0, width, height);

    const palette = colorPalettes[state.visualizerStyle];
    const bufferLength = state.analyser ? state.analyser.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);
    
    // Only fetch frequency spectrum for HTML5 audio to prevent cross-origin security blockings
    if (state.analyser && state.isPlaying && state.activePlayerEngine === 'html5') {
      state.analyser.getByteFrequencyData(dataArray);
    } else {
      // Wavy mathematical formula for YouTube/SoundCloud
      const time = Date.now() * 0.004;
      for (let i = 0; i < bufferLength; i++) {
        if (state.isPlaying) {
          dataArray[i] = Math.abs(Math.sin(i * 0.1 + time) * Math.cos(i * 0.05 + time * 0.5)) * 140 + Math.random() * 20;
        } else {
          dataArray[i] = Math.max(10, Math.sin(i * 0.15 + time * 0.25) * 8 + 8);
        }
      }
    }

    const barWidth = (width / bufferLength) * 1.5;
    let barHeight;
    let x = 0;
    
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, palette.end);
    gradient.addColorStop(1, palette.start);

    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * (height * 0.85);
      if (barHeight < 4) barHeight = 4;

      ctx.fillStyle = gradient;
      
      const radius = barWidth / 2;
      const barY = height - barHeight;
      
      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.lineTo(x, barY + radius);
      ctx.quadraticCurveTo(x, barY, x + radius, barY);
      ctx.quadraticCurveTo(x + barWidth, barY, x + barWidth, barY + radius);
      ctx.lineTo(x + barWidth, height);
      ctx.closePath();
      ctx.fill();

      x += barWidth + 2.5;
    }
  }

  renderFrame();
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
      <p>Loading trending tracks from Audius API...</p>
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
      <span class="card-badge audius">Audius</span>
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
    const duration = state.ytPlayer.getDuration();
    state.ytPlayer.seekTo(percent * duration, true);
  } else if (state.activePlayerEngine === 'soundcloud' && state.scWidgetReady) {
    state.scWidget.getDuration((durationMs) => {
      state.scWidget.seekTo(percent * durationMs);
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
  if (state.ytPlayerReady) state.ytPlayer.setVolume(state.volume * 100);
  if (state.scWidgetReady) state.scWidget.setVolume(state.volume * 100);
  
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
  if (state.ytPlayerReady) state.ytPlayer.setVolume(state.volume * 100);
  if (state.scWidgetReady) state.scWidget.setVolume(state.volume * 100);
  
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

// --- Event Bindings & Bootstrap ---
function bindEvents() {
  DOM.menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.getAttribute('data-view');
      navigateToView(view);
    });
  });

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
        break;
    }
  });
}


async function bootstrap() {
  console.log('Bootstrapping AuraStream multi-API application...');
  initAudioEngine();
  bindEvents();
  
  try {
    await db.init();
    loadLocalTracksHome();
    loadSidebarPlaylists();
    fetchTrendingTracks();
  } catch (error) {
    console.error('Database failure:', error);
    showToast('Failed to open database storage.', 'error');
  }
}

bootstrap();
