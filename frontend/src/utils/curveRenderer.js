// ======================================================
// Curve Renderer
// Premium Smooth Aviator Curve
// ======================================================

// ------------------------------------------------
// Build curve points
// ------------------------------------------------

import { buildFlightCurve } from "./curvePath";

export function sampleCurve(history, width, height) {
    return buildFlightCurve(history, width, height);
}
// ------------------------------------------------
// Smooth spline
// ------------------------------------------------

export function buildSpline(ctx, points) {

    if (points.length < 2) return;

    ctx.moveTo(points[0].x, points[0].y);

    // First curve starts immediately from the origin
    for (let i = 0; i < points.length - 1; i++) {

        const p0 = i === 0 ? points[0] : points[i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] || p2;

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;

        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        ctx.bezierCurveTo(
            cp1x,
            cp1y,
            cp2x,
            cp2y,
            p2.x,
            p2.y
        );
    }

}
// ------------------------------------------------
// Plane rotation
// ------------------------------------------------

export function calculateAngle(points) {

    if (points.length < 2)
        return -0.18;

    const a =
        points[points.length - 2];

    const b =
        points[points.length - 1];

    const angle =
        Math.atan2(

            b.y - a.y,

            b.x - a.x

        );

    return Math.max(
        -0.7,
        Math.min(
            -0.05,
            angle
        )
    );

}

// ------------------------------------------------
// Smooth angle
// ------------------------------------------------

export function smoothAngle(current, target) {

    return current + (target - current) * 0.14;

}

// ------------------------------------------------
// Plane floating
// ------------------------------------------------

export function planeLift(time) {

    return Math.sin(time * 3) * 1.5;

}

// ------------------------------------------------
// Engine smoke (always behind the plane)
// ------------------------------------------------

export function createTrail(points) {

    if (points.length < 2)
        return [];

    const tip = points[points.length - 1];
    const prev = points[points.length - 2];

    const dx = tip.x - prev.x;
    const dy = tip.y - prev.y;

    const len = Math.hypot(dx, dy) || 1;

    // Unit direction
    const ux = dx / len;
    const uy = dy / len;

    // Tail position (behind the plane)
    const tailX = tip.x - ux * 38;
    const tailY = tip.y - uy * 38;

    const smoke = [];

    for (let i = 0; i < 12; i++) {

        smoke.push({

            x: tailX - ux * i * 8,

            y: tailY - uy * i * 8,

            alpha: (1 - i / 12) * 0.32,

            r: 4 - i * 0.22

        });

    }

    return smoke;

}