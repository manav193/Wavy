import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, Disc3, FileAudio, Headphones, ListMusic,
  Pause, Play, Radio, SkipBack, SkipForward, Volume2, Waves,
} from "lucide-react";

type VisualizerMode = "oscilloscope" | "spectrum" | "stepped" | "sawtooth" | "decay";

const MODES: { id: VisualizerMode; label: string }[] = [
  { id: "oscilloscope", label: "Oscilloscope" },
  { id: "spectrum", label: "Spectrum" },
  { id: "stepped", label: "Stepped" },
  { id: "sawtooth", label: "Sawtooth" },
  { id: "decay", label: "Decay" },
];

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "00:00";
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function AudioCanvas({ analyser, mode, playing }: {
  analyser: AnalyserNode | null;
  mode: VisualizerMode;
  playing: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef(analyser);
  useEffect(() => { analyserRef.current = analyser; }, [analyser]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    let phase = 0;
    let lastWidth = 0;
    let lastHeight = 0;
    let data = new Uint8Array(1024);
    let freq = new Uint8Array(512);

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (w !== lastWidth || h !== lastHeight) {
        canvas.width = w; canvas.height = h; lastWidth = w; lastHeight = h;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cw = rect.width; const ch = rect.height;
      ctx.fillStyle = "#07100c";
      ctx.fillRect(0, 0, cw, ch);

      ctx.strokeStyle = "rgba(80, 180, 118, .12)";
      ctx.lineWidth = 1;
      for (let x = 0; x < cw; x += 24) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
      }
      for (let y = 0; y < ch; y += 24) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
      }
      ctx.strokeStyle = "rgba(112, 255, 168, .25)";
      ctx.beginPath(); ctx.moveTo(0, ch / 2); ctx.lineTo(cw, ch / 2); ctx.stroke();

      const activeAnalyser = analyserRef.current;
      if (activeAnalyser) {
        if (data.length !== activeAnalyser.fftSize) data = new Uint8Array(activeAnalyser.fftSize);
        if (freq.length !== activeAnalyser.frequencyBinCount) freq = new Uint8Array(activeAnalyser.frequencyBinCount);
        activeAnalyser.getByteTimeDomainData(data);
        activeAnalyser.getByteFrequencyData(freq);
      } else {
        for (let i = 0; i < data.length; i++) {
          data[i] = 128 + (playing ? 30 : 5) * Math.sin(i * 0.055 + phase) * Math.sin(i * 0.008 + phase * 0.3);
        }
        for (let i = 0; i < freq.length; i++) freq[i] = playing ? 35 + 30 * Math.abs(Math.sin(i * 0.11 + phase)) : 8;
      }
      phase += playing ? 0.055 : 0.008;

      ctx.save();
      ctx.strokeStyle = "#80ffb3";
      ctx.shadowColor = "#52ff98";
      ctx.shadowBlur = 13;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = "round";
      ctx.beginPath();

      if (mode === "spectrum") {
        const count = Math.min(80, freq.length);
        const gap = 3;
        const bw = (cw - gap * (count - 1)) / count;
        for (let i = 0; i < count; i++) {
          const value = freq[Math.floor(i * freq.length / count)] / 255;
          const bar = Math.max(2, value * ch * 0.78);
          ctx.fillStyle = i % 5 === 0 ? "#b7ff85" : "#70ffac";
          ctx.fillRect(i * (bw + gap), ch - bar, bw, bar);
        }
      } else if (mode === "stepped") {
        const count = 56;
        for (let i = 0; i < count; i++) {
          const idx = Math.floor(i * data.length / count);
          const x = i / (count - 1) * cw;
          const y = ch / 2 - (data[idx] - 128) / 128 * ch * 0.39;
          if (i === 0) ctx.moveTo(x, y);
          else { ctx.lineTo(x, y); }
          if (i < count - 1) {
            const nextX = (i + 1) / (count - 1) * cw;
            ctx.lineTo(nextX, y);
          }
        }
        ctx.stroke();
      } else if (mode === "sawtooth") {
        const cycles = 5;
        const samples = 240;
        for (let i = 0; i <= samples; i++) {
          const x = i / samples * cw;
          const t = (i / samples * cycles) % 1;
          const y = ch * 0.18 + t * ch * 0.64;
          if (i === 0) ctx.moveTo(x, y);
          else if (t < 0.08) { ctx.lineTo(x, ch * 0.18); }
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else if (mode === "decay") {
        const count = 200;
        for (let i = 0; i < count; i++) {
          const x = i / (count - 1) * cw;
          const t = (i / count * 3.2) % 1;
          const envelope = Math.exp(-t * 3.5);
          const idx = Math.floor(i / count * data.length);
          const audio = (data[idx] - 128) / 128;
          const y = ch / 2 - (audio * 0.24 + Math.sin(t * Math.PI * 2) * envelope * 0.28) * ch;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        for (let i = 0; i < data.length; i++) {
          const x = i / (data.length - 1) * cw;
          const y = ch / 2 - (data[i] - 128) / 128 * ch * 0.42;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [mode, playing]);

  return <canvas className="visual-canvas" ref={canvasRef} aria-label={`${mode} audio visualization`} />;
}

export default function App() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [trackName, setTrackName] = useState("Choose a track to begin");
  const [trackUrl, setTrackUrl] = useState("");
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [mode, setMode] = useState<VisualizerMode>("oscilloscope");
  const [lyrics, setLyrics] = useState("");
  const [lyricsOpen, setLyricsOpen] = useState(true);
  const [error, setError] = useState("");

  const setupAudioGraph = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    const AudioContextCtor = window.AudioContext;
    if (!AudioContextCtor) {
      setError("Web Audio API is not supported in this browser.");
      return;
    }
    let context = contextRef.current;
    if (!context) {
      context = new AudioContextCtor();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.78;
      const source = context.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(context.destination);
      contextRef.current = context;
      sourceRef.current = source;
      analyserRef.current = analyser;
    }
    if (context.state === "suspended") await context.resume();
  }, []);

  const chooseFile = (file?: File) => {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("audio/") && !/\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(file.name)) {
      setError("Choose a supported audio file (MP3, WAV, OGG, M4A, AAC, FLAC or OPUS where supported).");
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setTrackUrl(url);
    setTrackName(file.name.replace(/\.[^.]+$/, ""));
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = url;
      audioRef.current.load();
    }
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !trackUrl) {
      setError("Import an audio file first.");
      return;
    }
    try {
      await setupAudioGraph();
      if (audio.paused) await audio.play();
      else audio.pause();
      setError("");
    } catch {
      setError("Playback could not start. Try another audio file or browser.");
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [volume]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    if (contextRef.current) void contextRef.current.close();
  }, []);

  const seek = (value: number) => {
    if (audioRef.current) audioRef.current.currentTime = value;
  };

  const lyricLines = lyrics.split("\n").map((line) => line.trim()).filter(Boolean);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Waves size={23} /></span><span>WAVY<span className="brand-dot">.</span></span></div>
        <div className="nav-label">WORKSPACE</div>
        <button className="nav-item active"><Activity size={17} /> Player <span className="nav-indicator" /></button>
        <button className="nav-item" onClick={() => setLyricsOpen(!lyricsOpen)}><ListMusic size={17} /> Lyrics</button>
        <button className="nav-item" onClick={() => document.getElementById("audio-input")?.click()}><Disc3 size={17} /> Import track</button>
        <div className="sidebar-bottom"><div className="status-light" /> AUDIO ENGINE READY <span>v0.1</span></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><div className="eyebrow">PERSONAL AUDIO LAB</div><h1>Sound, visualized.</h1></div>
          <label className="import-button" htmlFor="audio-input"><FileAudio size={17} /> Import audio</label>
          <input id="audio-input" className="visually-hidden" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus" onChange={(event) => chooseFile(event.target.files?.[0])} />
        </header>

        <section className="monitor-panel">
          <div className="panel-topline"><span><span className="live-dot" /> LIVE SIGNAL MONITOR</span><span>CH 01 / AUDIO INPUT</span></div>
          <div className="monitor-title"><span>REACTOR</span><span className="monitor-separator">/</span><span>WAVEFORM ANALYSIS</span></div>
          <div className="visualizer-frame">
            <AudioCanvas analyser={analyserRef.current} mode={mode} playing={playing} />
            <div className="canvas-corner top-left" /><div className="canvas-corner bottom-right" />
            <div className="canvas-readout">{mode.toUpperCase()} <span>•</span> {playing ? "SIGNAL ACTIVE" : "SIGNAL STANDBY"}</div>
          </div>
          <div className="mode-tabs" role="tablist" aria-label="Visualizer styles">
            {MODES.map((item) => <button key={item.id} role="tab" aria-selected={mode === item.id} className={mode === item.id ? "mode-tab selected" : "mode-tab"} onClick={() => setMode(item.id)}>{item.label}</button>)}
          </div>
          <div className="formula-strip"><span>W(t)</span><span className="formula-equals">=</span><span>f(audio samples, frequency, time)</span><span className="formula-tag">LIVE</span></div>
        </section>

        <section className="player-panel">
          <div className="track-art"><div className="art-rings"><Waves size={37} /></div><span>WAVY AUDIO</span></div>
          <div className="track-info"><div className="eyebrow">NOW PLAYING</div><h2>{trackName}</h2><p>{trackUrl ? "Local audio · Ready to play" : "Import a local audio file to start"}</p></div>
          <div className="player-controls">
            <div className="transport">
              <button className="icon-button" aria-label="Restart track" onClick={() => seek(0)}><SkipBack size={19} /></button>
              <button className="play-button" aria-label={playing ? "Pause" : "Play"} onClick={() => void togglePlayback()}>{playing ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}</button>
              <button className="icon-button" aria-label="Skip to end" onClick={() => seek(duration)}><SkipForward size={19} /></button>
            </div>
            <div className="timeline"><span>{formatTime(currentTime)}</span><input aria-label="Seek" type="range" min={0} max={Math.max(duration, 0.01)} step={0.1} value={Math.min(currentTime, duration || 0)} onChange={(e) => seek(Number(e.target.value))} /><span>{formatTime(duration)}</span></div>
          </div>
          <div className="volume-control"><Volume2 size={18} /><input aria-label="Volume" type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} /></div>
          <audio ref={audioRef} crossOrigin="anonymous" preload="metadata" />
        </section>

        {error && <div className="error-message" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}

        <section className="lower-grid">
          <div className="info-card"><div className="card-heading"><span><Radio size={17} /> SIGNAL METRICS</span><span className="small-status">REAL-TIME</span></div><div className="metric-grid"><div><span>ENGINE</span><strong>WEB AUDIO</strong></div><div><span>RENDERER</span><strong>CANVAS 2D</strong></div><div><span>VISUAL MODES</span><strong>05</strong></div></div></div>
        </section>
        {lyricsOpen && <LyricsWorkspace currentTime={currentTime} duration={duration} seek={seek} />}
        <footer>WAVY AUDIO SYSTEMS <span>BUILT FOR THE RHYTHM</span><span>LOCAL-FIRST · V0.1</span></footer>
      </main>
    </div>
  );
}
