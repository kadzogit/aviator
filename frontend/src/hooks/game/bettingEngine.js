import { useRef, useState } from "react";

import {
    runTransaction,
    doc,
    collection,
    serverTimestamp
} from "firebase/firestore";

import { db } from "../../lib/firebase";

export function useBettingEngine(
    user,
    profile,
    gameState,
    currency,
    activeBalance
) {

    //--------------------------------------------------
    // Active Bets
    //--------------------------------------------------

    const [bets, setBets] = useState([null, null]);

    

    //--------------------------------------------------
    // Queued Bets
    //--------------------------------------------------

    const [queuedBets, setQueuedBets] = useState([null, null]);

    //--------------------------------------------------

    const betsRef = useRef([null, null]);

    const queuedRef = useRef([null, null]);

    //--------------------------------------------------

    const syncBets = (next) => {

        betsRef.current = next;

        setBets(next);

    };

    //--------------------------------------------------

    const syncQueued = (next) => {

        queuedRef.current = next;

        setQueuedBets(next);

    };

    //--------------------------------------------------
    // Instant Active Bet
    //--------------------------------------------------

    const activateBet = (slot, bet) => {

        const next = [...betsRef.current];

        next[slot] = {

            ...bet,

            status: "active",
            cashedOut: false,
            lost: false,

        };

        syncBets(next);

    };

    //--------------------------------------------------
    // Queue
    //--------------------------------------------------

    const queueBet = (slot, stake, autoCashout) => {

        const next = [...queuedRef.current];

        next[slot] = {

            stake,

            autoCashout

        };

        syncQueued(next);

    };

    //--------------------------------------------------
    // Cancel Queue
    //--------------------------------------------------

    const cancelQueuedBet = (slot) => {

        const next = [...queuedRef.current];

        next[slot] = null;

        syncQueued(next);

    };

    //--------------------------------------------------
    // Free Slot
    //--------------------------------------------------

    const clearBet = (slot) => {

        const next = [...betsRef.current];

        next[slot] = null;

        syncBets(next);

    };

    //--------------------------------------------------
// Update Existing Bet
//--------------------------------------------------

const updateBet = (slot, updates) => {

    const next = [...betsRef.current];

    if (!next[slot]) return;

    next[slot] = {

        ...next[slot],

        ...updates

    };

    syncBets(next);

};

    //--------------------------------------------------
    // Move queued → active
    //--------------------------------------------------

    const consumeQueuedBets = (callback) => {

        queuedRef.current.forEach((bet, slot) => {

            if (!bet) return;

            callback(slot, bet);

        });

        syncQueued([null, null]);

    };

    //placebet function
    async function placeBet(

    slot,

    stake,

    autoCashout

){

    if(!user) return;
    if (!gameState?.roundId) return;

    if(betsRef.current[slot]) return;

    if(stake>activeBalance) return;

    const field=

        profile?.mode==="demo"

        ?"demoBalance"

        :"balance";

    let betId;

    try{

        await runTransaction(

            db,

            async(transaction)=>{

                const userRef=doc(

                    db,

                    "users",

                    user.uid

                );

                const snap=

                    await transaction.get(userRef);

                const balance=

                    snap.data()[field]||0;

                if(balance<stake)

                    throw new Error(

                        "Insufficient balance"

                    );

                const betRef=doc(

                    collection(

                        db,

                        "bets"

                    )

                );

                betId=betRef.id;

                transaction.update(

                    userRef,

                    {

                        [field]:

                        balance-stake

                    }

                );

                transaction.set(

                    betRef,

                    {

                        id:betId,

                        uid:user.uid,

                        roundId:

                        gameState?.roundId?? null,

                        stake,

                        autoCashout,

                        result:"pending",

                        currency,

                        mode:

                        profile?.mode,

                        timestamp:

                        serverTimestamp()

                    }

                );

            }

        );

        activateBet(

            slot,

            {

                betId,

                stake,

                autoCashout

            }

        );

    }

    catch(error){

        clearBet(slot);

        console.error(error);
        throw error;

    }

}
//--------------------------------------------------
// Restore active bets after reconnect / host switch
//--------------------------------------------------

function restoreActiveBets(activeBets) {

    const slots = [null, null];

    activeBets.forEach((bet, index) => {

        if (index > 1) return;

        slots[index] = {

            betId: bet.id,

            stake: bet.stake,

            autoCashout: bet.autoCashout,

            status: "active",

            cashedOut: false,

            lost: false

        };

    });

    syncBets(slots);

}

    //--------------------------------------------------

    return {

    bets,

    betsRef,

    queuedBets,

    queuedRef,

    activateBet,

    queueBet,

    placeBet,

    cancelQueuedBet,

    consumeQueuedBets,
    restoreActiveBets,

    clearBet,
    updateBet,

    setBets,

    setQueuedBets,

    };

};
