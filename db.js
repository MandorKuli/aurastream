/**
 * AuraStream Database Service
 * Uses browser-native IndexedDB to persist local tracks, playlists, favorites, and settings.
 */

const DB_NAME = 'AuraStreamDB';
const DB_VERSION = 2;

class AuraStreamDB {
  constructor() {
    this.db = null;
    this.currentUser = null;
    this.cloudSyncEnabled = false;
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

        // Stats store: tracks listen history and play counts for Aura Wrapped
        if (!db.objectStoreNames.contains('stats')) {
          db.createObjectStore('stats', { keyPath: 'id' });
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

  // --- CLOUD AUTH & SYNC (FIREBASE) ---
  
  async login(email, password) {
    if (typeof firebase === 'undefined') {
      console.warn("Firebase SDK not loaded");
      return null;
    }
    try {
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      this.currentUser = { id: user.uid, email: user.email, name: user.email.split('@')[0] };
      this.cloudSyncEnabled = true;
      await this.saveSetting('currentUser', this.currentUser);
      return this.currentUser;
    } catch (error) {
      console.error("Firebase Login Error:", error);
      throw error;
    }
  }

  async register(email, password) {
    if (typeof firebase === 'undefined') {
      console.warn("Firebase SDK not loaded");
      return null;
    }
    try {
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      this.currentUser = { id: user.uid, email: user.email, name: user.email.split('@')[0] };
      this.cloudSyncEnabled = true;
      await this.saveSetting('currentUser', this.currentUser);
      return this.currentUser;
    } catch (error) {
      console.error("Firebase Register Error:", error);
      throw error;
    }
  }

  async logout() {
    if (typeof firebase !== 'undefined') {
      await firebase.auth().signOut();
    }
    this.currentUser = null;
    this.cloudSyncEnabled = false;
    await this.saveSetting('currentUser', null);
    return true;
  }

  async syncToCloud() {
    if (!this.cloudSyncEnabled || !this.currentUser || typeof firebase === 'undefined') return false;
    
    console.log('Syncing data to Firebase Firestore for user:', this.currentUser.id);
    const data = await this.exportData();
    
    try {
      const db = firebase.firestore();
      // Store user's exported data blob in firestore
      // In a real production app, we'd sync individual playlists and favorites separately to avoid 1MB document limits,
      // but for this MVP, we stringify the local export.
      await db.collection('users').doc(this.currentUser.id).set({
        syncData: data,
        lastSynced: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('Firebase Cloud sync complete!');
      return true;
    } catch (error) {
      console.error("Firebase Sync Error:", error);
      return false;
    }
  }

  async loadUserSession() {
    if (typeof firebase !== 'undefined') {
      // Use Firebase observer
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          this.currentUser = { id: user.uid, email: user.email, name: user.email.split('@')[0] };
          this.cloudSyncEnabled = true;
          this.saveSetting('currentUser', this.currentUser);
        } else {
          this.currentUser = null;
          this.cloudSyncEnabled = false;
          this.saveSetting('currentUser', null);
        }
      });
    }

    const user = await this.getSetting('currentUser');
    if (user) {
      this.currentUser = user;
      this.cloudSyncEnabled = true;
      return user;
    }
    return null;
  }

  // --- LOCAL TRACKS METHODS ---

  /**
   * Saves a locally uploaded track metadata and its binary audio blob.
   */
  async saveLocalTrack(track) {
    let hasOpfs = false;
    try {
      // Attempt OPFS write if supported
      if (navigator.storage && navigator.storage.getDirectory) {
        const rootDir = await navigator.storage.getDirectory();
        const fileHandle = await rootDir.getFileHandle(`${track.id}.mp3`, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(track.audioBlob);
        await writable.close();
        hasOpfs = true;
        console.log(`[OPFS] Saved track ${track.id}.mp3`);
      }
    } catch (err) {
      console.warn('[OPFS] Failed to save, falling back to IndexedDB:', err);
    }

    // If OPFS succeeds, we don't need to store the heavy blob in IndexedDB
    const dbTrack = { ...track };
    if (hasOpfs) {
      dbTrack.audioBlob = null; 
      dbTrack.storedInOPFS = true;
    }

    const store = await this.getStore('tracks', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(dbTrack);
      request.onsuccess = () => resolve(track); // return original track to caller
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
      request.onsuccess = async () => {
        if (!request.result) {
          return reject(new Error('Audio track not found'));
        }
        
        if (request.result.storedInOPFS && navigator.storage && navigator.storage.getDirectory) {
          try {
            const rootDir = await navigator.storage.getDirectory();
            const fileHandle = await rootDir.getFileHandle(`${id}.mp3`, { create: false });
            const file = await fileHandle.getFile();
            return resolve(file);
          } catch (err) {
            console.warn(`[OPFS] Failed to read ${id}.mp3, trying IndexedDB blob fallback`, err);
          }
        }
        
        if (request.result.audioBlob) {
          resolve(request.result.audioBlob);
        } else {
          reject(new Error('Audio track contains no audio file'));
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

  // --- BACKUP & RESTORE METHODS ---

  /**
   * Exports all non-binary data to a JSON string.
   */
  async exportData() {
    const playlists = await this.getPlaylists();
    const favorites = await this.getFavorites();
    const localTracks = await this.getLocalTracks(); // Excludes audioBlobs in this implementation
    
    return JSON.stringify({
      version: 1,
      timestamp: Date.now(),
      playlists,
      favorites,
      localTracks
    });
  }

  /**
   * Imports data from a JSON string.
   */
  async importData(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      if (!data.version) throw new Error('Invalid backup format');
      
      // Import Playlists
      if (data.playlists) {
        const pStore = await this.getStore('playlists', 'readwrite');
        data.playlists.forEach(p => pStore.put(p));
      }
      
      // Import Favorites
      if (data.favorites) {
        const fStore = await this.getStore('favorites', 'readwrite');
        data.favorites.forEach(f => fStore.put(f));
      }
      
      // We skip localTracks since the binary audio blobs cannot be easily exported/imported via simple JSON.
      return true;
    } catch (err) {
      console.error('Import failed:', err);
      throw err;
    }
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
  // --- LISTENING STATS METHODS (Aura Wrapped) ---

  /**
   * Logs a track play to build statistics.
   */
  async logTrackPlay(track) {
    if (!track || !track.id) return;

    try {
      const store = await this.getStore('stats', 'readwrite');
      const request = store.get(track.id);

      request.onsuccess = () => {
        let statItem = request.result;
        if (!statItem) {
          statItem = {
            id: track.id,
            title: track.title,
            artist: track.artist,
            coverUrl: track.coverUrl,
            playCount: 1,
            lastPlayed: Date.now()
          };
        } else {
          statItem.playCount += 1;
          statItem.lastPlayed = Date.now();
        }
        store.put(statItem);
      };
    } catch (err) {
      console.error('Failed to log track play:', err);
    }
  }

  /**
   * Retrieves all listening statistics.
   */
  async getTopTracks() {
    try {
      const store = await this.getStore('stats', 'readonly');
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const sorted = request.result.sort((a, b) => b.playCount - a.playCount);
          resolve(sorted);
        };
        request.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      return [];
    }
  }
}

// Export database instance
export const db = new AuraStreamDB();

// Initialize session
db.loadUserSession();
