# Wavy — Engineering Roadmap

This roadmap prioritizes a reliable local-first music and lyric-video workflow. Items are not considered complete until the relevant tests and device/browser checks pass.

## Current baseline

- [x] React + TypeScript + Vite foundation.
- [x] Local audio playback, seeking, volume, and five Canvas visualizer modes.
- [x] LRC import/export, line-level timing editor, preview offset, and NIMO text-formatting adapter.
- [x] MP3/audio file selection and browser-supported MP4/WebM/MOV/M4V media input; media audio is routed to Web Audio analysis.
- [x] Five selectable karaoke preview presets with estimated line-interval word activation; true word timestamps and forced alignment remain pending.
- [x] Local FFmpeg.wasm audio extraction to WAV and MP3; Chromium E2E validates output codec, duration, 44.1 kHz stereo metadata, and audible samples.
- [x] Browser-based Studio video export implementation with project-clocked canvas frames, captured source audio, animated lyric cues, audio-reactive visualizer, progress/cancel, output-size guard, and MP4/WebM encoder detection. Actual browser artifact validation is in CI.

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
- [x] Extract the first audio stream from supported video containers to downloadable 44.1 kHz stereo PCM WAV. MP3 encoding option added via libmp3lame; output verification on the loaded WebAssembly build remains pending.
- [x] Provide progress, cancellation, codec/format errors, and a 200 MB source-file guard.
- [x] Keep source files local by default; the conversion does not upload media.
- [x] Add browser-level media fixtures/tests for valid WAV/MP3 output, invalid media, silent videos, cancellation, and output validity.

**Acceptance status:** the WAV/MP3 flow and downloadable outputs pass Chromium E2E checks against generated video fixtures. Codec, duration, sample rate, channel count, and non-silent audio are inspected with ffprobe/FFmpeg. Unsupported codecs can still vary by source and browser/device.

## Phase 3 — Lyric-video studio timeline

- [x] Add project settings: 9:16, 16:9, and 1:1; 720p/1080p resolution presets and 24/30/60 FPS.
- [x] Add separate audio, visualizer, lyrics-cue, and text-overlay timeline lanes.
- [x] Add timeline zoom, 250 ms snapping, draggable/resizable visualizer and overlay clips, lyric cue seeking and direct timestamp editing.
- [x] Add a composition preview for background presets, active lyric cue, timed text overlays, and visualizer-layer timing.
- [x] Autosave project metadata locally and support versioned `.wavy.json` project import/export with schema validation.
- [x] Add a deterministic project-clock renderer for final video frames; frame visuals and lyric cue selection are derived from media time rather than CSS animation.
- [ ] Add image/video backgrounds, typography controls, text outlines/shadows, safe-area guides, and more complete layer styling.

**Acceptance status:** Chromium E2E covers autosave/reload, overlay move/resize, lyric cue timestamp edits, and project JSON import/export. Final video rendering, media relinking, audio trimming, mobile touch behavior, and full accessibility testing remain outstanding; a project JSON is not a rendered video.

## Phase 4 — MP4 lyric-video export

- [ ] Implement a renderer/export adapter with capability detection.
- [ ] Render frames from a deterministic project clock rather than relying only on wall-clock CSS animation.
- [ ] Mux rendered frames and audio into MP4 where the selected encoder is available; offer a clearly labeled supported fallback if not.
- [ ] Show render progress, estimate storage needs, allow cancellation, and revoke temporary object URLs.
- [ ] Verify audio/video duration alignment, frame-rate consistency, and output playback.

**Implementation status:** browser-based recording now exports a real playable video with source audio, lyric cues, the selected visualizer mode, background, and enabled overlays. MP4 is used only when the browser reports a compatible encoder; WebM is the supported fallback. The short-fixture Chromium E2E checks the downloaded artifact itself.\n\n**Known limitations:** capture runs in real time, so a three-minute song takes about three minutes to export. The renderer uses a deterministic synthetic spectrum when the Web Audio analyser is unavailable. Image/video backgrounds, clip trimming, word-level forced alignment, and Android/browser compatibility checks remain outside this phase.

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
- [x] Add CI coverage for typecheck, unit tests, production build, Chromium E2E, and media artifact verification.
- [ ] Document supported codecs/devices and release process.

## Architecture principles

1. **Adapters over lock-in:** media conversion, rendering, transcription, and storage should have independent interfaces.
2. **Local-first:** media stays on device unless the user explicitly chooses a remote provider.
3. **No false capability claims:** playback is not extraction; preview is not export; line timing is not word alignment.
4. **One rendering engine:** preview and export should share the same animation logic.
5. **Test the artifact:** verify the exported media itself, not only that a download was triggered.
