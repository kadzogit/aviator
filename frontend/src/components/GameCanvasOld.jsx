import { useEffect, useRef, useState } from "react";
import {
  buildCurve,
  getPlanePosition,
  drawGlowCurve
} from "../utils/curveRenderer";

// Betika Aviator plane image
const plane = new Image();
plane.src="/images/aviator_plane.png";
export default function GameCanvas({ multiplier, gamePhase, liveBets = [] }) {
  const canvasRef    = useRef(null);
  const historyRef   = useRef([]);
  const startTRef    = useRef(null);
  const planeImgRef  = useRef(null);
  const animFrameRef = useRef(null);
  const crashRef     = useRef({ frame: 0, active: false });
  const [liveCount,  setLiveCount]  = useState(0);
  const [totalStake, setTotalStake] = useState(0);

  // Preload plane image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/images/aviator_plane.png";
    img.onload  = () => { planeImgRef.current = img; };
    img.onerror = () => { planeImgRef.current = null; };
  }, []);

  // Update live counters
  useEffect(() => {
    const active = liveBets.filter(b => b.result === "pending");
    setLiveCount(active.length);
    setTotalStake(active.reduce((s, b) => s + (b.stake || 0), 0));
  }, [liveBets]);

  //cancel animation frame on unmount 
  useEffect(() => {

    cancelAnimationFrame(animFrameRef.current);

    //------------------------------------------------
    // New round starts
    //------------------------------------------------

    if (gamePhase === "waiting") {

        historyRef.current = [];

        startTRef.current = null;

        crashRef.current = {

            frame:0,

            active:false

        };

        draw();

        return;

    }

    //------------------------------------------------
    // Flying
    //------------------------------------------------

    if (gamePhase === "flying") {

        if (startTRef.current === null) {

            startTRef.current = Date.now();

            historyRef.current = [];

        }

        historyRef.current.push({

            t:(Date.now()-startTRef.current)/1000,

            m:multiplier

        });

        draw();

        return;

    }

    //------------------------------------------------
    // Crash
    //------------------------------------------------

    if (gamePhase === "crashed") {
        draw();
        return;
    }
},[multiplier,gamePhase]);
//-----

  function animateCrash() {
    const step = () => {
      draw();
      if (crashRef.current.frame < 45) {
        crashRef.current.frame++;
        animFrameRef.current = requestAnimationFrame(step);
      }
    };
    animFrameRef.current = requestAnimationFrame(step);
  }

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W   = canvas.width;
    const H   = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // ── Deep Betika dark purple background ──────────────────────
    const bg = ctx.createRadialGradient(W * 0.2, H * 0.25, 0, W * 0.5, H * 0.55, W * 1.1);
    bg.addColorStop(0,   "#2a1a50");
    bg.addColorStop(0.4, "#1a1035");
    bg.addColorStop(1,   "#0a0618");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── Stars ──────────────────────────────────────────────────
    ctx.save();
    const stars = [
      [0.12,0.08],[0.34,0.12],[0.56,0.06],[0.78,0.14],[0.91,0.09],
      [0.05,0.22],[0.22,0.28],[0.45,0.19],[0.67,0.25],[0.85,0.18],
      [0.15,0.38],[0.38,0.42],[0.60,0.35],[0.80,0.40],[0.95,0.32],
      [0.08,0.55],[0.28,0.60],[0.50,0.52],[0.72,0.58],[0.88,0.50],
      [0.18,0.70],[0.42,0.75],[0.65,0.68],[0.83,0.72],[0.97,0.65],
    ];
    stars.forEach(([sx, sy]) => {
      ctx.beginPath();
      ctx.arc(sx * W, sy * H, 1.1, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fill();
    });
    ctx.restore();

    // ── Betika sunburst rays ────────────────────────────────────
    ctx.save();
    ctx.globalAlpha = 0.042;
    const ox = W * 0.07, oy = H * 0.97;
    for (let a = -78; a <= 78; a += 5) {
      const rad = (a * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.sin(rad) * W * 3.2, oy - Math.cos(rad) * H * 2.8);
      ctx.strokeStyle = "#9060ff";
      ctx.lineWidth   = 1.3;
      ctx.stroke();
    }
    ctx.restore();

    // ── Bottom purple glow ──────────────────────────────────────
    const bottomGlow = ctx.createLinearGradient(0, H * 0.65, 0, H);
    bottomGlow.addColorStop(0, "rgba(80,0,120,0)");
    bottomGlow.addColorStop(1, "rgba(80,0,120,0.38)");
    ctx.fillStyle = bottomGlow;
    ctx.fillRect(0, H * 0.65, W, H * 0.35);

    // ── Live counters overlay ──────────────────────────────────
    if (gamePhase === "flying" && liveCount > 0) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      roundRect(ctx, W - 175, 10, 163, 54, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,230,118,0.3)";
      ctx.lineWidth   = 1;
      roundRect(ctx, W - 175, 10, 163, 54, 8);
      ctx.stroke();
      ctx.fillStyle = "#00e676";
      ctx.font      = "bold 10px 'Orbitron', monospace";
      ctx.textAlign = "left";
      ctx.fillText(`${liveCount} PLAYERS BETTING`, W - 167, 29);
      ctx.fillStyle = "rgba(255,215,0,0.85)";
      ctx.font      = "10px 'Inter', sans-serif";
      ctx.fillText(`Total: ${totalStake.toLocaleString()} KES`, W - 167, 50);
      ctx.restore();
    }

    // ── Waiting state ──────────────────────────────────────────
    if (gamePhase === "waiting") {
      ctx.save();
      const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 380);
      ctx.globalAlpha = pulse * 0.6;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2 - 18, 44, 0, Math.PI * 2);
      ctx.strokeStyle = "#e8003d";
      ctx.lineWidth   = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle   = "rgba(255,255,255,0.6)";
      ctx.font        = "bold 13px 'Orbitron', monospace";
      ctx.textAlign   = "center";
      ctx.shadowColor = "rgba(232,0,61,0.7)";
      ctx.shadowBlur  = 12;
      ctx.fillText("PREPARING NEXT ROUND", W / 2, H / 2 - 8);
      ctx.shadowBlur  = 0;
      ctx.restore();

      drawPlane(ctx, 65, H - 42, -0.28, 0.6, false);
      return;
    }

    const pts = historyRef.current;
    if (pts.length < 2) return;

    // ── Axis layout ────────────────────────────────────────────
    const padL = 52, padB = 34, padR = 22, padT = 20;
    const drawW = W - padL - padR;
    const drawH = H - padB - padT;

    const maxT = Math.max(

    pts.length

        ? pts[pts.length-1].t

        : 2,

    2

);
    const maxM = Math.max(...pts.map(p => p.m), 2);

    function toX(t) { return padL + (t / maxT) * drawW; }
    function toY(m) { return H - padB - ((m - 1) / Math.max(maxM - 1, 0.5)) * drawH; }

    const lastPt = pts[pts.length - 1];
    const lx     = toX(lastPt.t);
    const ly     = toY(lastPt.m);

    // ── Betika shading fill under curve ───────────────────────
    ctx.beginPath();

const curve = buildCurve(
    pts,
    toX,
    toY
);
console.log("curve points:", curve.length, curve);
if (curve.length) {

    ctx.moveTo(curve[0].x, H-padB);

    curve.forEach(p=>ctx.lineTo(p.x,p.y));

    ctx.lineTo(curve[curve.length-1].x,H-padB);

}

ctx.closePath();

    const fillGrad = ctx.createLinearGradient(0, padT, 0, H - padB);
    if (gamePhase === "crashed") {
      fillGrad.addColorStop(0,   "rgba(220,30,30,0.7)");
      fillGrad.addColorStop(0.45,"rgba(180,10,10,0.3)");
      fillGrad.addColorStop(1,   "rgba(100,0,0,0.04)");
    } else {
      fillGrad.addColorStop(0,   "rgba(232,0,61,0.6)");
      fillGrad.addColorStop(0.45,"rgba(180,0,40,0.22)");
      fillGrad.addColorStop(1,   "rgba(80,0,20,0.04)");
    }
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // ── Smooth curve line ──────────────────────────────────────
    drawGlowCurve(
    ctx,
    pts,
    toX,
    toY,
    gamePhase === "crashed"
);

    // ── Glowing dot at curve tip ───────────────────────────────
    if (gamePhase !== "crashed") {
      ctx.beginPath();
      ctx.arc(lx, ly, 7, 0, Math.PI * 2);
      const dotGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, 7);
      dotGrad.addColorStop(0, "#ffffff");
      dotGrad.addColorStop(0.4, "#ff2244");
      dotGrad.addColorStop(1, "rgba(255,34,68,0)");
      ctx.fillStyle   = dotGrad;
      ctx.shadowColor = "#ff2244";
      ctx.shadowBlur  = 22;
      ctx.fill();
      ctx.shadowBlur  = 0;
    }

    // ── Y-axis gridlines + labels ──────────────────────────────
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.font      = "10px 'Orbitron', monospace";
    ctx.textAlign = "right";
    [1, 1.5, 2, 3, 5, 10, 20, 50, 100, 200].forEach(s => {
      if (s > maxM * 1.18) return;
      const y = toY(s);
      if (y < padT || y > H - padB) return;
      ctx.fillText(`${s}x`, padL - 6, y + 3);
      ctx.beginPath();
      ctx.setLineDash([3, 9]);
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.strokeStyle = "rgba(255,255,255,0.045)";
      ctx.lineWidth   = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // ── X-axis time labels ─────────────────────────────────────
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.font      = "9px monospace";
    ctx.textAlign = "center";
    const step = Math.max(1, Math.floor(maxT / 6));
    for (let t = 0; t <= maxT; t += step) {
      const x = toX(t);
      if (x < padL || x > W - padR) continue;
      ctx.fillText(`${t}s`, x, H - padB + 16);
    }

    // ── Plane or crash animation ───────────────────────────────
    if (gamePhase !== "crashed") {
      const plane = getPlanePosition(
    pts,
    toX,
    toY
);

drawPlane(
    ctx,
    plane.x,
    plane.y,
    plane.angle,
    plane.scale,
    false
);
    } else {
      // Crash animation
      const cf = crashRef.current.frame;
      const crashAngle = Math.PI / 2.2 + cf * 0.03;
      const crashX     = lx + cf * 2.5;
      const crashY     = ly + cf * 3.5;
      drawPlane(ctx, crashX, crashY, crashAngle, 0.85, true);

      // Explosion particles
      if (cf < 20) {
        for (let p = 0; p < 10; p++) {
          const pa  = (p / 10) * Math.PI * 2;
          const pr  = cf * 3.5;
          const alpha = Math.max(0, 1 - cf / 20);
          ctx.beginPath();
          ctx.arc(lx + Math.cos(pa) * pr, ly + Math.sin(pa) * pr, Math.max(0.5, 3.5 - cf * 0.15), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,${Math.max(0, 120 - cf * 5)},0,${alpha})`;
          ctx.fill();
        }
      }

      // FLEW AWAY text
      ctx.save();
      const textAlpha = Math.min(1, cf / 8);
      ctx.globalAlpha = textAlpha;
      ctx.fillStyle   = "#ff2020";
      ctx.font        = "bold 24px 'Orbitron', monospace";
      ctx.textAlign   = "center";
      ctx.shadowColor = "#ff0000";
      ctx.shadowBlur  = 28;
      ctx.fillText("FLEW AWAY!", W / 2, H / 2 - 12);
      ctx.font        = "bold 15px 'Orbitron', monospace";
      ctx.fillStyle   = "rgba(255,120,120,0.9)";
      ctx.shadowBlur  = 12;
      ctx.fillText(`@ ${multiplier.toFixed(2)}x`, W / 2, H / 2 + 16);
      ctx.restore();
    }
  }

  // ──DELETED  Build smooth bezier path from points ──────────────────────
  

  // ── Draw plane (image or emoji fallback) ──────────────────────
  function drawPlane(ctx, x, y, angle, scale, crashed) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    if (planeImgRef.current) {
      const pw = 120, ph = 30; // Minimized and elongated like Pesa Fiti
      if (crashed) {
        ctx.globalAlpha = 0.75;
        ctx.filter = "grayscale(1) brightness(0.5)";
      }
      // Pesa Fiti plane glow
      ctx.shadowColor = crashed ? "#ff0000" : "#ff0000";
      ctx.shadowBlur  = 15;
      ctx.drawImage(planeImgRef.current, -pw / 2, -ph / 2, pw, ph);
      ctx.shadowBlur  = 0;
      ctx.filter      = "none";
      ctx.globalAlpha = 1;
    } else {
      ctx.font         = "32px serif";
      ctx.fillStyle    = crashed ? "#cc1111" : "#e8003d";
      ctx.shadowColor  = crashed ? "#ff2200" : "#ff0055";
      ctx.shadowBlur   = crashed ? 8 : 22;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✈", 0, 0);
      ctx.shadowBlur   = 0;
    }
    ctx.restore();
  }

  // ── Rounded rect helper ────────────────────────────────────────
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  return (
    <canvas
      ref={canvasRef}
      width={960}
      height={400}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
