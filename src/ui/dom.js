// --- DOM Cache ---
export const DOM = {
  // Navigation
  menuItems: document.querySelectorAll('.menu-item'),
  views: document.querySelectorAll('.content-view'),
  sidebar: document.getElementById('sidebar'),
  hamburgerBtn: document.getElementById('hamburger-btn'),
  sidebarBackdrop: document.getElementById('sidebar-backdrop'),
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
  settingsBackendUrl: document.getElementById('settings-backend-url'),
  settingsBackendSave: document.getElementById('settings-backend-save'),

  partyRoomBtn: document.getElementById('party-room-btn'),

  // Stats View
  statsContainer: document.getElementById('stats-content-container'),

  // Toast
  toastContainer: document.getElementById('toast-container')
};
