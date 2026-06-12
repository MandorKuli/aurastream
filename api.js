/**
 * AuraStream API Service
 * Communicates with Audius API, iTunes Search API, and YouTube Music via Piped API.
 */

class AuraStreamAPI {
  constructor() {
    // Audius config
    this.audiusHost = null;
    this.fallbackAudiusHosts = [
      'https://creatornode2.audius.co',
      'https://audius-metadata-5.figment.io',
      'https://audius-dp.singapore.fastly.net',
      'https://audius-discovery-1.cultur3.io',
      'https://discoveryprovider.audius.co'
    ];
    this.app_name = 'AURASTREAM';

    // Piped YouTube API config
    this.pipedHost = null;
    this.fallbackPipedHosts = [
      'https://pipedapi.kavin.rocks',
      'https://api.piped.yt',
      'https://pipedapi.syncpundit.io'
    ];
    
    // Invidious fallback for when Piped is down
    this.invidiousSearchHosts = [
      'https://yt.chocolatemoo53.com',
      'https://inv.thepixora.com'
    ];
    
    // Circuit Breaker System
    this.deadHosts = new Set();
  }

  /**
   * Resolves a working Audius discovery node API host.
   */
  async resolveAudiusHost() {
    if (this.audiusHost) return this.audiusHost;

    try {
      const response = await fetch('https://api.audius.co');
      if (!response.ok) throw new Error('Bootstrap node failed');
      
      const data = await response.json();
      if (data && data.data && data.data.length > 0) {
        const hosts = data.data;
        this.audiusHost = hosts[Math.floor(Math.random() * hosts.length)];
        console.log(`Resolved Audius host: ${this.audiusHost}`);
        return this.audiusHost;
      }
    } catch (error) {
      console.warn('Failed to resolve dynamic Audius host, using fallback:', error);
    }

    this.audiusHost = this.fallbackAudiusHosts[Math.floor(Math.random() * this.fallbackAudiusHosts.length)];
    return this.audiusHost;
  }

  /**
   * Resolves a working Piped YouTube API host.
   */
  async resolvePipedHost() {
    if (this.pipedHost && !this.deadHosts.has(this.pipedHost)) return this.pipedHost;

    // Filter out known dead hosts
    const aliveHosts = this.fallbackPipedHosts.filter(h => !this.deadHosts.has(h));
    
    // If all hosts are marked dead, reset the circuit breaker and try again
    if (aliveHosts.length === 0) {
      console.warn('Circuit breaker triggered: All Piped hosts are dead. Resetting status.');
      this.deadHosts.clear();
      aliveHosts.push(...this.fallbackPipedHosts);
    }

    // Ping hosts sequentially until one responds
    for (const host of aliveHosts) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 1500); // 1.5s fast timeout
        const response = await fetch(`${host}/search?q=test&filter=videos`, { signal: controller.signal });
        clearTimeout(id);
        
        if (response.ok) {
          this.pipedHost = host;
          console.log(`Resolved Piped host: ${this.pipedHost}`);
          return this.pipedHost;
        } else {
          this.deadHosts.add(host);
        }
      } catch (err) {
        console.warn(`Piped host ${host} failed, blacklisting temporarily.`);
        this.deadHosts.add(host);
      }
    }

    // Default fallback (we shouldn't reach here normally, but just in case)
    this.pipedHost = this.fallbackPipedHosts[Math.floor(Math.random() * this.fallbackPipedHosts.length)];
    return this.pipedHost;
  }

  /**
   * Fetches trending tracks from Audius.
   */
  async getTrendingTracks() {
    try {
      // Fetch Top 100 to give a large pool for shuffling
      const url = `https://itunes.apple.com/us/rss/topsongs/limit=100/json`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const json = await response.json();
      let entries = json.feed?.entry || [];
      
      // Shuffle the array to make the "Refresh" button give different songs every time
      entries = entries.sort(() => 0.5 - Math.random()).slice(0, 12);
      
      // Normalize iTunes RSS feed format to AuraStream Track object
      return entries.map((entry, index) => ({
        id: `itunes_trending_${index}_${Date.now()}`, // Temporary ID
        title: entry['im:name']?.label || 'Unknown Title',
        artist: entry['im:artist']?.label || 'Unknown Artist',
        album: 'iTunes Top Songs',
        coverUrl: entry['im:image'] ? entry['im:image'][entry['im:image'].length - 1]?.label : 'assets/album-default.svg',
        streamUrl: entry.link && entry.link.length > 1 ? entry.link[1]?.attributes?.href : '',
        duration: 30, // iTunes previews are usually 30 seconds
        source: 'itunes',
        playCount: 0
      }));
    } catch (error) {
      console.error('Error fetching trending tracks from iTunes:', error);
      return [];
    }
  }

  /**
   * Searches for tracks on Audius, iTunes, and YouTube Music via Piped.
   */
  async searchTracks(query) {
    if (!query || query.trim() === '') return [];

    // Run searches in parallel
    const [audiusResults, itunesResults, youtubeResults] = await Promise.allSettled([
      this.searchAudius(query),
      this.searchITunes(query),
      this.searchYouTube(query)
    ]);

    const yt = youtubeResults.status === 'fulfilled' ? youtubeResults.value : [];
    const au = audiusResults.status === 'fulfilled' ? audiusResults.value : [];
    const it = itunesResults.status === 'fulfilled' ? itunesResults.value : [];

    const results = [];
    const maxLen = Math.max(yt.length, au.length, it.length);
    
    // Interleave results for a better "tidy" visual mix in the UI
    for (let i = 0; i < maxLen; i++) {
      if (yt[i]) results.push(yt[i]);
      if (au[i]) results.push(au[i]);
      if (it[i]) results.push(it[i]);
    }

    return results;
  }

  /**
   * Fetches data from Piped API using dynamic CORS proxies if direct requests fail.
   */
  async fetchPipedWithProxy(endpoint) {
    const host = await this.resolvePipedHost();
    const targetUrl = `${host}${endpoint}`;

    // Try direct fetch first
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(id);
      if (response.ok) {
        return await response.json();
      } else {
        // Mark as dead if returns 500 etc.
        this.deadHosts.add(host);
        this.pipedHost = null; // force re-resolve next time
      }
    } catch (err) {
      console.warn(`Direct Piped fetch failed for ${targetUrl}, trying CORS proxies...`, err);
      this.deadHosts.add(host);
      this.pipedHost = null;
    }

    // Try CORS proxies sequentially as fallback for the newly chosen host
    // (If the host is down, proxies won't help, but if it's just CORS blocking, proxies help)
    const newHost = await this.resolvePipedHost();
    const newTargetUrl = `${newHost}${endpoint}`;

    const proxies = [
      (url) => `https://corsproxy.io/?${url}`,
      (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    ];

    for (const getProxyUrl of proxies) {
      try {
        const proxyUrl = getProxyUrl(newTargetUrl);
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 2500);
        const response = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(id);
        if (response.ok) {
          return await response.json();
        }
      } catch (err) {
        console.warn(`Piped fetch via proxy failed for ${newTargetUrl}:`, err);
      }
    }

    throw new Error(`Failed to fetch from Piped API at ${newTargetUrl}`);
  }

  /**
   * Search YouTube Music via Piped API, with Invidious fallback.
   */
  async searchYouTube(query) {
    // First, try Piped API
    try {
      const endpoint = `/search?q=${encodeURIComponent(query)}&filter=music_songs`;
      const json = await this.fetchPipedWithProxy(endpoint);
      const items = json.items || json.streamItems || [];
      
      // Filter out only stream/video types (which represent songs/clips)
      const pipedResults = items
        .filter(item => item.type === 'stream' || item.type === 'video')
        .slice(0, 15)
        .map(video => this.normalizeYouTubeTrack(video));
      
      if (pipedResults.length > 0) return pipedResults;
    } catch (error) {
      console.warn('Piped API search failed, trying Invidious fallback:', error.message || error);
    }
    
    // Fallback: try Invidious search API
    for (const host of this.invidiousSearchHosts) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000);
        const searchUrl = `${host}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
        const response = await fetch(searchUrl, { signal: controller.signal });
        clearTimeout(id);
        
        if (response.ok) {
          const json = await response.json();
          if (Array.isArray(json) && json.length > 0) {
            return json
              .filter(item => item.type === 'video' || item.videoId)
              .slice(0, 15)
              .map(video => ({
                id: `youtube_${video.videoId}`,
                title: video.title,
                artist: video.author || 'YouTube Artist',
                album: 'YouTube Music',
                coverUrl: video.videoId ? `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg` : 'assets/album-default.svg',
                streamUrl: video.videoId,
                duration: video.lengthSeconds || 0,
                source: 'youtube'
              }));
          }
        }
      } catch (err) {
        console.warn(`Invidious search failed on ${host}:`, err.message || err);
      }
    }
    
    // Final fallback: try local backend search (yt-dlp powered)
    try {
      const response = await fetch(`http://localhost:8000/api/search/${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout(8000)
      });
      if (response.ok) {
        const results = await response.json();
        if (Array.isArray(results) && results.length > 0) {
          console.log('YouTube search succeeded via local backend');
          return results;
        }
      }
    } catch (err) {
      // Backend not running — that's fine
    }
    
    console.warn('All YouTube search methods exhausted');
    return [];
  }

  /**
   * Search Audius API for tracks.
   */
  async searchAudius(query) {
    try {
      const host = await this.resolveAudiusHost();
      const url = `${host}/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=${this.app_name}`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const json = await response.json();
      const tracks = json.data || [];
      
      return tracks.map(t => this.normalizeAudiusTrack(t));
    } catch (error) {
      console.error('Error searching Audius:', error);
      return [];
    }
  }

  /**
   * Search iTunes API for tracks.
   */
  async searchITunes(query) {
    try {
      const url = `https://itunes.apple.com/search?media=music&entity=song&term=${encodeURIComponent(query)}&limit=15`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const json = await response.json();
      const tracks = json.results || [];
      
      return tracks.map(t => this.normalizeITunesTrack(t));
    } catch (error) {
      console.error('Error searching iTunes:', error);
      return [];
    }
  }

  /**
   * Fetches lyrics from lyrics.ovh API.
   */
  async fetchLyrics(artist, title) {
    if (!artist || !title) return null;
    
    const cleanTitle = title
      .replace(/(\(|\[).*?(official|audio|video|feat|ft|lyric|live).*?(\)|\])/gi, '')
      .replace(/official audio|official video/gi, '')
      .trim();
    
    try {
      const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(cleanTitle)}`;
      const response = await fetch(url);
      
      if (!response.ok) return null;
      
      const json = await response.json();
      return json.lyrics || null;
    } catch (error) {
      console.warn('Lyrics fetch failed:', error);
      return null;
    }
  }

  /**
   * Normalizes an Audius track to the unified AuraStream format.
   */
  normalizeAudiusTrack(track) {
    let coverUrl = 'assets/album-default.svg';
    if (track.artwork) {
      coverUrl = track.artwork['480x480'] || track.artwork['150x150'] || coverUrl;
    }

    const streamUrl = `${this.audiusHost}/v1/tracks/${track.id}/stream?app_name=${this.app_name}`;

    return {
      id: `audius_${track.id}`,
      title: track.title,
      artist: track.user ? track.user.name : 'Unknown Artist',
      album: track.album || 'Audius Single',
      coverUrl: coverUrl,
      streamUrl: streamUrl,
      duration: track.duration || 0,
      source: 'audius'
    };
  }

  /**
   * Normalizes an iTunes track to the unified AuraStream format.
   */
  normalizeITunesTrack(track) {
    let coverUrl = track.artworkUrl100 || 'assets/album-default.svg';
    if (coverUrl.includes('100x100bb.jpg')) {
      coverUrl = coverUrl.replace('100x100bb.jpg', '400x400bb.jpg');
    }

    return {
      id: `itunes_${track.trackId}`,
      title: track.trackName,
      artist: track.artistName,
      album: track.collectionName || 'iTunes Single',
      coverUrl: coverUrl,
      streamUrl: track.previewUrl,
      duration: Math.round((track.trackTimeMillis || 0) / 1000) || 30,
      source: 'itunes'
    };
  }

  /**
   * Normalizes a YouTube video from Piped to the unified AuraStream format.
   */
  normalizeYouTubeTrack(video) {
    // Extract video ID from URL: e.g. "/watch?v=dQw4w9WgXcQ"
    let videoId = '';
    if (video.url) {
      const match = video.url.match(/[?&]v=([^&#]*)/);
      videoId = match ? match[1] : video.url.replace('/watch?v=', '');
    }

    // High res thumbnail
    const coverUrl = videoId 
      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` 
      : (video.thumbnail || 'assets/album-default.svg');

    return {
      id: `youtube_${videoId}`,
      title: video.title,
      artist: video.uploaderName || 'YouTube Artist',
      album: 'YouTube Music',
      coverUrl: coverUrl,
      streamUrl: videoId, // Store video ID as streaming URL
      duration: video.duration || 0,
      source: 'youtube'
    };
  }

  // --- LRCLIB (Synced Lyrics) API ---
  async fetchSyncedLyrics(artist, title) {
    if (!artist || !title) return null;
    try {
      const cleanArtist = artist.replace(/(\(.*?\)|\[.*?\])/g, '').trim();
      const cleanTitle = title.replace(/(\(.*?\)|\[.*?\]|official|video|audio|lyric)/gi, '').trim();
      
      const queryUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`;
      const response = await fetch(queryUrl);
      if (response.ok) {
        const data = await response.json();
        if (data && data.syncedLyrics) {
          return { synced: true, text: data.syncedLyrics };
        } else if (data && data.plainLyrics) {
          return { synced: false, text: data.plainLyrics };
        }
      }
      return null;
    } catch (err) {
      console.warn('LRCLIB API failed:', err);
      return null;
    }
  }
}

// Export API instance
export const api = new AuraStreamAPI();
