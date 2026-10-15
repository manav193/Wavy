# Wavy Code QA Audit

Audit date: 2026-10-15
Scope: repository tree, React/TypeScript application, lyrics parser/editor, NIMO client, media extraction adapter, styles, project configuration, tests, and GitHub Actions workflow.

## Findings and changes made

### Fixed in this pass

1. **Lyrics editor state was lost when hidden.** The app conditionally unmounted the editor, discarding imported/pasted lyrics when the Lyrics navigation button was toggled. The editor now remains mounted inside a hidden wrapper, and its current line model is mirrored into Studio.
2. **Timeline and lyrics editor were disconnected.** Added a timing-change bridge so a lyric cue adjusted from Studio updates the source lyrics editor and active preview.
3. **Project settings and timeline had no durable project contract.** Added a versioned, typed project schema, validation on import, local browser autosave, and `.wavy.json` import/export.
4. **Canvas dimensions needed conventional output-height semantics.** 1080p landscape maps to 1920×1080; portrait maps to 1080×1920; square maps to 1080×1080.
5. **Timeline ruler/playhead alignment.** Adjusted ruler offset and playhead placement to account for the sticky track-label column.
6. **Duplicated visualizer implementation.** Extracted the Canvas renderer into a reusable component and now use the same analyser-backed renderer in the player and Studio preview.
7. **Project-import hardening.** Rejects duplicate clip IDs and clamps imported clips to the current project duration.
8. **Type safety.** Imported project settings are narrowed only after validation; timeline pointer interactions use explicit React pointer event types.
9. **Regression tests.** Added project schema, dimension, snapping, clip-boundary, import-validation, and media-helper unit tests.

### Existing architecture reviewed

- Audio/video playback uses a browser media element and Web Audio analyser; it does not require NIMO.
- Lyrics use LRC millisecond timings. The word-level karaoke preview still estimates word timing from adjacent line intervals; it is not forced alignment.
- NIMO is an optional text-only formatting assist and its response is presented as an unverified draft.
- Video audio extraction is a client-side FFmpeg WebAssembly flow. The implementation is not equivalent to verified output until browser fixtures validate the resulting WAV/MP3 files.
- The Studio preview shares the live Canvas audio visualizer and follows the current playback clock for lyric cues and overlays. It is not the Phase 4 deterministic MP4 renderer.

## Known gaps / follow-up

- `package-lock.json` is absent. CI currently uses `npm install`, so dependency resolution is not fully reproducible. Add a generated lockfile and switch CI to `npm ci` as a separate dependency-management task.
- Browser-level end-to-end tests are not configured yet. Unit tests do not prove pointer dragging, mobile touch behavior, media decoding, FFmpeg encoder availability, or output synchronization.
- The current project JSON stores settings and timeline metadata only. It does not embed media bytes or automatically relink the source file on project import.
- Audio clip trimming and actual rendered audio start/end are not implemented.
- Image/video backgrounds, advanced typography, safe-area guides, and deterministic render/export are still pending.
- Studio local autosave can be unavailable when browser storage is disabled or quota is exceeded; the UI prompts the user to export a JSON backup.
- Full browser accessibility, mobile performance, and physical Android testing remain release requirements.

## Validation status

GitHub Actions typecheck/test/build checks are triggered by pushes. Their results should be checked against the latest commit before calling the release verified. No claim of successful browser E2E or media-output validation is made by this audit document.