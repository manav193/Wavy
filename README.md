# Wavy

Wavy is a music player and lyric-video studio for web and Android, with real-time audio-reactive visualizations and a retro reactor/CRT visual identity.

## Current foundation

- React + TypeScript + Vite
- Local audio playback with Web Audio API analysis
- Five Canvas visualizers: oscilloscope, spectrum, stepped, sawtooth, and decay
- Editable lyrics text panel (manual lyrics in this first milestone)
- Responsive dark CRT-inspired UI

## Requirements

- Node.js 20 or newer
- npm 10+ (or a compatible package manager)

## Development

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run typecheck
npm run build
```

## Roadmap

1. [x] Establish the web foundation and working audio-reactive visualizer.
2. [ ] Add timestamped lyrics/LRC import and synchronization.
3. [ ] Build the studio timeline and real audio/video export.
4. [ ] Package for Android with Capacitor and test on a device.
5. [ ] Add a verified NIMO-CORE adapter and optional AI transcription/alignment provider.

## NIMO integration

NIMO integration is intentionally not faked in the initial foundation. NIMO-CORE currently documents `GET /api/health` and `POST /api/nimo/chat`; dedicated transcription/alignment must use a separately configured provider adapter unless that capability is verified in NIMO. Basic playback and visualization must work without NIMO or AI credentials.
