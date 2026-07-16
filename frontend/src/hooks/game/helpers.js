// ----------------------------------------------------
// Random crash multiplier
// ----------------------------------------------------

export function generateMultiplier() {

    const r = Math.random();

    let raw;

    // 70% of rounds
    if (r < 0.70) {

        raw = 3 + Math.random() * 7;      // 3x - 10x

    }

    // 25%
    else if (r < 0.95) {

        raw = 10 + Math.random() * 40;    // 10x - 50x

    }

    // Jackpot
    else {

        raw = 50 + Math.random() * 450;   // 50x - 500x

    }

    return Number(raw.toFixed(2));

}


// ----------------------------------------------------
// Duration of a round
// ----------------------------------------------------

export function roundDuration(multiplier) {

    // Must use the exact same constant as calculateMultiplier()
    // below, otherwise the host schedules "finishRound" for a time
    // that doesn't match when clients' own local formula actually
    // reaches the crash point - causing the plane/curve to freeze
    // early or overshoot right before a crash.
    return Math.ceil(

        Math.log(multiplier) / 0.00004

    );

}



// ----------------------------------------------------
// Multiplier growth
// ----------------------------------------------------

export function calculateMultiplier(elapsed) {

    return Number(

        Math.exp(elapsed * 0.00004)

    );

}



// ----------------------------------------------------
// Currency formatter
// ----------------------------------------------------

export function formatMoney(amount) {

    return Number(amount || 0).toLocaleString(

        undefined,

        {

            minimumFractionDigits:2,

            maximumFractionDigits:2

        }

    );

}



// ----------------------------------------------------
// Clamp value
// ----------------------------------------------------

export function clamp(value,min,max){

    return Math.min(

        max,

        Math.max(min,value)

    );

}



// ----------------------------------------------------
// Timestamp
// ----------------------------------------------------

export function now(){

    return Date.now();

}