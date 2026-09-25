# Classic Ludo Rules Used by Ludo Play

The game board and movement engine are based on standard Ludo conventions checked during the September 2026 implementation review.

## Board geometry

- Four corner yards hold four tokens per player.
- Players enter the shared track only after rolling a 6.
- The shared path is traversed clockwise.
- Each color has its own start square and its own six-cell home approach.
- The final center is reached only with an exact roll.

The repository's original Flutter Ludo reference also models each color with its own fixed coordinate path; Ludo Play follows the same principle so board rendering and movement logic use one authoritative route.

## Rules implemented

- A token leaves base on 6 by default.
- A 6 grants another roll.
- A capture can grant another roll.
- Reaching the center can grant another roll.
- Star/start safe cells cannot capture.
- Two opponent tokens on one shared square form a block.
- A move cannot pass an opponent block.
- A move cannot land on an opponent block.
- A token cannot overshoot the center.
- Three consecutive sixes forfeit the turn.
- The winner is the first player to place all four tokens in the center.

These rules are configurable where the game model exposes the option because Ludo has regional/house-rule variations.

## Sources reviewed

- Yellow Mountain Imports: https://www.ymimports.com/pages/how-to-play-ludo
- Ludo Classic rules: https://ludo-classic.github.io/rules.html
- Play Board Games: https://www.playboardgames.org/how-to-play/ludo
- Wikipedia's Ludo overview: https://en.wikipedia.org/wiki/Ludo

Exact bonus-turn and block behavior varies between Ludo variants, so the rule choices remain explicit in the game configuration rather than being hidden in UI code.