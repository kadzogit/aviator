// ======================================================
// Premium Betika Aviator Plane Renderer
// ======================================================

import {
    calculateAngle,
    smoothAngle,
    planeLift,
    createTrail
} from "./curveRenderer";

import { getGraphBounds } from "./graphBounds";

// Plane sprite size (kept in one place so the tail offset,
// the clamp box and the drawImage call all agree).
const PLANE_WIDTH = 100;
const PLANE_HEIGHT = 28;

export function drawPlane(
    ctx,
    planeImage,
    points,
    angleRef,
    gameTime = 0,
    gamePhase = "flying"
) {

    if (!planeImage) return;
    if (!points || points.length < 1) return;

    const bounds = getGraphBounds(
        ctx.canvas.width,
        ctx.canvas.height
    );

    //------------------------------------------------------
    // Direction of travel.
    // With only one point (the very first frame of a round,
    // right as the curve leaves the corner) there is no
    // previous point to derive a direction from yet, so fall
    // back to the same takeoff angle the curve control point
    // implies. This makes the plane appear immediately, ahead
    // of the curve, right at the visible corner - instead of
    // popping in a beat later once a second curve point exists.
    //------------------------------------------------------

    const tip = points[points.length - 1];
    const prev = points.length > 1
        ? points[points.length - 2]
        : { x: bounds.originX - 40, y: bounds.originY + 22 };

    const dx = tip.x - prev.x;
    const dy = tip.y - prev.y;

    const len = Math.hypot(dx, dy) || 1;

    // Keep the plane's TAIL exactly on the curve tip, nose ahead.
    const planeX = tip.x + (dx / len) * (PLANE_WIDTH * 0.50);
    const planeY = tip.y + (dy / len) * (PLANE_WIDTH * 0.50);

    // emergency fallback
    if (!Number.isFinite(planeX) || !Number.isFinite(planeY)) {
        return;
    }

    //------------------------------------------------------
    // Confine the plane to the same visible rectangle the
    // curve and the background border share, with a little
    // extra room so the nose can lead past the curve's tip.
    //------------------------------------------------------

    const GRAPH_LEFT = bounds.left;
    const GRAPH_RIGHT = bounds.right + PLANE_WIDTH * 0.55;

    const GRAPH_TOP = bounds.top;
    const GRAPH_BOTTOM = bounds.bottom;

    const drawX = Math.max(
        GRAPH_LEFT,
        Math.min(
            GRAPH_RIGHT,
            planeX
        )
    );

    const drawY = Math.max(
        GRAPH_TOP,
        Math.min(
            GRAPH_BOTTOM,
            planeY
        )
    );

    //------------------------------------------------------
    // Smooth rotation
    //------------------------------------------------------

    const targetAngle = points.length > 1
        ? calculateAngle(points)
        : -0.35;

    angleRef.current = smoothAngle(
        angleRef.current,
        targetAngle
    );

    //------------------------------------------------------
    // Plane only floats near the end
    //------------------------------------------------------

    let lift = 0;

    if (drawX > ctx.canvas.width * 0.75) {

        lift = planeLift(gameTime);

    }

    //------------------------------------------------------
    // Smoke trail
    //------------------------------------------------------

    const trail = points.length > 1 ? createTrail(points) : [];

    ctx.save();

    trail.forEach(p => {

        ctx.beginPath();

        ctx.arc(
            p.x,
            p.y,
            p.r,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            `rgba(255,70,70,${p.alpha * 0.30})`;

        ctx.fill();

    });

    ctx.restore();

    //------------------------------------------------------
    // Plane
    //------------------------------------------------------

    ctx.save();

    ctx.translate(
        drawX,
        drawY - 10 + lift
    );

    ctx.rotate(angleRef.current);

    if (gamePhase === "crashed") {

        ctx.globalAlpha = .65;

        ctx.filter =
            "grayscale(1) brightness(.45)";

    }

    ctx.shadowColor =
        gamePhase === "crashed"
            ? "#ff3300"
            : "#ff2045";

    ctx.shadowBlur =
        gamePhase === "crashed"
            ? 8
            : 18;

    ctx.drawImage(
        planeImage,
        -PLANE_WIDTH / 2,
        -PLANE_HEIGHT / 2,
        PLANE_WIDTH,
        PLANE_HEIGHT
    );

    ctx.restore();

}
