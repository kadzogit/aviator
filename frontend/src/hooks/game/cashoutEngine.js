import { runTransaction, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";

export function useCashoutEngine(profile, user) {

    //--------------------------------------------------

    async function creditWinnings(

        bet,

        multiplier,

        currency,

        slot,

        clearBet,

        showWin

    ) {

        const winnings = Number(

            (bet.stake * multiplier).toFixed(2)

        );

        const field =

            profile?.mode === "demo"

                ? "demoBalance"

                : "balance";

        try {

            await runTransaction(

                db,

                async transaction => {

                    const userRef = doc(

                        db,

                        "users",

                        user.uid

                    );

                    const snap =

                        await transaction.get(

                            userRef

                        );

                    const balance =

                        snap.data()[field] || 0;

                    transaction.update(

                        userRef,

                        {

                            [field]:

                                balance +

                                winnings

                        }

                    );

                }

            );

            showWin({

                slotIdx: slot,

                winnings,

                mult: multiplier

            });

            /*
               IMPORTANT

               Free the slot immediately.

               This fixes the bug where after cashout
               you couldn't place another bet.
            */

            clearBet(slot);

        }

        catch (err) {

            console.error(err);

        }

    }

    //--------------------------------------------------

    return {

        creditWinnings

    };

}