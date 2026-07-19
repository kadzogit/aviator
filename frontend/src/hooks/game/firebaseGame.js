import { useRef } from "react";
import {
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../lib/firebase";
import { generateMultiplier } from "./helpers";

const PHASE_STUCK_TIMEOUT = 8000; // If a phase lasts longer than 8 seconds, it's stuck


export function useFirebaseGame() {
  //----------------------------------------------------
// Prevent animation restarting every Firestore update
//----------------------------------------------------

const startedRoundRef = useRef(null);
  const phaseStartTimeRef = useRef(null);
  const stuckPhaseCheckRef = useRef(null);

  //----------------------------------------------------
  // Detect and recover from stuck phases
  //----------------------------------------------------
  function startStuckPhaseDetector(gameState, hostController, firebaseGame) {
    if (stuckPhaseCheckRef.current) clearInterval(stuckPhaseCheckRef.current);

    stuckPhaseCheckRef.current = setInterval(async () => {
      if (!gameState || !phaseStartTimeRef.current) return;

      const phaseDuration = Date.now() - phaseStartTimeRef.current;

      // If crashed phase lasts too long, transition to waiting
      if (
        gameState.phase === "crashed" &&
        phaseDuration > PHASE_STUCK_TIMEOUT
      ) {
        console.warn(
          "[StuckPhaseDetector] Crashed phase stuck for",
          phaseDuration,
          "ms. Recovering..."
        );
        try {
          await firebaseGame.finishRound(gameState.crashMultiplier || 1);
        } catch (err) {
          console.error("[StuckPhaseDetector] Recovery failed:", err);
        }
      }

      // If flying phase lasts too long (crash multiplier reached), force crash
      if (gameState.phase === "flying" && phaseDuration > PHASE_STUCK_TIMEOUT) {
        console.warn(
          "[StuckPhaseDetector] Flying phase stuck for",
          phaseDuration,
          "ms. Forcing crash..."
        );
        try {
          await firebaseGame.finishRound(gameState.crashMultiplier || 1);
        } catch (err) {
          console.error("[StuckPhaseDetector] Force crash failed:", err);
        }
      }
    }, 2000);
  }

  function stopStuckPhaseDetector() {
    if (stuckPhaseCheckRef.current) {
      clearInterval(stuckPhaseCheckRef.current);
      stuckPhaseCheckRef.current = null;
    }
  }
  //----------------------------------------------------
  // Subscribe to current game
  //----------------------------------------------------
  function subscribeToGame(setters, engines) {

    const {
        setGameState,
        setGamePhase,
        setMultiplier,
        setPastMultipliers,
        setBets
    } = setters;

    const {
        animationEngine,
        bettingEngine,
        roundEngine,
        hostController,
        firebaseGame
    } = engines;

    return onSnapshot(
        doc(db, "gameState", "current"),
        async (snapshot) => {

            if (!snapshot.exists()) {

                await bootstrapGame();

                return;

            }

            const game = snapshot.data();

            // Track phase start time for stuck detection
            if (game.phase !== phaseStartTimeRef.current) {
              phaseStartTimeRef.current = game.phase;
              // Reset the timer when phase changes
              if (phaseStartTimeRef.current) {
                phaseStartTimeRef.current = Date.now();
              }
            }

            //--------------------------------------------------
            // Update UI
            //--------------------------------------------------

            setGameState(game);

            setGamePhase(game.phase);

            // NOTE: the multiplier itself is intentionally *not*
            // set here. It's driven locally by animationEngine
            // below (60fps, computed from startTimeMs) so every
            // tab animates smoothly and in sync instead of only
            // updating whenever a Firestore snapshot happens to
            // arrive.

            //--------------------------------------------------
            // Flying
            //--------------------------------------------------

            if (game.phase === "flying") {

                if (startedRoundRef.current !== game.roundId) {

                    startedRoundRef.current = game.roundId;

                    animationEngine.startAnimation(
                        game.crashMultiplier,
                        game.startTimeMs
                    );

                    roundEngine.onRoundStarted(

                        bettingEngine.consumeQueuedBets,

                        bettingEngine.placeBet

                    );

                }

                return;

            }

            //--------------------------------------------------
            // Crashed
            //--------------------------------------------------

            if (game.phase === "crashed") {

                animationEngine.stopAnimation();

                setMultiplier(game.multiplier || game.crashMultiplier || 1);

                setPastMultipliers(prev => [

                    game.crashMultiplier,

                    ...prev

                ].slice(0, 25));

                roundEngine.onRoundEnded(

                    bettingEngine.betsRef,

                    bettingEngine.clearBet

                );

                return;

            }

            //--------------------------------------------------
            // Waiting
            //--------------------------------------------------

            if (game.phase === "waiting") {

    startedRoundRef.current = null;

    animationEngine.stopAnimation();

    setMultiplier(1);

    setBets([null, null]);

    const becameHost =
        await hostController.tryBecomeHost(game);

    if (becameHost) {

        hostController.startHosting();

        await hostController.hostStartRound(firebaseGame);

    }

    return;

}

        }

    );

}

  //----------------------------------------------------
  // Load history
  //----------------------------------------------------
  const loadHistory = async () => {
    const q = query(
      collection(db, "rounds"),
      orderBy("startTime", "desc"),
      limit(25)
    );

    const snap = await getDocs(q);

    return snap.docs
      .map((d) => d.data())
      .filter((r) => r.crashMultiplier);
  };

  //----------------------------------------------------
  // Bootstrap game
  //----------------------------------------------------
  const bootstrapGame = async () => {
    const ref = doc(db, "gameState", "current");

    const snap = await getDoc(ref);

    if (snap.exists()) return;

    const crash = generateMultiplier();

    await setDoc(ref, {
      phase: "waiting",
      multiplier: 1,
      crashMultiplier: crash,
      roundId: crypto.randomUUID(),
      startTime: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  };

  //----------------------------------------------------
  // Start round
  //----------------------------------------------------
 const startRound = async (crashMultiplier) => {
  await updateDoc(
    doc(db, "gameState", "current"),
    {
      phase: "flying",
      multiplier: 1,
      crashMultiplier,
      roundId: crypto.randomUUID(),
      startTime: serverTimestamp(),
      startTimeMs: Date.now()
    }
  );
};
//----------------------------------------------------
// Update multiplier during flight
//----------------------------------------------------

const updateMultiplier = async (multiplier) => {

  await updateDoc(
    doc(db, "gameState", "current"),
    {
      multiplier
    }
  );

};

  //----------------------------------------------------
  // Finish round
  //----------------------------------------------------

  const finishRound = async (multiplier) => {

    // Show the crash
    await updateDoc(
        doc(db, "gameState", "current"),
        {
            phase: "crashed",
            multiplier,
            endedAt: serverTimestamp()
        }
    );

    // Keep the crash visible for 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Return to waiting
    await updateDoc(
        doc(db, "gameState", "current"),
        {
            phase: "waiting",
            multiplier: 1,
            crashMultiplier: generateMultiplier(),
            roundId: crypto.randomUUID(),
            startTime: serverTimestamp(),
            startTimeMs: null,
            endedAt: null
        }
    );

};
  return {
    subscribeToGame,
    loadHistory,
    bootstrapGame,
    startRound,
    updateMultiplier,
    finishRound,
    startStuckPhaseDetector,
    stopStuckPhaseDetector,
  };
}