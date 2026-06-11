# Contributing to AuraStream

Thank you for your interest in contributing! 🎉

## Getting Started

1. **Fork** this repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/aurastream.git
   cd aurastream
   ```
3. Serve locally (ES Modules require HTTP):
   ```bash
   npx serve .
   # or
   python -m http.server 8080
   ```

## Development Guidelines

- **No build step** — pure HTML + Vanilla JS + CSS. Keep it that way.
- **Modular JS** — `app.js` handles UI/state, `db.js` handles IndexedDB, `api.js` handles external APIs.
- **CSS variables** — use existing design tokens from `style.css :root` instead of hardcoded colors.
- **No external frameworks** — no React, Vue, Tailwind, etc. Keep the zero-dependency philosophy.

## Commit Message Format

Use conventional commits:
```
feat: add SoundCloud search support
fix: resolve Invidious stream timeout on slow connections
style: improve mobile player bar layout
docs: update README with new keyboard shortcuts
```

## Pull Request Process

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes and test in multiple browsers
3. Commit using the format above
4. Push and open a PR with a clear description of what you changed and why

## Bug Reports

Open an issue with:
- Browser & OS version
- Steps to reproduce
- Expected vs actual behavior
- Console errors (if any)

## Feature Requests

Open an issue with the `enhancement` label. Describe the use case and why it benefits users.

---

Thank you for helping make AuraStream better! 🎵
