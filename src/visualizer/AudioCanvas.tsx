import { useEffect, useRef } from "react";

export type VisualizerMode = "oscilloscope" | "spectrum" | "stepped" | "sawtooth" | "decay";

export default function AudioCanvas({ analyser, mode, playing, compact = false }: {
  analyser: AnalyserNode | null;
  mode: VisualizerMode;
  playing: boolean;
  compact?: boolean;
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
      if (compact) {
        ctx.clearRect(0, 0, cw, ch);
      } else {
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
      }

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
  }, [mode, playing, compact]);

  return <canvas className="visual-canvas" ref={canvasRef} aria-label={`${mode} audio visualization`} />;
}
