// Game timings

export const WAITING_TIME = 7000;

export const ANIMATION_FPS = 60;

export const HOUSE_EDGE = 0.95;

export const MULTIPLIER_SPEED = 0.00006;



// Betting

export const MIN_BET = {

    KES:10,

    UGX:500,

    TZS:1000

};



export const QUICK_AMOUNTS = [

    100,

    200,

    500,

    1000

];



// Bet Status

export const BET_STATUS = {

    IDLE:"idle",

    QUEUED:"queued",

    ACTIVE:"active",

    CASHED:"cashed",

    LOST:"lost"

};



// Game phases

export const GAME_PHASE = {

    WAITING:"waiting",

    FLYING:"flying",

    CRASHED:"crashed"

};