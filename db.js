/**
 * AuraStream Database Service
 * Uses browser-native IndexedDB to persist local tracks, playlists, favorites, and settings.
 */

const DB_NAME = 'AuraStreamDB';
const DB_VERSION = 1;

class AuraStreamDB {
  constructor() {
    this.db = null;
  }

  /**
   * Initializes the IndexedDB database.
   * Creates object stores if they don't exist.
   */
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('Database failed to open:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('Database initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Tracks store: for user-uploaded music files (including raw audio blobs)
        if (!db.objectStoreNames.contains('tracks')) {
          db.createObjectStore('tracks', { keyPath: 'id' });
        }

        // Favorites store: metadata of favorited tracks (API-based and local)
        if (!db.objectStoreNames.contains('favorites')) {
          db.createObjectStore('favorites', { keyPath: 'id' });
        }

        // Playlists store: list of playlists and their metadata/track lists
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }

        // Settings store: key-value storage for app configurations and theme
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Helper to perform transactions.
   */
  async getStore(storeName, mode = 'readonly') {
    const db = await this.init();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // --- LOCAL TRACKS METHODS ---

  /**
   * Saves a locally uploaded track metadata and its binary audio blob.
   */
  async saveLocalTrack(track) {
    const store = await this.getStore('tracks', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(track);
      request.onsuccess = () => resolve(track);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Retrieves all local tracks (metadata, without pulling the huge audio blobs if possible).
   * Note: IndexedDB fetches the whole object, but for local tracks it contains the audio blob.
   */
  async getLocalTracks() {
    const store = await this.getStore('tracks', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        // Map elements to clean structures, converting blobs to URLs dynamically on the fly
        const tracks = request.result.map(t => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          album: t.album || 'Unknown Album',
          genre: t.genre || 'Unknown Genre',
          coverUrl: t.coverUrl || '',
          duration: t.duration || 0,
          source: 'local',
          addedAt: t.addedAt
        }));
        resolve(tracks);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Gets the audio blob for a local track by its ID.
   */
  async getLocalTrackAudio(id) {
    const store = await this.getStore('tracks', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result && request.result.audioBlob) {
          resolve(request.result.audioBlob);
        } else {
          reject(new Error('Audio track not found or contains no audio file'));
        }
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Deletes a local track from the database.
   */
  async deleteLocalTrack(id) {
    const store = await this.getStore('tracks', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // --- FAVORITES METHODS ---

  /**
   * Toggles a track favorite state.
   */
  async toggleFavorite(track) {
    const store = await this.getStore('favorites', 'readwrite');
    const isFav = await this.isFavorite(track.id);

    return new Promise((resolve, reject) => {
      let request;
      if (isFav) {
        request = store.delete(track.id);
      } else {
        const favoriteItem = {
          id: track.id,
          title: track.title,
          artist: track.artist,
          album: track.album || '',
          coverUrl: track.coverUrl || '',
          streamUrl: track.streamUrl || '',
          duration: track.duration || 0,
          source: track.source,
          addedAt: Date.now()
        };
        request = store.put(favoriteItem);
      }

      request.onsuccess = () => resolve(!isFav); // returns true if now favorite, false if removed
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Checks if a track is marked as favorite.
   */
  async isFavorite(id) {
    const store = await this.getStore('favorites', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Gets all favorited tracks.
   */
  async getFavorites() {
    const store = await this.getStore('favorites', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        // Sort by added date descending
        const sorted = request.result.sort((a, b) => b.addedAt - a.addedAt);
        resolve(sorted);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // --- PLAYLISTS METHODS ---

  /**
   * Creates a new playlist.
   */
  async createPlaylist(name, description = '', coverUrl = '') {
    const store = await this.getStore('playlists', 'readwrite');
    const playlist = {
      id: 'playlist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name,
      description,
      coverUrl: coverUrl || 'assets/playlist-default.svg',
      tracks: [],
      createdAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const request = store.put(playlist);
      request.onsuccess = () => resolve(playlist);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Gets all playlists.
   */
  async getPlaylists() {
    const store = await this.getStore('playlists', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Gets a specific playlist by ID.
   */
  async getPlaylist(id) {
    const store = await this.getStore('playlists', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Deletes a playlist.
   */
  async deletePlaylist(id) {
    const store = await this.getStore('playlists', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Adds a track to a playlist.
   */
  async addTrackToPlaylist(playlistId, track) {
    const store = await this.getStore('playlists', 'readwrite');
    
    return new Promise((resolve, reject) => {
      const getReq = store.get(playlistId);
      
      getReq.onsuccess = () => {
        const playlist = getReq.result;
        if (!playlist) {
          reject(new Error('Playlist not found'));
          return;
        }

        // Avoid duplicate tracks in the same playlist
        if (playlist.tracks.some(t => t.id === track.id)) {
          resolve(playlist); // already in playlist
          return;
        }

        // Keep a copy of the track metadata
        const trackCopy = {
          id: track.id,
          title: track.title,
          artist: track.artist,
          album: track.album || '',
          coverUrl: track.coverUrl || '',
          streamUrl: track.streamUrl || '',
          duration: track.duration || 0,
          source: track.source
        };

        playlist.tracks.push(trackCopy);

        const putReq = store.put(playlist);
        putReq.onsuccess = () => resolve(playlist);
        putReq.onerror = (e) => reject(e.target.error);
      };

      getReq.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Removes a track from a playlist.
   */
  async removeTrackFromPlaylist(playlistId, trackId) {
    const store = await this.getStore('playlists', 'readwrite');

    return new Promise((resolve, reject) => {
      const getReq = store.get(playlistId);

      getReq.onsuccess = () => {
        const playlist = getReq.result;
        if (!playlist) {
          reject(new Error('Playlist not found'));
          return;
        }

        playlist.tracks = playlist.tracks.filter(t => t.id !== trackId);

        const putReq = store.put(playlist);
        putReq.onsuccess = () => resolve(playlist);
        putReq.onerror = (e) => reject(e.target.error);
      };

      getReq.onerror = (e) => reject(e.target.error);
    });
  }

  // --- SETTINGS METHODS ---

  /**
   * Saves a configuration setting.
   */
  async saveSetting(key, value) {
    const store = await this.getStore('settings', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put({ key, value });
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Gets a configuration setting.
   */
  async getSetting(key, defaultValue = null) {
    const store = await this.getStore('settings', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.value);
        } else {
          resolve(defaultValue);
        }
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }
}

// Export database instance
export const db = new AuraStreamDB();
