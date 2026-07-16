// ======================================================
// graphBounds.js
// Single source of truth for the plotting rectangle.
//
// The curve, the plane and the background border rectangle
// used to each hard-code their own slightly different margins
// (42 vs 20 vs 90 ...). That made the curve appear to start
// somewhere in the middle of the panel instead of the visible
// bottom-left corner of the box drawn around the graph.
//
// Everything now reads its bounds from here so they can never
// drift apart again.
// ======================================================

// Gap between the canvas edge and the visible border rectangle
export const BORDER_MARGIN = 18;

// Extra inset between the border rectangle and the usable
// plotting area (keeps the curve/plane clear of the stroke
// and leaves room for the multiplier readout / plane nose).
const PADDING_LEFT = 4;
const PADDING_RIGHT = 78;   // room for the plane to fly past the curve tip
const PADDING_TOP = 34;
const PADDING_BOTTOM = 4;

// ------------------------------------------------
// The visible border rectangle (matches drawBackground.js)
// ------------------------------------------------
export function getBorderRect(width, height) {

    const x = BORDER_MARGIN;
    const y = BORDER_MARGIN;
    const w = Math.max(1, width - BORDER_MARGIN * 2);
    const h = Math.max(1, height - BORDER_MARGIN * 2);

    return { x, y, width: w, height: h };
}

// ------------------------------------------------
// The rectangle the curve/plane are plotted inside.
// origin (bottom-left) === the visible corner of the border.
// ------------------------------------------------
export function getGraphBounds(width, height) {

    const border = getBorderRect(width, height);

    const left = border.x + PADDING_LEFT;
    const top = border.y + PADDING_TOP;
    const right = Math.max(
        left + 1,
        border.x + border.width - PADDING_RIGHT
    );
    const bottom = Math.max(
        top + 1,
        border.y + border.height - PADDING_BOTTOM
    );

    return {
        left,
        right,
        top,
        bottom,

        // exact point the curve + plane originate from,
        // sitting flush in the visible corner of the border
        originX: left,
        originY: bottom
    };
}
