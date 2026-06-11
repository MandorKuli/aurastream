# AuraStream 🎵

> **Premium music streaming web app** — stream Audius, iTunes, YouTube & your own uploads, all in your browser. No account. No tracking. No limits.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-8b5cf6?style=for-the-badge&logo=github)](https://mandorkuli.github.io/aurastream/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-Installable-blue?style=for-the-badge&logo=pwa)](https://mandorkuli.github.io/aurastream/)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎧 **Audius Streaming** | Stream from the decentralized Audius music network |
| 🍎 **iTunes Catalog** | Search & play 90M+ tracks via iTunes Search API |
| ▶️ **YouTube Music** | Stream via floating YouTube mini player |
| ☁️ **SoundCloud** | Play SoundCloud tracks via embedded widget |
| 📁 **Local Uploads** | Upload MP3/WAV — stored locally via IndexedDB |
| 📊 **Live Visualizer** | Real-time audio spectrum visualizer (Web Audio API) |
| ❤️ **Favorites & Playlists** | Save favorites and organize playlists locally |
| 📱 **PWA Ready** | Install as a native-like app on any device |
| ⌨️ **Keyboard Shortcuts** | Full keyboard control (Space, arrows, M, F, V…) |
| 🌐 **Works Offline** | Static assets cached via Service Worker |

---

## 🚀 Quick Start

No build step needed — it's pure HTML + Vanilla JS.

```bash
# Clone the repo
git clone https://github.com/MandorKuli/aurastream.git
cd aurastream

# Open in browser (any local server works)
# Option 1: VS Code Live Server extension
# Option 2: Python
python -m http.server 8080

# Option 3: Node.js
npx serve .
```

Then open `http://localhost:8080` in your browser.

> **Note:** The app uses ES Modules (`type="module"`), so it must be served via HTTP — not opened as a local `file://` URL.

---

## 🗂️ Project Structure

```
aurastream/
├── index.html          # Main HTML shell (all views & modals)
├── style.css           # Complete design system (CSS variables, glassmorphism)
├── app.js              # Main application controller
├── db.js               # IndexedDB wrapper (local music storage)
├── api.js              # API clients (Audius, iTunes, YouTube resolvers)
├── manifest.json       # PWA web app manifest
├── service-worker.js   # Offline caching service worker
└── assets/
    ├── album-default.svg    # Default album artwork
    └── playlist-default.svg # Default playlist artwork
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `←` | Previous track |
| `→` | Next track |
| `M` | Mute / Unmute |
| `F` | Favorite current track |
| `V` | Open Visualizer |
| `S` | Toggle Shuffle |
| `R` | Cycle Repeat mode |
| `?` | Show shortcuts dialog |
| `Esc` | Close modal / sidebar |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                   index.html                    │
│   (Sidebar · Views · Player Bar · Modals)       │
└──────────┬──────────────────────────────────────┘
           │
    ┌──────▼──────┐
    │    app.js   │  ← Main controller
    │  (state +   │     Player engines
    │   routing)  │     Event handlers
    └──┬───────┬──┘
       │       │
  ┌────▼──┐ ┌──▼────┐
  │ db.js │ │ api.js│
  │IndexDB│ │Audius │
  │ store │ │iTunes │
  └───────┘ │YouTube│
            └───────┘
```

**Player Engines:**
- **HTML5 Audio** — local uploads, Audius streams, Invidious audio proxy
- **YouTube iframe** — floating mini player for YouTube videos
- **SoundCloud Widget** — embedded SoundCloud widget API

---

## 🌐 Deployment (GitHub Pages)

This app is deployed via GitHub Pages from the `main` branch.

To deploy your own fork:
1. Fork this repo
2. Go to **Settings → Pages**
3. Set source to `main` branch, root `/`
4. Your app will be live at `https://<your-username>.github.io/aurastream/`

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/awesome-feature`
3. Commit your changes: `git commit -m 'Add awesome feature'`
4. Push to branch: `git push origin feature/awesome-feature`
5. Open a Pull Request

---

## 📄 License

MIT © [MandorKuli](https://github.com/MandorKuli) — see [LICENSE](LICENSE) for details.

---

<p align="center">Made with ❤️ and lots of ☕</p>
