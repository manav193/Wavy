# Wavy — Engineering Roadmap

This roadmap prioritizes a reliable local-first music and lyric-video workflow. Items are not considered complete until the relevant tests and device/browser checks pass.

## Current baseline

- [x] React + TypeScript + Vite foundation.
- [x] Local audio playback, seeking, volume, and five Canvas visualizer modes.
- [x] LRC import/export, line-level timing editor, preview offset, and NIMO text-formatting adapter.
- [x] MP3/audio file selection and browser-supported MP4/WebM/MOV/M4V media input; media audio is routed to Web Audio analysis.
- [ ] Word-level karaoke animation engine — discussed/design direction only; not yet shipped.
- [ ] Audio extraction/export — not yet shipped. Media playback/analysis is not the same as creating a separate downloadable audio file.
- [ ] Full lyric-video rendering/export — not yet shipped.

## Phase 1 — Word-level karaoke animation engine

**Goal:** Make each word animate in sync with the song, with selectable independent presets.

- [ ] Add a typed animation preset contract and registry.
- [ ] Ship Word Pop + Highlight, Bounce, Progressive Color Fill, Blur/Fade Reveal, and Slide/Stagger Reveal presets.
- [ ] Add word timing data to the lyric model without breaking existing LRC line timings.
- [ ] Support manually assigning word start/end times and an estimated-timing mode clearly marked as estimated.
- [ ] Respect reduced-motion preferences and provide font, scale, color, spacing, and intensity controls.
- [ ] Test deterministic active-word selection at boundaries and during seeking.

**Acceptance:** changing presets does not alter lyric timing; seeking updates the active word deterministically; untimed lyrics remain usable.

## Phase 2 — Media engine and audio extraction

**Goal:** Import audio-only files and videos, then produce a real downloadable audio file from a video source.

- [x] Add browser-supported video containers as media inputs and route their audio through Web Audio analysis.
- [x] Add a dedicated FFmpeg.wasm conversion adapter for client-side conversion where device memory permits.
- [x] Extract the first audio stream from supported video containers to downloadable 44.1 kHz stereo PCM WAV. MP3 encoding remains pending.
- [x] Provide progress, cancellation, codec/format errors, and a 200 MB source-file guard.
- [x] Keep source files local by default; the conversion does not upload media.
- [ ] Add browser-level media fixtures/tests for unsupported codecs, silent videos, cancellation, and output validity. Pure file-helper tests are included; end-to-end export verification is still pending.

**Acceptance status:** the WAV extraction flow and download are implemented, but the phase is not considered complete until browser-level fixture tests verify output duration/audio content and edge cases. MP3 output is also pending.

## Phase 3 — Lyric-video studio timeline

- [ ] Add project settings: 9:16, 16:9, and 1:1; resolution and frame rate.
- [ ] Add track lanes for audio, background/visualizer, lyrics, and optional overlays.
- [ ] Add timeline zoom, snapping, split/move, duration handles, and preview seeking.
- [ ] Reuse the same visualizer and lyric animation renderers for preview and export.
- [ ] Add background gradients/images/video, font controls, text outlines/shadows, and safe-area guides.

**Acceptance:** timeline edits persist in a project file and preview at the correct timestamp.

## Phase 4 — MP4 lyric-video export

- [ ] Implement a renderer/export adapter with capability detection.
- [ ] Render frames from a deterministic project clock rather than relying only on wall-clock CSS animation.
- [ ] Mux rendered frames and audio into MP4 where the selected encoder is available; offer a clearly labeled supported fallback if not.
- [ ] Show render progress, estimate storage needs, allow cancellation, and revoke temporary object URLs.
- [ ] Verify audio/video duration alignment, frame-rate consistency, and output playback.

**Acceptance:** the downloaded video includes the selected animation, visualizer, and audio, and stays synchronized at the beginning, middle, and end.

## Phase 5 — Transcription and word alignment

- [ ] Define a provider adapter for speech/music transcription and forced alignment.
- [ ] Keep provider credentials server-side; never put API secrets in Vite environment variables.
- [ ] Request explicit user consent before sending audio to a remote service.
- [ ] Preserve original lyrics and show AI results as editable, confidence-labeled drafts.
- [ ] Add multilingual and instrumental/no-vocal handling.

**Acceptance:** the app distinguishes detected lyrics from user-provided lyrics and never presents estimated timestamps as verified.

## Phase 6 — Android and release hardening

- [ ] Package the web app with Capacitor and test file pickers, playback, storage, and export on physical Android devices.
- [ ] Use capability adapters for browser vs. Android encoder differences.
- [ ] Add accessibility checks, mobile memory limits, error reporting without media contents, and offline behavior.
- [ ] Add CI coverage for typecheck, unit tests, production build, and media-adapter tests.
- [ ] Document supported codecs/devices and release process.

## Architecture principles

1. **Adapters over lock-in:** media conversion, rendering, transcription, and storage should have independent interfaces.
2. **Local-first:** media stays on device unless the user explicitly chooses a remote provider.
3. **No false capability claims:** playback is not extraction; preview is not export; line timing is not word alignment.
4. **One rendering engine:** preview and export should share the same animation logic.
5. **Test the artifact:** verify the exported media itself, not only that a download was triggered.
