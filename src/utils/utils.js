import { DOM } from '../ui/dom.js';
import { state } from '../core/state.js';

export function showToast(message, type = 'info') {
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

export function formatTime(seconds) {
  if (isNaN(seconds) || seconds === null) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function parseLRC(lrcText) {
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

export function fadeAudioVolume(targetVolume, durationMs = 1000) {
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
