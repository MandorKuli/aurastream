/**
 * AuraStream Audio Player Module
 * Manages HTML5 Audio, SoundCloud Widget, Web Audio API (EQ, Reverb, Spatial),
 * timeline tracking loop, lyrics sync, and playback state callbacks.
 */

import { state } from '../core/state.js';
import { DOM } from '../ui/dom.js';
import { showToast, formatTime, fadeAudioVolume } from '../utils/utils.js';
import { loadYouTubeIframe, playYouTubeVideo, stopYouTubeVideo, resolveYouTubeVideoId } from './youtube-engine.js';

// --- Reverb Impulse Synthesizer ---
function createReverbImpulseResponse(audioContext) {
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * 2.5;
  const impulse = audioContext.createBuffer(2, length, sampleRate);
  for (let i = 0; i < 2; i++) {
    const channelData = impulse.getChannelData(i);
    for (let j = 0; j < length; j++) {
      channelData[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, 3);
    }
  }
  return impulse;
}

/**
 * Initialises the Web Audio API routing graph (EQ → Reverb → Panner → Analyser → Destination).
 * Called the first time a track starts playing. Idempotent — returns early if already set up.
 */
export function initWebAudioContext() {
  if (state.audioContext) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioContextClass();

    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 256;

    state.sourceNode = state.audioContext.createMediaElementSource(state.audio);

    // EQ Filters
    state.eqBassNode = state.audioContext.createBiquadFilter();
    state.eqBassNode.type = 'lowshelf';
    state.eqBassNode.frequency.value = 150;

    state.eqTrebleNode = state.audioContext.createBiquadFilter();
    state.eqTrebleNode.type = 'highshelf';
    state.eqTrebleNode.frequency.value = 4000;

    // Reverb (Convolver)
    state.reverbNode = state.audioContext.createConvolver();
    state.reverbNode.buffer = createReverbImpulseResponse(state.audioContext);

    // 8D Audio Panner
    state.pannerNode = state.audioContext.createPanner();
    state.pannerNode.panningModel = 'HRTF';
    state.pannerNode.distanceModel = 'inverse';
    state.pannerNode.refDistance = 1;
    state.pannerNode.maxDistance = 10000;
    state.pannerNode.rolloffFactor = 1;
    state.pannerNode.coneInnerAngle = 360;
    state.pannerNode.coneOuterAngle = 0;
    state.pannerNode.coneOuterGain = 0;
    if (state.audioContext.listener.positionX) {
      state.audioContext.listener.positionX.value = 0;
      state.audioContext.listener.positionY.value = 0;
      state.audioContext.listener.positionZ.value = 0;
    } else {
      state.audioContext.listener.setPosition(0, 0, 0);
    }

    // Dry/Wet Gain
    state.reverbGainNode = state.audioContext.createGain();
    state.reverbGainNode.gain.value = 0;
    state.dryGainNode = state.audioContext.createGain();
    state.dryGainNode.gain.value = 1;

    // Restore EQ slider values set before playback
    if (DOM.eqBass) state.eqBassNode.gain.value = parseInt(DOM.eqBass.value) || 0;
    if (DOM.eqTreble) state.eqTrebleNode.gain.value = parseInt(DOM.eqTreble.value) || 0;

    // Routing: Source → Bass EQ → Treble EQ → (Dry | Reverb) → Panner → Analyser → Destination
    state.sourceNode.connect(state.eqBassNode);
    state.eqBassNode.connect(state.eqTrebleNode);
    state.eqTrebleNode.connect(state.dryGainNode);
    state.eqTrebleNode.connect(state.reverbNode);
    state.reverbNode.connect(state.reverbGainNode);
    state.dryGainNode.connect(state.pannerNode);
    state.reverbGainNode.connect(state.pannerNode);
    state.pannerNode.connect(state.analyser);
    state.analyser.connect(state.audioContext.destination);

    applyRemixMode(state.remixMode);

  } catch (error) {
    console.warn('Web Audio init error. Visualizer in simulation mode.', error);
  }
}

/**
 * Applies remix mode: speed, pitch, and reverb mix.
 * @param {'normal'|'nightcore'|'slowed'} mode
 */
export function applyRemixMode(mode) {
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

  if (state.audio) {
    state.audio.playbackRate = rate;
    state.audio.preservesPitch = preservesPitch;
    if (state.audio.webkitPreservesPitch !== undefined) state.audio.webkitPreservesPitch = preservesPitch;
    if (state.audio.mozPreservesPitch !== undefined) state.audio.mozPreservesPitch = preservesPitch;
  }

  if (state.ytPlayerReady && state.ytPlayer.setPlaybackRate) {
    state.ytPlayer.setPlaybackRate(rate);
  }

  if (state.reverbGainNode && state.dryGainNode) {
    state.reverbGainNode.gain.setTargetAtTime(reverbWet, state.audioContext.currentTime, 0.1);
    state.dryGainNode.gain.setTargetAtTime(dryMix, state.audioContext.currentTime, 0.1);
  }
}

/**
 * Starts the 250ms polling interval that drives timeline progress, lyrics sync,
 * 8D spatial animation, and beat-sync background effects.
 * Must be called once, from initAudioEngine().
 */
export function startTimelineTrackerLoop(syncLyricsUI) {
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
          DOM.playerTimeDuration.textContent = formatTime(state.currentTrack.duration);
        }
      } catch (err) {
        // ignore cross-origin iframe errors
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

    // 8D Spatial Audio rotation
    if (state.spatialEnabled && state.pannerNode && state.activePlayerEngine === 'html5') {
      state.spatialAngle += 0.05;
      state.pannerNode.positionX.value = Math.sin(state.spatialAngle) * 3;
      state.pannerNode.positionZ.value = Math.cos(state.spatialAngle) * 3;
    }

    // Beat-sync background pulse
    if (state.analyser && state.activePlayerEngine === 'html5') {
      const bufferLength = state.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      state.analyser.getByteFrequencyData(dataArray);
      let bassSum = 0;
      for (let i = 0; i < 10; i++) bassSum += dataArray[i];
      const bassEnergy = (bassSum / 10) / 255;
      document.documentElement.style.setProperty('--beat-scale', 1 + bassEnergy * 0.05);
      document.documentElement.style.setProperty('--beat-glow', bassEnergy * 0.4);
    } else {
      document.documentElement.style.setProperty('--beat-scale', 1);
      document.documentElement.style.setProperty('--beat-glow', 0);
    }
  }, 250);
}

/**
 * Initialises all audio engines: HTML5 Audio, SoundCloud Widget, YouTube IFrame.
 * Called once on app startup.
 * @param {function} updatePlaybackControlsUI - callback from app.js
 * @param {function} handleTrackEnded - callback from app.js
 * @param {function} syncLyricsUI - callback from app.js
 */
export function initAudioEngine(updatePlaybackControlsUI, handleTrackEnded, syncLyricsUI) {
  state.audio = new Audio();
  state.audio.crossOrigin = 'anonymous';

  DOM.playerVolumeBar.style.width = `${state.volume * 100}%`;
  state.audio.volume = state.volume;

  // HTML5 Audio events
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
      console.warn('HTML5 audio error:', e);
      if (state.currentTrack && (state.currentTrack.source === 'youtube' || state.currentTrack.source === 'itunes')) {
        showToast('Stream unreachable. Falling back to YouTube Player...', 'warning');
        try {
          let videoId;
          if (state.currentTrack.source === 'youtube') {
            videoId = state.currentTrack.streamUrl;
          } else {
            videoId = await resolveYouTubeVideoId(state.currentTrack.artist, state.currentTrack.title);
          }
          if (videoId) {
            state.audio.src = '';
            state.activePlayerEngine = 'youtube';
            DOM.floatingVideoPlayer.classList.add('active');
            playYouTubeVideo(videoId);
            return;
          }
        } catch (err) {
          console.error('Fallback resolution failed:', err);
        }
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

  // SoundCloud Widget
  const scIframe = document.getElementById('soundcloud-widget-iframe');
  try {
    state.scWidget = SC.Widget(scIframe);
    state.scWidget.bind(SC.Widget.Events.READY, () => {
      state.scWidgetReady = true;
      state.scWidget.setVolume(state.volume * 100);
      console.log('SoundCloud Widget ready');
    });
    state.scWidget.bind(SC.Widget.Events.PLAY, () => {
      if (state.activePlayerEngine === 'soundcloud') { state.isPlaying = true; updatePlaybackControlsUI(); }
    });
    state.scWidget.bind(SC.Widget.Events.PAUSE, () => {
      if (state.activePlayerEngine === 'soundcloud') { state.isPlaying = false; updatePlaybackControlsUI(); }
    });
    state.scWidget.bind(SC.Widget.Events.FINISH, () => {
      if (state.activePlayerEngine === 'soundcloud') handleTrackEnded();
    });
  } catch (err) {
    console.warn('SoundCloud widget not available:', err);
  }

  // YouTube IFrame
  loadYouTubeIframe();

  // Start unified timeline tracking loop
  startTimelineTrackerLoop(syncLyricsUI);
}
