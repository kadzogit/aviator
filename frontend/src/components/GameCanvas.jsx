// frontend/src/components/GameCanvas.jsx

import { useEffect, useRef, useState } from "react";

import {
  resizeCanvas,
  roundRect,
} from "../utils/canvasUtils";

import {
  sampleCurve,
} from "../utils/curveRenderer";

import { getFlightProgress } from "../utils/curvePath";

import { drawBackground } from "../utils/drawBackground";
import { drawCurve } from "../utils/drawCurve";
import { drawPlane } from "../utils/drawPlane";
import { drawCrash } from "../utils/drawCrash";

export default function GameCanvas({

  multiplier,

  gamePhase,

  liveBets = []

}) {

  //--------------------------------------------------
  // Canvas
  //--------------------------------------------------

  const canvasRef = useRef(null);

  const animationRef = useRef(null);

  //--------------------------------------------------
  // Plane
  //--------------------------------------------------

  const planeRef = useRef(null);

  const angleRef = useRef(-0.35);

  //--------------------------------------------------
  // History
  //
  // Every point's position is derived straight from the
  // multiplier value itself (getFlightProgress), not from a
  // local wall-clock timer. That's what keeps the curve/plane
  // moving in lockstep with the actual multiplier - no more
  // freezing at a fixed "highpoint" if a round runs long, no
  // more jumping backwards if a timer resets, and every open
  // tab (including one that joins mid-round) draws the exact
  // same curve for the exact same multiplier.
  //--------------------------------------------------

  const historyRef = useRef([]);

  // Only used for the plane's cosmetic idle float, never for
  // positioning - so it's safe to just run continuously.
  const mountTimeRef = useRef(performance.now());

  //--------------------------------------------------
  // Crash
  //--------------------------------------------------

  const crashRef = useRef({

    active: false,

    frame: 0

  });

  //--------------------------------------------------
  // Live Bets
  //--------------------------------------------------

  const [livePlayers, setLivePlayers] = useState(0);

  const [liveStake, setLiveStake] = useState(0);

  //--------------------------------------------------
  // Load Plane Image
  //--------------------------------------------------

  useEffect(() => {

    const img = new Image();

    img.src = "/images/aviator_plane.png";

    img.onload = () => {

      planeRef.current = img;

    };

  }, []);

  //--------------------------------------------------
  // Responsive Canvas
  //--------------------------------------------------

  useEffect(() => {

    const canvas = canvasRef.current;

    if (!canvas) return;

    const resize = () => {

      resizeCanvas(canvas);

      renderScene();

    };

    resize();

    window.addEventListener(

      "resize",

      resize

    );

    return () =>

      window.removeEventListener(

        "resize",

        resize

      );

  }, []);

  //--------------------------------------------------
  // Live Bets Counter
  //--------------------------------------------------

  useEffect(() => {

    const pending = liveBets.filter(

      bet => bet.result === "pending"

    );

    setLivePlayers(

      pending.length

    );

    setLiveStake(

      pending.reduce(

        (sum, bet) =>

          sum + (bet.stake || 0),

        0

      )

    );

  }, [liveBets]);

  //--------------------------------------------------
  // Game State
  //--------------------------------------------------

  useEffect(() => {

    cancelAnimationFrame(

      animationRef.current

    );

    if (gamePhase === "waiting") {

      historyRef.current = [

        {

          p: 0,

          m: 1

        }

      ];

      crashRef.current = {

        active: false,

        frame: 0

      };

      renderScene();

      return;

    }

    if (gamePhase === "flying") {

      const progress = getFlightProgress(multiplier);

      const last =
        historyRef.current[historyRef.current.length - 1];

      // Only append a point once progress has genuinely moved,
      // to keep the point list light without losing smoothness.
      if (
        !last ||
        progress > (last.p ?? 0) + 0.0015
      ) {

        historyRef.current.push({

          p: progress,

          m: multiplier

        });

      }

      renderScene();

      return;

    }

    if (gamePhase === "crashed") {

      if (!crashRef.current.active) {

        crashRef.current.active = true;

        crashRef.current.frame = 0;

      }

      animateCrash();

    }

  }, [

    multiplier,

    gamePhase

  ]);

  //--------------------------------------------------
  // Crash Animation
  //--------------------------------------------------

  function animateCrash() {

    const animate = () => {

      crashRef.current.frame++;

      renderScene();

      if (

        crashRef.current.frame < 55

      ) {

        animationRef.current =

          requestAnimationFrame(

            animate

          );

      }

    };

    animationRef.current =

      requestAnimationFrame(

        animate

      );

  }

  //--------------------------------------------------
  // Main Renderer
  //--------------------------------------------------

  function renderScene() {

    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const W = canvas.width;

    const H = canvas.height;

    ctx.clearRect(

      0,

      0,

      W,

      H

    );

    drawBackground(

      ctx,

      W,

      H

    );
    //--------------------------------------------------
    // Waiting Screen
    //
    // Just the ambient pulsing ring - the "Waiting for next
    // round..." text itself lives once, in the DOM overlay
    // (multiplier-display), so it isn't drawn twice.
    //--------------------------------------------------

    if (gamePhase === "waiting") {

      ctx.save();

      ctx.globalAlpha =
        0.55 + Math.sin(Date.now() / 300) * 0.25;

      ctx.beginPath();

      ctx.arc(
        W / 2,
        H / 2,
        46,
        0,
        Math.PI * 2
      );

      ctx.strokeStyle = "#ff1d4d";
      ctx.lineWidth = 2;

      ctx.stroke();

      ctx.restore();

    } else {

      //--------------------------------------------------
      // Build Curve
      //--------------------------------------------------

      const points = sampleCurve(
        historyRef.current,
        W,
        H
      );

      drawCurve(
        ctx,
        points,
        W,
        H,
        gamePhase
      );

      //--------------------------------------------------
      // Draw Plane
      //--------------------------------------------------

      const gameTime =
        (performance.now() - mountTimeRef.current) / 1000;

      drawPlane(

        ctx,

        planeRef.current,

        points,

        angleRef,

        gameTime,

        gamePhase

      );

      //--------------------------------------------------
      // Crash Explosion
      //
      // Only the particle/shockwave burst - the "FLEW AWAY"
      // text lives once, in the DOM overlay, so it isn't
      // drawn twice.
      //--------------------------------------------------

      if (

        gamePhase === "crashed" &&

        points.length

      ) {

        const last =

          points[points.length - 1];

        drawCrash(

          ctx,

          last.x,

          last.y,

          crashRef.current.frame

        );

      }

    }

    //--------------------------------------------------
    // Live Counter
    //--------------------------------------------------

    if (

      gamePhase === "flying" &&

      livePlayers > 0

    ) {

      ctx.save();

      ctx.fillStyle =

        "rgba(0,0,0,.45)";

      roundRect(

        ctx,

        W - 180,

        12,

        165,

        56,

        8

      );

      ctx.fill();

      ctx.strokeStyle =

        "rgba(0,255,120,.25)";

      ctx.stroke();

      ctx.fillStyle = "#00ff7a";

      ctx.font =

        "bold 11px Orbitron";

      ctx.fillText(

        `${livePlayers} PLAYERS`,

        W - 165,

        32

      );

      ctx.fillStyle = "#ffd84a";

      ctx.font = "10px Inter";

      ctx.fillText(

        `${liveStake.toLocaleString()} KES`,

        W - 165,

        50

      );

      ctx.restore();

    }

  }

  //--------------------------------------------------
  // Cleanup
  //--------------------------------------------------

  useEffect(() => {

    return () => {

      cancelAnimationFrame(

        animationRef.current

      );

    };

  }, []);

  //--------------------------------------------------
  // Component
  //--------------------------------------------------

  return (

    <canvas

      ref={canvasRef}

      style={{

        width: "100%",

        height: "100%",

        display: "block"

      }}

    />

  );

}
