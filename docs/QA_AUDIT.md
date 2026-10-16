# Wavy Code QA Audit

Audit date: 2026-10-16
Scope: React/TypeScript app, Studio timeline, lyrics parser/editor, NIMO client, FFmpeg WebAssembly extraction, Vite configuration, project dependencies, unit tests, Chromium E2E tests, and GitHub Actions.

## Changes verified

1. **Lyrics editor state retention:** hiding the lyrics workspace no longer discards imported or pasted lyrics.
2. **Timeline/lyrics synchronization:** timeline cue edits flow back into the lyrics editor and active preview.
3. **Project schema and persistence:** versioned project JSON validation, browser autosave, import/export, duplicate-ID rejection, and clip-boundary normalization.
4. **Canvas sizing:** 1080p landscape is 1920×1080, portrait is 1080×1920, and square is 1080×1080.
5. **Shared visualizer renderer:** player and Studio preview use the same analyser-backed Canvas component.
6. **MP3 download correctness:** the visible download label, filename extension, and Blob MIME type match the selected WAV/MP3 format.
7. **Vite/FFmpeg compatibility:** use the FFmpeg ESM core build with Vite and set cross-origin isolation headers for the local browser runtime. Runtime failures preserve useful error details instead of collapsing non-Error worker rejections into a generic message.
8. **Reproducible installs:** committed `package-lock.json`; CI uses `npm ci`.
9. **Browser regression suite:** Playwright tests cover Studio settings autosave, overlay drag/resize, lyric timestamp edits, project JSON roundtrip, valid WAV/MP3 extraction, silent/invalid inputs, and cancellation.
10. **Audio artifact validation:** generated three-second video/audio fixtures are converted in Chromium; ffprobe verifies codec, duration, 44.1 kHz sample rate, and stereo channels, while FFmpeg volume analysis verifies the output contains an audible signal.\n11. **Phase 4 video renderer:** added a project-clocked Canvas renderer that draws background, timed lyric cues, enabled overlays, and a selected audio-reactive visualizer. It captures the source audio stream, records canvas frames at the selected frame rate, detects MP4 support and falls back to WebM, displays progress and size estimates, supports cancellation, and cleans up temporary streams/object URLs.\n12. **Video artifact E2E:** a short real media fixture is rendered in Chromium; ffprobe checks that the downloaded artifact contains both video and audio streams, expected duration, dimensions, and frame rate.

## Validation

- GitHub Actions run: [Wavy CI — ESM FFmpeg core and full Chromium/media E2E](https://github.com/manav193/Wavy/actions/runs/38848969521)
- Verified checks: dependency install, TypeScript typecheck, Vitest unit tests, production build, Chromium browser E2E, and actual WAV/MP3 output inspection.
- The browser suite runs with a single worker to keep FFmpeg memory usage predictable. Failed runs retain screenshots and traces as a workflow artifact.

## Remaining product gaps

- Word-level karaoke timing remains estimated from adjacent line timings unless explicit word timings are supplied. There is no forced alignment/transcription engine.
- Studio project JSON stores timeline metadata only; media bytes are not embedded and source media must be reselected after import.
- Audio clip trimming, image/video backgrounds, advanced typography/safe-area guides, and deterministic final MP4 rendering are not implemented.
- Physical Android/Capacitor validation, mobile touch-specific timeline tests, accessibility audit, and low-memory device testing remain release requirements.
- Video capture runs in real time. Longer-form audio/video synchronization, browser encoder differences, and physical Android export still need validation.

## QA policy

A UI click or a generated download event is not enough to mark media export complete. The actual artifact must be inspected for format, duration, frame rate, video/audio streams, and non-silent audio. The current Chromium E2E validates the short exported artifact; it does not prove every browser/Android encoder or long-form synchronization. Estimated lyric timing is not verified word alignment.
