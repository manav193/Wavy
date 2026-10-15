import { useEffect, useRef, useState } from "react";
import { AudioLines, Download, LoaderCircle, Square, Video } from "lucide-react";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { getExtractionInputName, formatBytes, MAX_EXTRACTION_BYTES } from "./audio-extraction";

interface AudioExtractorProps {
  sourceFile: File;
}

const CORE_BASE_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";

export default function AudioExtractor({ sourceFile }: AudioExtractorProps) {
  const ffmpegRef = useRef<import("@ffmpeg/ffmpeg").FFmpeg | null>(null);
  const cancelledRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [outputUrl, setOutputUrl] = useState("");
  const [outputName, setOutputName] = useState("");

  useEffect(() => () => { ffmpegRef.current?.terminate(); }, []);
  useEffect(() => () => { if (outputUrl) URL.revokeObjectURL(outputUrl); }, [outputUrl]);

  const cancel = () => {
    cancelledRef.current = true;
    ffmpegRef.current?.terminate();
    ffmpegRef.current = null;
    setBusy(false);
    setProgress(0);
    setStatus("");
    setError("Extraction cancelled. Your original file was not changed.");
  };

  const extractWav = async () => {
    if (busy) return;
    setError("");
    setStatus("");
    setProgress(0);
    if (sourceFile.size > MAX_EXTRACTION_BYTES) {
      setError(`This file is ${formatBytes(sourceFile.size)}. The in-browser extraction limit is ${formatBytes(MAX_EXTRACTION_BYTES)} to reduce memory failures.`);
      return;
    }
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setOutputUrl("");
    setOutputName("");
    setBusy(true);
    cancelledRef.current = false;
    let ffmpeg: import("@ffmpeg/ffmpeg").FFmpeg | null = null;
    try {
      setStatus("Loading local conversion engine…");
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      if (cancelledRef.current) return;
      ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;
      ffmpeg.on("progress", ({ progress: ratio }) => {
        if (Number.isFinite(ratio)) setProgress(Math.max(0, Math.min(100, Math.round(ratio * 100))));
      });
      ffmpeg.on("log", ({ message }) => {
        if (/does not contain any stream|matches no streams|Output file is empty/i.test(message)) {
          setStatus("Checking source audio stream…");
        }
      });
      const coreURL = await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript");
      const wasmURL = await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm");
      if (cancelledRef.current) return;
      await ffmpeg.load({ coreURL, wasmURL });
      if (cancelledRef.current) return;
      setStatus("Preparing source media…");
      const inputName = getExtractionInputName(sourceFile.name);
      await ffmpeg.writeFile(inputName, await fetchFile(sourceFile));
      if (cancelledRef.current) return;
      setStatus("Extracting and encoding WAV…");
      const exitCode = await ffmpeg.exec([
        "-i", inputName,
        "-map", "0:a:0",
        "-vn",
        "-c:a", "pcm_s16le",
        "-ar", "44100",
        "-ac", "2",
        "-f", "wav",
        "extracted-audio.wav",
      ]);
      if (exitCode !== 0) throw new Error("The media engine could not decode this file. It may use an unsupported codec or contain no audio.");
      setStatus("Preparing download…");
      const result = await ffmpeg.readFile("extracted-audio.wav");
      if (typeof result === "string" || result.byteLength === 0) {
        throw new Error("The source did not produce a valid audio stream. Check that the video contains audio.");
      }
      const wavBlob = new Blob([new Uint8Array(result).buffer as ArrayBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(wavBlob);
      setOutputUrl(url);
      setOutputName(`${sourceFile.name.replace(/\.[^.]+$/, "") || "wavy-extracted-audio"}.wav`);
      setProgress(100);
      setStatus(`WAV ready · ${formatBytes(wavBlob.size)} · 44.1 kHz stereo PCM`);
    } catch (cause) {
      if (cancelledRef.current) return;
      const message = cause instanceof Error ? cause.message : "Unexpected conversion error.";
      setError(message.includes("SharedArrayBuffer") || message.includes("cross-origin")
        ? "The conversion engine could not start in this browser context. Try a current browser and a secure (HTTPS or localhost) origin."
        : message);
    } finally {
      ffmpeg?.terminate();
      if (ffmpegRef.current === ffmpeg) ffmpegRef.current = null;
      setBusy(false);
    }
  };

  return (
    <section className="info-card extraction-card" aria-labelledby="extractor-heading">
      <div className="card-heading">
        <span><AudioLines size={17} /> AUDIO EXTRACTION</span>
        <span className="small-status">LOCAL · WAV</span>
      </div>
      <div className="extractor-source">
        <span className="extractor-icon"><Video size={19} /></span>
        <div className="extractor-file">
          <strong id="extractor-heading">{sourceFile.name}</strong>
          <span>{formatBytes(sourceFile.size)} · source stays on this device</span>
        </div>
      </div>
      <p className="extractor-description">Extract the first audio stream from this video into a standard 44.1 kHz, 16-bit stereo WAV file. The conversion runs in your browser using FFmpeg WebAssembly; no media upload is performed by Wavy.</p>
      <div className="extractor-actions">
        <button className="primary-action" onClick={() => void extractWav()} disabled={busy}>
          {busy ? <LoaderCircle size={14} className="extractor-spinner" /> : <AudioLines size={14} />}
          {busy ? "Extracting…" : "Extract audio to WAV"}
        </button>
        {busy && <button className="secondary-action" onClick={cancel}><Square size={13} /> Cancel</button>}
        {outputUrl && <a className="secondary-action" href={outputUrl} download={outputName}><Download size={14} /> Download WAV</a>}
      </div>
      {busy && <div className="extractor-progress" role="status" aria-live="polite">
        <div className="extractor-progress-label"><span>{status}</span><span>{progress}%</span></div>
        <progress max={100} value={progress} aria-label="Audio extraction progress" />
        <p>Large files can need several times their source size in memory. Keep this tab open while extraction runs.</p>
      </div>}
      {status && !busy && <div className="lyrics-notice" role="status">{status}</div>}
      {error && <div className="lyrics-warning" role="alert">{error}</div>}
      <div className="extractor-footnote">Current output: WAV only. MP3 encoding and additional codec coverage remain separate verified work; files over 200 MB are blocked to protect browser memory.</div>
    </section>
  );
}
