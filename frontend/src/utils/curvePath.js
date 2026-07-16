// ======================================================
// curvePath.js
// Premium Aviator Flight Path
// ======================================================

import { getGraphBounds } from "./graphBounds";

export function getFlightProgress(multiplier) {

    const MAX = 70;

    return Math.max(
        0,
        Math.min(
            1,
            (multiplier - 1) / (MAX - 1)
        )
    );

}

export function getFlightPoint(progress, width, height) {

    const bounds = getGraphBounds(width, height);

    const LEFT = bounds.left;
    const RIGHT = bounds.right;
    const TOP = bounds.top;
    const BOTTOM = bounds.bottom;

    const usableWidth = RIGHT - LEFT;

    // The curve always starts exactly at the visible bottom-left
    // corner of the graph box (bounds.originX / bounds.originY).
    const p0 = {
        x: bounds.originX,
        y: bounds.originY
    };

    // Gentle early control point so the curve leaves the corner
    // smoothly instead of snapping into a steep climb.
    const p1 = {
        x: LEFT + usableWidth * 0.42,
        y: BOTTOM
    };

    const p2 = {
        x: RIGHT,
        y: TOP
    };

    const t = Math.max(0, Math.min(progress, 1));
    const omt = 1 - t;

    return {

        x:
            omt * omt * p0.x +
            2 * omt * t * p1.x +
            t * t * p2.x,

        y:
            omt * omt * p0.y +
            2 * omt * t * p1.y +
            t * t * p2.y

    };

}

export function buildFlightCurve(history, width, height) {

    if (!history.length) return [];

    return history.map(item =>
        getFlightPoint(
            Math.min(item.p ?? getFlightProgress(item.m), 1),
            width,
            height
        )
    );

}

// ------------------------------------------------
// The exact visible corner the curve/plane start from,
// exposed so other modules (e.g. the plane's very first
// frame, before any history exists) can align to it.
// ------------------------------------------------
export function getCurveOrigin(width, height) {

    const bounds = getGraphBounds(width, height);

    return {
        x: bounds.originX,
        y: bounds.originY
    };

}
