# Wavy Lyrics Pipeline

## Timed lyrics

Wavy accepts user-pasted lyrics and standard LRC files. LRC timestamps are parsed into millisecond offsets; multiple timestamps per source line, common metadata tags, signed `[offset:]`, and decimal/centisecond fractions are supported. Imported lines are sorted by timestamp, while untimed text remains editable but is excluded from active-line selection. Invalid timestamps are reported rather than silently treated as accurate.

The HTML audio playback clock is the source of truth. Active-line selection is deterministic. Users can seek to a timed line, edit a start timestamp, stamp the current playback position onto a selected line, adjust a temporary preview offset, and export timed lines to LRC. The imported LRC offset is applied once during parsing; the preview offset is separate and temporary.

## NIMO boundary

Wavy calls the documented `POST /api/nimo/chat` endpoint only when `VITE_NIMO_API_BASE_URL` is configured. This is optional text assistance for formatting user-provided lyrics. Its output is an unverified draft requiring user review.

The current NIMO chat contract does not accept audio bytes and is not a forced-alignment API. Wavy does not claim NIMO transcribed a song or verified lyric timing. Audio transcription/forced alignment should be added later through an explicit backend provider adapter with consent, file-size limits, and provider-specific tests. Never place provider secrets in Vite client environment variables.

## Privacy and safety

- Lyrics are sent to NIMO only after the user clicks the assist action.
- The request is bounded to 6,000 characters and has a 15-second timeout where supported.
- No raw audio is uploaded by this feature.
- Original lyrics are not overwritten when AI assistance fails or returns a draft.
- Applying a NIMO formatting draft resets line timings because its line segmentation may differ; the UI explicitly warns about this.
- Use only user-provided or appropriately licensed lyrics; do not scrape restricted sources.
