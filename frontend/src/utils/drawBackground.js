// ======================================================
// Betika Aviator Background Renderer
// ======================================================

import { getBorderRect } from "./graphBounds";

export function drawBackground(ctx, W, H) {

  // --------------------------------------------------
  // Background Gradient
  // --------------------------------------------------

  const bg = ctx.createRadialGradient(

    W * 0.18,
    H * 0.22,
    0,

    W * 0.5,
    H * 0.5,
    W

  );

  bg.addColorStop(0, "#341b6b");
  bg.addColorStop(.45, "#191033");
  bg.addColorStop(1, "#090512");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // --------------------------------------------------
  // Purple Rays
  // --------------------------------------------------

  ctx.save();

  ctx.globalAlpha = .05;
  ctx.strokeStyle = "#8b63ff";

  for (let a = -80; a <= 80; a += 5) {

    const r = a * Math.PI / 180;

    ctx.beginPath();

    ctx.moveTo(W * .06, H * .96);

    ctx.lineTo(

      W * .06 + Math.sin(r) * W * 3,

      H * .96 - Math.cos(r) * H * 3

    );

    ctx.stroke();

  }

  ctx.restore();

  // --------------------------------------------------
  // Stars
  // --------------------------------------------------

  ctx.save();

  ctx.fillStyle = "rgba(255,255,255,.28)";

  for (let i = 0; i < 60; i++) {

    const x = (i * 137) % W;

    const y = (i * 97) % H;

    ctx.beginPath();

    ctx.arc(

      x,

      y,

      1.1,

      0,

      Math.PI * 2

    );

    ctx.fill();

  }

  ctx.restore();

  // --------------------------------------------------
  // Bottom Glow
  // --------------------------------------------------

  const glow = ctx.createLinearGradient(

    0,

    H * .65,

    0,

    H

  );

  glow.addColorStop(

    0,

    "rgba(120,0,200,0)"

  );

  glow.addColorStop(

    1,

    "rgba(120,0,200,.38)"

  );

  ctx.fillStyle = glow;

  ctx.fillRect(

    0,

    H * .65,

    W,

    H

  );

  ctx.save();

  ctx.strokeStyle = "rgba(255,255,255,.08)";

  ctx.lineWidth = 2;

  // Shared with the curve/plane bounds so the border you see
  // is exactly the rectangle the curve and plane originate from.
  const border = getBorderRect(W, H);

  ctx.strokeRect(
    border.x,
    border.y,
    border.width,
    border.height
  );

  ctx.restore();
}
