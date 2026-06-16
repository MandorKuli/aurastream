import { state } from '../core/state.js';

/**
 * Loads a YouTube video using direct iframe src (no JS API needed).
 * This is more reliable than the YT.Player JS API.
 */
export function loadYouTubeIframe() {
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
export function playYouTubeVideo(videoId) {
  const iframe = document.getElementById('yt-iframe');
  if (!iframe) return;
  // Use embed URL with autoplay and no related videos
  iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3`;
  state.ytPlayerReady = true;
}

/**
 * Stops YouTube iframe playback by clearing its src.
 */
export function stopYouTubeVideo() {
  const iframe = document.getElementById('yt-iframe');
  if (iframe) {
    iframe.src = 'about:blank';
  }
}

// Resolves YouTube video ID using a multi-stage approach (Invidious search API, Piped API, and YouTube scraping as final fallback)
export async function resolveYouTubeVideoId(artist, title) {
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

export async function resolveInvidiousHost() {
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

export async function getInvidiousAudioUrl(videoId) {
  const backendBase = window.AURA_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`);
  return `${backendBase}/api/stream/${videoId}`;
}
