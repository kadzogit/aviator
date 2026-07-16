import { useRef } from "react";

export function useRoundEngine() {

    const phaseRef = useRef("waiting");

    async function onRoundStarted(
        consumeQueuedBets,
        placeBet,
    ) {

        phaseRef.current = "flying";


        consumeQueuedBets(async (slot, queued) => {

            await placeBet(
                slot,
                queued.stake,
                queued.autoCashout
            );

        });

    }

    function onRoundEnded(
        betsRef,
        clearBet,
        
    ) {

        phaseRef.current = "waiting";

        betsRef.current.forEach((bet, slot) => {

            if (!bet) return;

            clearBet(slot);

        });

    }

    return {

        phaseRef,

        onRoundStarted,

        onRoundEnded

    };

}