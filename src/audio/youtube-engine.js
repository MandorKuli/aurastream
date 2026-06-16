import { state } from '../core/state.js';

let ytPlayerInstance = null;
let ytPlayerReadyPromise = null;

export function loadYouTubeIframe() {
  if (ytPlayerReadyPromise) return ytPlayerReadyPromise;

  ytPlayerReadyPromise = new Promise((resolve) => {
    // Inject the YouTube IFrame API script if it doesn't exist
    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    // Define the global callback for the YouTube API
    window.onYouTubeIframeAPIReady = () => {
      ytPlayerInstance = new YT.Player('youtube-player-container', {
        height: '100%',
        width: '100%',
        videoId: '',
        playerVars: {
          'playsinline': 1,
          'autoplay': 1,
          'controls': 0,
          'disablekb': 1,
          'fs': 0,
          'modestbranding': 1,
          'rel': 0
        },
        events: {
          'onReady': onPlayerReady,
          'onStateChange': onPlayerStateChange,
          'onError': onPlayerError
        }
      });
    };

    function onPlayerReady(event) {
      state.ytPlayer = ytPlayerInstance;
      state.ytPlayerReady = true;
      console.log('YouTube JS API player ready');
      resolve(ytPlayerInstance);
    }
    
    function onPlayerStateChange(event) {
      if (event.data === YT.PlayerState.PLAYING) {
        state.isPlaying = true;
      } else if (event.data === YT.PlayerState.PAUSED) {
        state.isPlaying = false;
      } else if (event.data === YT.PlayerState.ENDED) {
        // Trigger global track ended event so app.js can catch it
        document.dispatchEvent(new Event('youtube-track-ended'));
      }
    }
    
    function onPlayerError(event) {
      console.error("YouTube Player Error:", event.data);
    }
  });

  return ytPlayerReadyPromise;
}

export async function playYouTubeVideo(videoId) {
  if (!state.ytPlayerReady) {
    await loadYouTubeIframe();
  }
  if (ytPlayerInstance && typeof ytPlayerInstance.loadVideoById === 'function') {
    ytPlayerInstance.loadVideoById(videoId);
  }
}

export function stopYouTubeVideo() {
  if (ytPlayerInstance && typeof ytPlayerInstance.stopVideo === 'function') {
    ytPlayerInstance.stopVideo();
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

  // Stage 0: Try Personal Custom Backend (Most Reliable)
  if (window.AURA_BACKEND_URL) {
    try {
      const searchUrl = `${window.AURA_BACKEND_URL}/api/search/${query}`;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(searchUrl, { signal: controller.signal });
      clearTimeout(id);
      
      if (response.ok) {
        const results = await response.json();
        if (Array.isArray(results) && results.length > 0) {
          const videoId = results[0].streamUrl; // backend sets video_id as streamUrl
          if (videoId) {
            console.log(`Resolved video ID "${videoId}" via Personal Backend`);
            return videoId;
          }
        }
      }
    } catch (err) {
      console.warn('Personal backend search failed, falling back to public APIs...', err);
    }
  }

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
  // 1. Try Cobalt API (Highly reliable, IP unblocked, native browser fetch)
  try {
    const cobaltResponse = await fetch("https://api.cobalt.tools/api/json", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        isAudioOnly: true,
        aFormat: "best"
      }),
      signal: AbortSignal.timeout(5000)
    });
    
    if (cobaltResponse.ok) {
      const data = await cobaltResponse.json();
      if (data && data.url) {
        return data.url;
      }
    }
  } catch (err) {
    console.warn("Cobalt API failed:", err);
  }

  // 2. Try Piped APIs (often blocked but worth a shot)
  const hosts = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.tokhmi.xyz',
    'https://api.piped.yt'
  ];
  
  for (const host of hosts) {
    try {
      const response = await fetch(`${host}/streams/${videoId}`, {
        signal: AbortSignal.timeout(4000)
      });
      if (response.ok) {
        const data = await response.json();
        const audioStream = data.audioStreams?.find(s => s.mimeType?.includes('mp4') || s.mimeType?.includes('webm'));
        if (audioStream && audioStream.url) {
          return audioStream.url;
        }
      }
    } catch (err) {
      console.warn(`Piped API ${host} failed`, err);
    }
  }

  // 3. Fallback to local python backend if public APIs all fail
  const backendBase = window.AURA_BACKEND_URL || 'https://mieer-aurastream-backend.hf.space';
  return `${backendBase}/api/stream/${videoId}`;
}
