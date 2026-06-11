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
      'https://pipedapi.tokhmi.xyz',
      'https://api.piped.yt'
    ];
    
    // Invidious fallback for when Piped is down
    this.invidiousSearchHosts = [
      'https://yt.chocolatemoo53.com',
      'https://inv.thepixora.com'
    ];
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
    if (this.pipedHost) return this.pipedHost;

    // We can do a quick check on the primary host, if it fails, fallback
    const primary = this.fallbackPipedHosts[0];
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000); // 2s timeout
      
      const response = await fetch(`${primary}/search?q=music&filter=videos`, { signal: controller.signal });
      clearTimeout(id);
      
      if (response.ok) {
        this.pipedHost = primary;
        console.log(`Resolved primary Piped host: ${this.pipedHost}`);
        return this.pipedHost;
      }
    } catch (e) {
      console.warn(`Piped primary host ${primary} failed, trying fallbacks...`);
    }

    // Try other fallbacks sequentially until one responds
    for (let i = 1; i < this.fallbackPipedHosts.length; i++) {
      const host = this.fallbackPipedHosts[i];
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 1500);
        const response = await fetch(`${host}/search?q=test&filter=videos`, { signal: controller.signal });
        clearTimeout(id);
        if (response.ok) {
          this.pipedHost = host;
          console.log(`Resolved Piped host: ${this.pipedHost}`);
          return this.pipedHost;
        }
      } catch (err) {
        console.warn(`Piped host ${host} not responding...`);
      }
    }

    // Default fallback
    this.pipedHost = this.fallbackPipedHosts[Math.floor(Math.random() * this.fallbackPipedHosts.length)];
    console.log(`Using default Piped host: ${this.pipedHost}`);
    return this.pipedHost;
  }

  /**
   * Fetches trending tracks from Audius.
   */
  async getTrendingTracks() {
    try {
      const host = await this.resolveAudiusHost();
      const url = `${host}/v1/tracks/trending?app_name=${this.app_name}`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const json = await response.json();
      const tracks = json.data || [];
      
      return tracks.map(t => this.normalizeAudiusTrack(t));
    } catch (error) {
      console.error('Error fetching trending tracks:', error);
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

    const results = [];

    // Prioritize and label
    if (youtubeResults.status === 'fulfilled') {
      results.push(...youtubeResults.value);
    }

    if (audiusResults.status === 'fulfilled') {
      results.push(...audiusResults.value);
    }
    
    if (itunesResults.status === 'fulfilled') {
      // Map iTunes tracks as both "iTunes" and simulated "Spotify Preview" elements for UX
      results.push(...itunesResults.value);
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
      }
    } catch (err) {
      console.warn(`Direct Piped fetch failed for ${targetUrl}, trying CORS proxies...`, err);
    }

    // Try CORS proxies sequentially
    const proxies = [
      (url) => `https://corsproxy.io/?${url}`,
      (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    ];

    for (const getProxyUrl of proxies) {
      try {
        const proxyUrl = getProxyUrl(targetUrl);
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 2500);
        const response = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(id);
        if (response.ok) {
          return await response.json();
        }
      } catch (err) {
        console.warn(`Piped fetch via proxy failed for ${targetUrl}:`, err);
      }
    }

    throw new Error(`Failed to fetch from Piped API at ${targetUrl}`);
  }

  /**
   * Search YouTube Music via Piped API, with Invidious fallback.
   */
  async searchYouTube(query) {
    // First, try Piped API
    try {
      const endpoint = `/search?q=${encodeURIComponent(query)}&filter=all`;
      const json = await this.fetchPipedWithProxy(endpoint);
      const items = json.streamItems || [];
      
      // Filter out only video types (which represent songs/clips)
      const pipedResults = items
        .filter(item => item.type === 'video')
        .slice(0, 15)
        .map(video => this.normalizeYouTubeTrack(video));
      
      if (pipedResults.length > 0) return pipedResults;
    } catch (error) {
      console.warn('Piped API failed, trying Invidious for YouTube search:', error);
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
        console.warn(`Invidious search failed on ${host}:`, err);
      }
    }
    
    console.error('All YouTube search methods failed');
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
}

// Export API instance
export const api = new AuraStreamAPI();
