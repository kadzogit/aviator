// ======================================================
// Premium Crash Animation
// (particle burst + shockwave only - the "FLEW AWAY" text
// lives once, in the DOM multiplier overlay, so it isn't
// drawn a second time here)
// ======================================================

export function drawCrash(
    ctx,
    x,
    y,
    frame
) {

    //----------------------------------------------------
    // Faster explosion
    //----------------------------------------------------

    const maxFrames = 18;

    if (frame < maxFrames) {

        for (let i = 0; i < 20; i++) {

            const angle =
                (i / 20) * Math.PI * 2;

            const radius =
                frame * 5;

            const alpha =
                Math.max(
                    0,
                    1 - frame / maxFrames
                );

            ctx.beginPath();

            ctx.arc(

                x + Math.cos(angle) * radius,

                y + Math.sin(angle) * radius,

                Math.max(
                    1.5,
                    5 - frame * 0.18
                ),

                0,

                Math.PI * 2

            );

            ctx.fillStyle =
                `rgba(255,${180 - frame * 6},20,${alpha})`;

            ctx.fill();

        }

    }

    //----------------------------------------------------
    // Shockwave
    //----------------------------------------------------

    if (frame < 10) {

        ctx.save();

        ctx.beginPath();

        ctx.arc(

            x,

            y,

            frame * 10,

            0,

            Math.PI * 2

        );

        ctx.strokeStyle =
            `rgba(255,80,80,${1 - frame / 10})`;

        ctx.lineWidth = 3;

        ctx.stroke();

        ctx.restore();

    }

}