import { useEffect, useRef, useState } from "react";
import { Download, Film, LoaderCircle, Square, X } from "lucide-react";
import type { LyricLine } from "../lyrics/lrc";
import { getCanvasDimensions, type StudioProject } from "./model";
import type { VisualizerMode } from "../visualizer/AudioCanvas";

type ExportStatus = "idle" | "rendering" | "done" | "error" | "cancelled";
interface VideoExporterProps {
  project: StudioProject;
  lyricLines: LyricLine[];
  trackUrl: string;
  duration: number;
  visualizerMode: VisualizerMode;
}
interface RenderFrameOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  time: number;
  project: StudioProject;
  lyricLines: LyricLine[];
  mode: VisualizerMode;
  sample: number;
  analyser?: AnalyserNode | null;
}

export function activeLineAt(lines: LyricLine[], timeSeconds: number): LyricLine | null {
  let active: LyricLine | null = null;
  for (const line of lines) {
    if (line.startMs < 0) continue;
    if (line.startMs / 1000 <= timeSeconds) active = line;
    else break;
  }
  return active;
}

export function preferredRecordingMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

function backgroundColors(background: StudioProject["background"]): [string, string, string] {
  switch (background) {
    case "aurora": return ["#071b17", "#126b50", "#8bffb1"];
    case "sunset": return ["#261018", "#a43d45", "#ffd08a"];
    case "paper": return ["#f4efe4", "#ded0b6", "#25241f"];
    default: return ["#07100c", "#123b2a", "#80ffb3"];
  }
}

export function drawProjectFrame(options: RenderFrameOptions): void {
  const { ctx, width, height, time, project, lyricLines, mode, sample } = options;
  const [base, glow, accent] = backgroundColors(project.background);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, base);
  gradient.addColorStop(1, glow);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const margin = width * 0.07;
  ctx.strokeStyle = project.background === "paper" ? "rgba(37,36,31,.12)" : "rgba(180,255,206,.12)";
  ctx.lineWidth = Math.max(1, width / 1600);
  const gridStep = Math.max(24, width / 48);
  for (let x = 0; x <= width; x += gridStep) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y <= height; y += gridStep) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  const visualizer = project.showVisualizer && project.clips.some((clip) =>
    clip.track === "visualizer" && clip.enabled && time >= clip.startSec && time < clip.startSec + clip.durationSec,
  );
  if (visualizer) {
    const count = Math.min(96, Math.max(32, Math.floor(width / 18)));
    const frequencyData = options.analyser ? new Uint8Array(options.analyser.frequencyBinCount) : null;
    if (frequencyData && options.analyser) options.analyser.getByteFrequencyData(frequencyData);
    const gap = Math.max(3, width / 400);
    const barWidth = (width - margin * 2 - gap * (count - 1)) / count;
    const centerY = height * 0.43;
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = width * 0.012;
    ctx.fillStyle = accent;
    for (let i = 0; i < count; i++) {
      // Time-seeded synthetic spectrum is deterministic and remains animated in export.
      const envelope = frequencyData
        ? Math.max(0.06, frequencyData[Math.floor(i * frequencyData.length / count)] / 255)
        : 0.18 + 0.82 * Math.abs(Math.sin(i * 0.19 + time * 2.4));
      const ripple = 0.45 + 0.55 * Math.abs(Math.sin(i * 0.071 + time * 5.2 + sample * 0.001));
      const modeScale = mode === "decay" ? Math.exp(-((i % 18) / 18) * 2) : mode === "stepped" ? Math.round(envelope * 4) / 4 : 1;
      const barHeight = Math.max(height * 0.008, height * 0.18 * envelope * ripple * modeScale);
      const x = margin + i * (barWidth + gap);
      if (mode === "oscilloscope" || mode === "sawtooth") {
        const y = centerY + Math.sin(i * (mode === "sawtooth" ? 0.44 : 0.16) + time * 3) * barHeight * 0.8;
        ctx.fillRect(x, y, barWidth, Math.max(2, height * 0.003));
      } else {
        ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
      }
    }
    ctx.restore();
  }

  if (project.showLyrics) {
    const line = activeLineAt(lyricLines, time);
    const text = line?.text ?? "";
    if (text) {
      const fontSize = Math.round(Math.min(width * 0.058, height * 0.085));
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${fontSize}px Manrope, Arial, sans-serif`;
      ctx.lineJoin = "round";
      ctx.strokeStyle = project.background === "paper" ? "rgba(255,255,255,.92)" : "rgba(0,0,0,.8)";
      ctx.lineWidth = Math.max(3, fontSize * 0.13);
      ctx.shadowColor = project.background === "paper" ? "rgba(0,0,0,.16)" : "rgba(0,0,0,.45)";
      ctx.shadowBlur = fontSize * 0.35;
      const maxWidth = width * 0.84;
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let current = "";
      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (ctx.measureText(next).width > maxWidth && current) {
          lines.push(current);
          current = word;
        } else current = next;
      }
      if (current) lines.push(current);
      const lineHeight = fontSize * 1.25;
      const centerY = height * 0.72;
      lines.slice(0, 3).forEach((value, index) => {
        const y = centerY + (index - (Math.min(lines.length, 3) - 1) / 2) * lineHeight;
        ctx.strokeText(value, width / 2, y, maxWidth);
        ctx.fillStyle = accent;
        ctx.fillText(value, width / 2, y, maxWidth);
      });
      ctx.restore();
    }
  }

  for (const clip of project.clips) {
    if (clip.track !== "overlay" || !clip.enabled || time < clip.startSec || time >= clip.startSec + clip.durationSec || !clip.text?.trim()) continue;
    const fontSize = Math.round(Math.min(width * 0.045, height * 0.07));
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${fontSize}px Manrope, Arial, sans-serif`;
    ctx.fillStyle = project.background === "paper" ? "#25241f" : "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,.6)";
    ctx.shadowBlur = fontSize * 0.25;
    ctx.fillText(clip.text, width / 2, height * 0.17, width * 0.84);
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = project.background === "paper" ? "rgba(37,36,31,.65)" : "rgba(210,255,224,.68)";
  ctx.font = `${Math.max(12, Math.round(width * 0.009))}px monospace`;
  ctx.textAlign = "right";
  ctx.fillText(`WAVY  •  ${time.toFixed(2)}s`, width - margin, height - margin * 0.42);
  ctx.restore();
}

export default function VideoExporter({ project, lyricLines, trackUrl, duration, visualizerMode }: VideoExporterProps) {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [outputUrl, setOutputUrl] = useState("");
  const [outputName, setOutputName] = useState("");
  const cancelRef = useRef<(() => void) | null>(null);
  const outputUrlRef = useRef("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      cancelRef.current?.();
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
      if (audioContextRef.current) void audioContextRef.current.close();
    };
  }, []);

  const cancelExport = () => {
    cancelRef.current?.();
    cancelRef.current = null;
    setStatus("cancelled");
    setMessage("Export cancelled. Temporary media tracks were released.");
  };

  const startExport = async () => {
    if (!trackUrl) {
      setStatus("error");
      setMessage("Import an audio or video file before exporting.");
      return;
    }
    if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
      setStatus("error");
      setMessage("This browser does not support canvas recording. Try an up-to-date desktop Chromium browser.");
      return;
    }
    const mimeType = preferredRecordingMimeType();
    if (!mimeType) {
      setStatus("error");
      setMessage("No supported MP4 or WebM recording encoder is available in this browser.");
      return;
    }
    const exportDuration = Math.min(60 * 60, duration > 0 ? duration : 0);
    if (!exportDuration) {
      setStatus("error");
      setMessage("The source media duration is not available yet. Wait for the track metadata to load.");
      return;
    }
    const dimensions = getCanvasDimensions(project.aspectRatio, project.resolution);
    const pixels = dimensions.width * dimensions.height;
    const estimatedBytes = Math.round(exportDuration * ((pixels > 2_000_000 ? 5_000_000 : 3_000_000) + 192_000) / 8 * 1.2);
    if (estimatedBytes > 1_500_000_000) {
      setStatus("error");
      setMessage("Estimated output is too large for a safe browser export. Use a shorter source or 720p.");
      return;
    }

    setStatus("rendering");
    setProgress(0);
    setMessage(`Preparing ${dimensions.width}×${dimensions.height} at ${project.frameRate} FPS. Estimated output: ${(estimatedBytes / 1_000_000).toFixed(0)} MB or less.`);
    if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    outputUrlRef.current = "";
    setOutputUrl("");

    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      setStatus("error"); setMessage("Could not initialize the 2D render canvas."); return;
    }
    let canvasStream = canvas.captureStream(0);
    let canvasTrack = canvasStream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
    if (!canvasTrack || typeof canvasTrack.requestFrame !== "function") {
      canvasStream.getTracks().forEach((track) => track.stop());
      canvasStream = canvas.captureStream(project.frameRate);
      canvasTrack = canvasStream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
    }
    const audio = document.createElement("audio");
    audio.preload = "auto";
    audio.src = trackUrl;
    audio.crossOrigin = "anonymous";
    audio.volume = 1;
    audio.muted = false;
    let recorder: MediaRecorder | null = null;
    let raf = 0;
    let finished = false;
    let cancelled = false;
    let failed = false;
    let chunks: BlobPart[] = [];
    let lastProgress = 0;
    let lastRequestedFrame = -1;
    let audioStream: MediaStream | null = null;
    let combinedStream: MediaStream | null = null;
    let exportContext: AudioContext | null = null;
    let exportAnalyser: AnalyserNode | null = null;
    const cleanup = () => {
      cancelAnimationFrame(raf);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      canvasStream.getTracks().forEach((track) => track.stop());
      audioStream?.getTracks().forEach((track) => track.stop());
      combinedStream?.getTracks().forEach((track) => track.stop());
      if (exportContext) void exportContext.close();
      if (audioContextRef.current === exportContext) audioContextRef.current = null;
      cancelRef.current = null;
    };
    const fail = (error: unknown) => {
      if (finished) return;
      failed = true;
      finished = true;
      if (recorder?.state === "recording") recorder.stop();
      cleanup();
      if (aliveRef.current) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Video export failed. Try a shorter clip or lower resolution.");
      }
    };
    cancelRef.current = () => {
      if (finished) return;
      cancelled = true;
      finished = true;
      if (recorder?.state === "recording") recorder.stop();
      cleanup();
    };

    try {
      // Resume the Web Audio context directly from the export button gesture, before
      // awaiting media metadata, so autoplay policies do not block the recording.
      let resumeContext: Promise<void> | null = null;
      const AudioContextCtor = window.AudioContext;
      if (AudioContextCtor) {
        exportContext = new AudioContextCtor();
        audioContextRef.current = exportContext;
        exportAnalyser = exportContext.createAnalyser();
        exportAnalyser.fftSize = 2048;
        exportAnalyser.smoothingTimeConstant = 0.72;
        const mediaSource = exportContext.createMediaElementSource(audio);
        const recordingDestination = exportContext.createMediaStreamDestination();
        mediaSource.connect(exportAnalyser);
        exportAnalyser.connect(recordingDestination);
        exportAnalyser.connect(exportContext.destination);
        audioStream = recordingDestination.stream;
        if (exportContext.state === "suspended") resumeContext = exportContext.resume();
      } else {
        const captureAudio = (audio as HTMLAudioElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream }).captureStream
          ?? (audio as HTMLAudioElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream;
        if (!captureAudio) throw new Error("This browser cannot capture source audio. Try an up-to-date desktop Chromium browser.");
        audioStream = captureAudio.call(audio);
      }
      const metadataReady = new Promise<void>((resolve, reject) => {
        audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
        audio.addEventListener("error", () => reject(new Error("The source media could not be decoded for export.")), { once: true });
      });
      audio.load();
      await Promise.all([metadataReady, resumeContext ?? Promise.resolve()]);
      if (cancelled || finished) { cleanup(); return; }
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) throw new Error("The source media has no readable duration.");
      const targetDuration = Math.min(exportDuration, audio.duration);
      combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioStream.getAudioTracks()]);
      if (!combinedStream.getAudioTracks().length) throw new Error("The browser did not expose an audio track for recording.");
      recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: pixels > 2_000_000 ? 5_000_000 : 3_000_000, audioBitsPerSecond: 192_000 });
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => fail(new Error("The browser media encoder failed while recording."));
      recorder.onstop = () => {
        if (cancelled || failed) { chunks = []; cleanup(); return; }
        finished = true;
        cleanup();
        const blob = new Blob(chunks, { type: recorder?.mimeType || mimeType });
        chunks = [];
        if (!blob.size) {
          if (aliveRef.current) { setStatus("error"); setMessage("The encoder returned an empty video file."); }
          return;
        }
        const extension = blob.type.includes("mp4") ? "mp4" : "webm";
        const name = `${project.name.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "wavy-video"}.${extension}`;
        const url = URL.createObjectURL(blob);
        outputUrlRef.current = url;
        if (aliveRef.current) {
          setOutputUrl(url);
          setOutputName(name);
          setProgress(100);
          setStatus("done");
          setMessage(`Rendered ${targetDuration.toFixed(2)} seconds. Container: ${extension.toUpperCase()}. Download and verify playback before publishing.`);
        } else URL.revokeObjectURL(url);
      };
      const render = () => {
        if (finished) return;
        const time = Math.min(audio.currentTime, targetDuration);
        const frameIndex = Math.floor(time * project.frameRate);
        if (frameIndex > lastRequestedFrame) {
          drawProjectFrame({ ctx, width: dimensions.width, height: dimensions.height, time, project, lyricLines, mode: visualizerMode, sample: frameIndex, analyser: exportAnalyser });
          if (canvasTrack && typeof canvasTrack.requestFrame === "function") canvasTrack.requestFrame();
          lastRequestedFrame = frameIndex;
        }
        const nextProgress = Math.min(99, Math.floor(time / targetDuration * 100));
        if (nextProgress !== lastProgress && aliveRef.current) {
          lastProgress = nextProgress;
          setProgress(nextProgress);
        }
        if (time >= targetDuration || audio.ended) {
          if (recorder?.state === "recording") recorder.stop();
          return;
        }
        raf = requestAnimationFrame(render);
      };
      if (cancelled || finished) { cleanup(); return; }
      audio.currentTime = 0;
      recorder.start(1000);
      await audio.play();
      render();
      audio.addEventListener("ended", () => {
        if (recorder?.state === "recording") recorder.stop();
      }, { once: true });
    } catch (error) {
      fail(error);
    }
  };

  return (
    <div className="video-exporter" aria-label="Video export">
      <div className="video-exporter-heading"><span><Film size={15} /> FINAL VIDEO RENDER</span><span className="small-status">PHASE 4</span></div>
      <p>Render the project timeline with synchronized source audio, lyric cues, the selected visualizer style, background, and enabled text overlays.</p>
      <div className="video-exporter-meta">
        <span>{duration > 0 ? `${duration.toFixed(1)}s source` : "Waiting for media metadata"}</span>
        <span>{project.resolution}p · {project.frameRate} FPS · {project.aspectRatio}</span>
      </div>
      {status === "rendering" && <div className="video-export-progress" role="status" aria-live="polite"><div className="video-export-progress-track"><span style={{ width: `${progress}%` }} /></div><div><span>{progress}%</span><span>{message}</span></div></div>}
      {message && status !== "rendering" && <div className={status === "error" ? "lyrics-warning" : "lyrics-notice"} role={status === "error" ? "alert" : "status"}>{message}</div>}
      <div className="video-exporter-actions">
        {status === "rendering"
          ? <button className="secondary-action" onClick={cancelExport}><Square size={13} /> Cancel render</button>
          : <button className="primary-action" onClick={() => void startExport()} disabled={!trackUrl || duration <= 0}><Film size={14} /> {status === "done" ? "Render again" : "Render video"}</button>}
        {status === "rendering" && <span className="video-export-running"><LoaderCircle size={13} /> Recording frames in real time</span>}
        {status === "cancelled" && <span className="small-status"><X size={12} /> Cancelled</span>}
        {status === "done" && outputUrl && <a className="secondary-action" href={outputUrl} download={outputName}><Download size={14} /> Download {outputName}</a>}
      </div>
    </div>
  );
}
