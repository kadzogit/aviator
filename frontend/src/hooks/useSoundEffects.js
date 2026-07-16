import { useCallback, useEffect, useRef, useState } from "react";

// ======================================================
// Lightweight synthesized sound effects (no audio files to
// bundle/host - just Web Audio oscillators). Mute preference
// persists across sessions via localStorage.
// ======================================================

export function useSoundEffects() {

  const ctxRef = useRef(null);

  const [muted, setMuted] = useState(() => {

    try {
      return localStorage.getItem("aviator_muted") === "1";
    } catch {
      return false;
    }

  });

  useEffect(() => {

    try {
      localStorage.setItem("aviator_muted", muted ? "1" : "0");
    } catch {
      // ignore - storage unavailable (private mode etc.)
    }

  }, [muted]);

  const getCtx = () => {

    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctxRef.current = new AC();
    }

    return ctxRef.current;

  };

  const tone = useCallback((freq, duration, type = "sine", gainLevel = 0.16) => {

    if (muted) return;

    const ctx = getCtx();
    if (!ctx) return;

    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    gain.gain.value = gainLevel;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);

  }, [muted]);

  const playBet = useCallback(() => {
    tone(660, 0.08, "triangle", 0.12);
  }, [tone]);

  const playCashout = useCallback(() => {
    tone(523, 0.11, "sine", 0.15);
    setTimeout(() => tone(784, 0.16, "sine", 0.15), 90);
    setTimeout(() => tone(988, 0.18, "sine", 0.12), 170);
  }, [tone]);

  const playCrash = useCallback(() => {
    tone(160, 0.35, "sawtooth", 0.18);
    setTimeout(() => tone(90, 0.4, "sawtooth", 0.14), 60);
  }, [tone]);

  return {
    muted,
    setMuted,
    playBet,
    playCashout,
    playCrash
  };

}
