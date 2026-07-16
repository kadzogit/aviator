// ======================================================
// Aviator Curve Renderer
//
// Visual style matched to the reference: one clean glowing
// stroke line (no triple-layered glow/highlight stack) over a
// simple top-to-bottom gradient fill, red while flying, grey
// once crashed - just the curve's look, ported onto our own
// smoothing + shared graph-bounds origin.
// ======================================================

import { buildSpline } from "./curveRenderer";

const CURVE_RED  = "#ff3b3b";
const CURVE_GREY = "#8a8a94";

export function drawCurve(
    ctx,
    points,
    width,
    height,
    gamePhase = "flying"
) {
    if (!points || points.length < 2) return;

    const crashed = gamePhase === "crashed";
    const lineColor = crashed ? CURVE_GREY : CURVE_RED;

    //------------------------------------------------------
    // Filled area under the curve
    //------------------------------------------------------

    ctx.save();

    ctx.beginPath();

    // start directly under the first point
    ctx.moveTo(points[0].x, height);

    // left edge
    ctx.lineTo(points[0].x, points[0].y);

    // curve
    buildSpline(ctx, points);

    // down from the last curve point, back along the bottom
    ctx.lineTo(points[points.length - 1].x, height);
    ctx.lineTo(points[0].x, height);

    ctx.closePath();

    const fill = ctx.createLinearGradient(
        0,
        points[0].y,
        0,
        height
    );

    if (crashed) {
        fill.addColorStop(0, "rgba(138,138,148,0.35)");
        fill.addColorStop(1, "rgba(138,138,148,0.02)");
    } else {
        fill.addColorStop(0, "rgba(255,59,59,0.45)");
        fill.addColorStop(1, "rgba(255,59,59,0.02)");
    }

    ctx.fillStyle = fill;
    ctx.fill();

    ctx.restore();

    //------------------------------------------------------
    // The curve line itself - a single clean glowing stroke
    //------------------------------------------------------

    ctx.save();

    ctx.beginPath();

    ctx.moveTo(points[0].x, points[0].y);

    buildSpline(ctx, points);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.lineWidth = 4;
    ctx.strokeStyle = lineColor;

    ctx.shadowColor = crashed ? "transparent" : lineColor;
    ctx.shadowBlur = crashed ? 0 : 12;

    ctx.stroke();

    ctx.restore();
}
