# Wavy

Wavy is a music player and lyric-video studio for web and Android, with real-time audio-reactive visualizations and a retro reactor/CRT visual identity.

## Current foundation

- React + TypeScript + Vite
- Local MP3/audio playback and Web Audio API analysis
- MP4/WebM/MOV/M4V media import where browser codecs support it; video audio is routed through the same analyser for live visualizations (no upload required)
- Five Canvas visualizers: oscilloscope, spectrum, stepped, sawtooth, and decay
- LRC import/export with multi-timestamp, metadata, and offset support
- Playback-synchronized lyric highlighting, line seek, manual timestamp editor, and preview offset
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
npm run typecheck
npm test
npm run build
```

## Roadmap

1. [x] Establish the web foundation and working audio-reactive visualizer.
2. [x] Add timestamped lyrics/LRC import, synchronization, editing, and optional NIMO text assist.
3. [ ] Build the studio timeline and real audio/video export, including downloadable extracted audio formats.
4. [ ] Package for Android with Capacitor and test on a device.
5. [x] Add a verified optional NIMO chat adapter for user-approved lyric formatting drafts.
6. [ ] Add dedicated audio transcription/forced-alignment through a configured backend provider.

See [the detailed roadmap](docs/ROADMAP.md) for the implementation phases and acceptance criteria.

## NIMO integration

Wavy uses the documented `POST /api/nimo/chat` endpoint for optional text-only formatting assistance. Set `VITE_NIMO_API_BASE_URL` in a local `.env` to the NIMO-CORE base URL (for example `http://localhost:8787`). This variable must contain only a base URL, never a secret. Lyrics are sent only after the user explicitly clicks **NIMO assist**, and the result is marked as an unverified draft that must be reviewed.

The current NIMO chat contract does not accept audio bytes and is not a forced-alignment API. Wavy does not claim it transcribes audio or verifies timestamps. Dedicated transcription/forced alignment needs a separate backend provider adapter. Basic playback, visualization, and manual lyric sync work without NIMO.
