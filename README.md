# Wavy

Wavy is a music player and lyric-video studio for web and Android, with real-time audio-reactive visualizations and a retro reactor/CRT visual identity.

## Current foundation

- React + TypeScript + Vite
- Local MP3/audio playback and Web Audio API analysis
- MP4/WebM/MOV/M4V media import where browser codecs support it; video audio is routed through the same analyser for live visualizations (no upload required)
- In-browser video audio extraction to downloadable 44.1 kHz stereo PCM WAV or MP3 using FFmpeg WebAssembly, with progress, cancellation, useful errors, and a 200 MB source limit; Chromium E2E tests verify real output metadata and audible samples
- Five Canvas visualizers: oscilloscope, spectrum, stepped, sawtooth, and decay
- LRC import/export with multi-timestamp, metadata, and offset support
- Playback-synchronized lyric highlighting, line seek, manual timestamp editor, and preview offset
- Five selectable word-level karaoke preview presets; word timing is estimated from line intervals until word-level timestamps are supplied
- Studio workspace with 16:9, 9:16, and 1:1 project settings, 720p/1080p resolution presets, 24/30/60 FPS, background presets, and a live composition preview
- Multi-track timeline for source audio, visualizer, lyric cue points, and draggable/resizable text overlays; 250 ms snapping, project autosave, and versioned `.wavy.json` import/export
- Optional NIMO-CORE text-formatting assist with an explicit review/apply step
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
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The GitHub Actions workflow runs the full Chromium suite, creates temporary video fixtures, validates WAV/MP3 codec, duration, sample rate, channel count and audible signal with FFmpeg/ffprobe, and uploads Playwright diagnostics on failure. Local media-fixture tests are skipped when the generated fixtures are absent.

## Roadmap

1. [x] Establish the web foundation and working audio-reactive visualizer.
2. [x] Add timestamped lyrics/LRC import, synchronization, editing, and optional NIMO text assist.
3. [x] Build the Phase 3 studio timeline foundation; Phase 4 deterministic lyric-video rendering/export remains pending.
4. [ ] Package for Android with Capacitor and test on a device.
5. [x] Add a verified optional NIMO chat adapter for user-approved lyric formatting drafts.
6. [ ] Add dedicated audio transcription/forced-alignment through a configured backend provider.

See [the detailed roadmap](docs/ROADMAP.md) for the implementation phases and acceptance criteria. The repository-wide review is documented in [the QA audit](docs/QA_AUDIT.md).

## NIMO integration

Wavy uses the documented `POST /api/nimo/chat` endpoint for optional text-only formatting assistance. Set `VITE_NIMO_API_BASE_URL` in a local `.env` to the NIMO-CORE base URL (for example `http://localhost:8787`). This variable must contain only a base URL, never a secret. Lyrics are sent only after the user explicitly clicks **NIMO assist**, and the result is marked as an unverified draft that must be reviewed.

The current NIMO chat contract does not accept audio bytes and is not a forced-alignment API. Wavy does not claim it transcribes audio or verifies timestamps. Dedicated transcription/forced alignment needs a separate backend provider adapter. Basic playback, visualization, and manual lyric sync work without NIMO.
