import { useState, useEffect, useRef } from "react";

import {
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    where,
    onSnapshot,
} from "firebase/firestore";

import { db } from "../lib/firebase";

import { useAuth } from "../context/AuthContext";
import { useHostController } from "./game/hostController";

// deleted this gpt said not used ... import { generateMultiplier } from "./game/helpers";

import { useAnimationEngine } from "./game/animationEngine";

import { useBettingEngine } from "./game/bettingEngine";

import { useCashoutEngine } from "./game/cashoutEngine";

import { useRoundEngine } from "./game/roundEngine";

import { useFirebaseGame } from "./game/firebaseGame";

import { useSoundEffects } from "./useSoundEffects";

//keep the states

export function useGame() {
 const { user, profile, refreshProfile } = useAuth();

  const [gameState,        setGameState]        = useState(null);

  const [gamePhase,        setGamePhase]         = useState("waiting");

  const currency      = { KE: "KES", TZ: "TZS", UG: "UGX" }[profile?.country] || "KES";
  const activeBalance = profile?.mode === "demo"
    ? (profile?.demoBalance || 0)
    : (profile?.balance || 0);
    const animationEngine = useAnimationEngine();
    const multiplier =
    animationEngine.multiplier;
  
  const {

    bets,

    setBets,

    betsRef,

    queuedBets,

    setQueuedBets,

    queuedRef,

    placeBet,

    queueBet,

    clearBet,

    updateBet,

    consumeQueuedBets

} = useBettingEngine(

    user,

    profile,

    gameState,

    currency,

    activeBalance

);

  const [pastMultipliers,  setPastMultipliers]   = useState([]);
  const [liveBets,         setLiveBets]          = useState([]);
  const [error,            setError]             = useState(null);
  const [winNotif,         setWinNotif]          = useState(null);

  const sound = useSoundEffects();

  // Crash sound - fires once per round, right as the phase flips.
  const lastPhaseRef = useRef("waiting");
  useEffect(() => {
    if (gamePhase === "crashed" && lastPhaseRef.current !== "crashed") {
      sound.playCrash();
    }
    lastPhaseRef.current = gamePhase;
  }, [gamePhase]);


  const bettingEngine = {

    bets,

    betsRef,

    queuedBets,

    queuedRef,

    placeBet,

    queueBet,

    clearBet,

    consumeQueuedBets,

    setBets,

    setQueuedBets

};
const hostController =
    useHostController(user, profile);
const cashoutEngine = useCashoutEngine(profile, user);

const roundEngine = useRoundEngine();

const firebaseGame = useFirebaseGame();


  // ── Load past multipliers on mount ────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const q    = query(collection(db, "rounds"), orderBy("startTime", "desc"), limit(25));
        const snap = await getDocs(q);
        setPastMultipliers(snap.docs.map(d => d.data().crashMultiplier).filter(Boolean));
      } catch (err) {   console.error(err); }
    })();
  }, []);


  //replace the useEffect with ...
  useEffect(() => {
    if (!user) return;

    // Use a ref to keep track of the subscription to avoid multiple subscriptions
    let unsub = null;

    const startSubscription = () => {
      unsub = firebaseGame.subscribeToGame(
        {
          setGameState,
          setGamePhase,
          setMultiplier: animationEngine.setMultiplier,
          setPastMultipliers,
          setBets,
          setQueuedBets,
          queuedBetsRef: queuedRef,
          betsRef
        },
        {
          animationEngine,
          roundEngine,
          bettingEngine,
          hostController,
          firebaseGame
        }
      );
    };

    startSubscription();

    // Start stuck phase detector - we pass a getter or handle it inside
    firebaseGame.startStuckPhaseDetector(null, hostController, firebaseGame);

    return () => {
      if (unsub) unsub();
      firebaseGame.stopStuckPhaseDetector();
    };
  }, [user]); // Only re-subscribe if user changes

useEffect(() => {

    return () => {

        hostController.stopHosting();

        firebaseGame.stopStuckPhaseDetector();

    };

}, []);

  // WATCHDOG
//was removed caused many writes disabling firebase 

  // ── Live bets for current round ───────────────────────────
  useEffect(() => {
    if (!gameState?.roundId) return;
    const q    = query(
      collection(db, "bets"),
      where("roundId", "==", gameState.roundId),
      limit(50)
    );
    const unsub = onSnapshot(q, snap =>
      setLiveBets(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [gameState?.roundId]);
  

// ── Cash Out ────────────────────────────────────────────────
  //
  // NOTE: this used to be `const cashout = cashoutEngine.cashout`,
  // but useCashoutEngine() only ever returned `creditWinnings` -
  // `cashout` was undefined, so pressing "Cash Out" threw at
  // runtime. This wraps creditWinnings properly and is now the
  // single source of truth both the button and auto-cashout call.
  async function cashout(slotIdx) {

    const bet = betsRef.current[slotIdx];

    if (!bet || bet.cashedOut || bet.lost || gamePhase !== "flying") return;

    // Flip the local flag immediately so a second click (or the
    // auto-cashout watcher below) can't fire twice for the same bet
    // while the balance transaction is still in flight.
    updateBet(slotIdx, { cashedOut: true });

    await cashoutEngine.creditWinnings(
      bet,
      multiplier,
      currency,
      slotIdx,
      clearBet,
      setWinNotif
    );

    sound.playCashout();

    refreshProfile?.();
  }

  // ── Auto Cash Out ───────────────────────────────────────────
  //
  // The betting panel already lets a player set an auto-cashout
  // target and it was being saved on the bet, but nothing ever
  // watched the live multiplier against it. This does.
  useEffect(() => {

    if (gamePhase !== "flying") return;

    betsRef.current.forEach((bet, slot) => {

      if (
        bet &&
        !bet.cashedOut &&
        !bet.lost &&
        bet.autoCashout &&
        multiplier >= bet.autoCashout
      ) {
        cashout(slot);
      }

    });

  }, [multiplier, gamePhase]);

  async function placeBetWithSound(slot, stake, autoCashout) {
    await placeBet(slot, stake, autoCashout);
    sound.playBet();
  }

  return {
    gameState, multiplier, gamePhase, bets, queuedBets, setQueuedBets, pastMultipliers,
    liveBets, error, winNotif, currency, activeBalance,
    placeBet: placeBetWithSound, queueBet, cashout,
    muted: sound.muted, setMuted: sound.setMuted,
  };
}
