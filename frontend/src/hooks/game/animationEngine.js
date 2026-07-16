import { useEffect, useRef, useState } from "react";

import { calculateMultiplier } from "./helpers";

// ======================================================
// Local, smooth (60fps) multiplier animation.
//
// The host only needs to tell every tab WHEN the round
// started (startTimeMs, already written to Firestore) and
// what it will crash at. Every tab then computes its own
// multiplier locally via requestAnimationFrame using the
// exact same formula (calculateMultiplier), instead of
// waiting on a Firestore write every tick.
//
// This is what keeps every open tab in sync, makes the
// curve/plane move smoothly instead of staggering with
// network delivery, and lets a browser that joins mid-round
// immediately compute the correct "catch up" position.
// ======================================================

export function useAnimationEngine() {

    const frameRef = useRef(null);

    const startTimeRef = useRef(0);

    const crashRef = useRef(1);

    const runningRef = useRef(false);

    const [multiplier, setMultiplier] = useState(1);

    //--------------------------------------------------

    const stopAnimation = () => {

        runningRef.current = false;

        if (frameRef.current) {
            cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
        }

    };

    //--------------------------------------------------

    const animate = () => {

        if (!runningRef.current) return;

        const elapsed =
            Date.now() - startTimeRef.current;

        const current =
            calculateMultiplier(elapsed);

        if (current >= crashRef.current) {

            setMultiplier(crashRef.current);
            stopAnimation();
            return;

        }

        setMultiplier(current);

        frameRef.current =
            requestAnimationFrame(animate);

    };

    //--------------------------------------------------
    // startTimeMs is the shared round-start epoch written by
    // the host, so every tab - including one that just joined
    // mid-round - computes the exact same curve for the exact
    // same elapsed time.
    //--------------------------------------------------

    const startAnimation = (crashMultiplier, startTimeMs) => {

        stopAnimation();

        crashRef.current = crashMultiplier || 1;
        startTimeRef.current = startTimeMs || Date.now();
        runningRef.current = true;

        // Paint the correct value immediately (don't wait a frame)
        // so a tab joining mid-round doesn't flash back to 1x.
        const elapsedNow = Date.now() - startTimeRef.current;
        const caughtUp = Math.min(
            calculateMultiplier(elapsedNow),
            crashRef.current
        );

        setMultiplier(caughtUp);

        if (caughtUp < crashRef.current) {
            frameRef.current = requestAnimationFrame(animate);
        }

    };

    //--------------------------------------------------

    useEffect(() => {

        return () => stopAnimation();

    }, []);

    return {

        multiplier,

        setMultiplier,

        startAnimation,

        stopAnimation,

        isRunning: runningRef

    };
}
