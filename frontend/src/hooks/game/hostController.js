import {
  doc,
  runTransaction,
  updateDoc
} from "firebase/firestore";

import { db } from "../../lib/firebase";

import {
  generateMultiplier,
  roundDuration
} from "./helpers";

import { useRef } from "react";

export function useHostController(user, profile) {

    const heartbeatRef = useRef(null);
    const roundTimerRef = useRef(null);

    const HOST_TIMEOUT = 6000;

    async function tryBecomeHost(game) {

        if (!user) return false;

        const ref = doc(db, "gameState", "current");

        let success = false;

        await runTransaction(db, async tx => {

            const snap = await tx.get(ref);

            const data = snap.data();

            const heartbeat = data.hostHeartbeat || 0;

            const dead =
                Date.now() - heartbeat > HOST_TIMEOUT;

            const priority =
                profile?.role === "admin" ||
                profile?.role === "superadmin";

            if (
                !data.hostUid ||
                dead ||
                data.hostUid === user.uid ||
                priority
            ) {

                tx.update(ref, {

                    hostUid: user.uid,

                    hostRole: profile?.role || "user",

                    hostHeartbeat: Date.now()

                });

                success = true;

            }

        });

        return success;

    }

    function startHosting() {

        if (heartbeatRef.current) return;

        heartbeatRef.current = setInterval(async () => {

            try {

                await updateDoc(
                    doc(db, "gameState", "current"),
                    {
                        hostHeartbeat: Date.now()
                    }
                );

            }

            catch (err) {

                console.error(err);

            }

        }, 2000);

    }

    function stopHosting() {

        if (heartbeatRef.current) {

            clearInterval(heartbeatRef.current);

            heartbeatRef.current = null;

        }

        if (roundTimerRef.current) {

            clearTimeout(roundTimerRef.current);

            roundTimerRef.current = null;

        }

    }
    async function hostStartRound(firebaseGame) {

        const crash = generateMultiplier();

        // duration is derived from the exact same growth formula the
        // client uses locally (see helpers.js), so the round ends
        // exactly when every tab's own curve/plane reaches the crash
        // multiplier - no more Firestore writes needed mid-flight.
        const duration = roundDuration(crash);

        await firebaseGame.startRound(crash);

        if (roundTimerRef.current) {
            clearTimeout(roundTimerRef.current);
        }

        roundTimerRef.current = setTimeout(async () => {

            roundTimerRef.current = null;

            await firebaseGame.finishRound(crash);

        }, duration);

    }


    return {

        tryBecomeHost,

        startHosting,

        stopHosting,

        hostStartRound

    };

}
