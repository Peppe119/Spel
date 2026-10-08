# NEON GETAWAY

A top-down arcade getaway game set in a neon cyberpunk city. Outrun the police,
grab cash and keep your combo alive while the wanted level climbs.

## Play

Open `index.html` in any modern browser. There is no build step, no server and
no dependencies; everything (graphics and sound) is generated in code.

If you'd rather serve it locally: `npx serve .` or `python3 -m http.server`.

## Controls

| Action           | Keyboard                       | Touch                    |
| ---------------- | ------------------------------ | ------------------------ |
| Drive            | `W A S D` / arrow keys          | Drag in the direction to go |
| Handbrake drift  | `Space` / `Shift`              | Automatic on hard turns  |
| Start / restart  | `Space`                        | Tap                      |
| Pause            | `P` / `Esc`                    | —                        |
| Mute             | `M`                            | ♪ button                 |

## Rules

- **Score** comes from survival time (worth more at higher wanted levels) and cash pickups.
- **Combo:** grab cash within 4.5 s of the last pickup to raise the multiplier (up to x8).
  Police contact breaks the combo.
- **Busted:** while a police car touches you, the bust meter fills, much faster
  when you're slow or boxed in. When it's full, the game is over.
- **Crashing** into buildings bleeds speed and can leave you exposed.
- **Wanted level** rises with time and cash collected. Each star brings more and
  faster police with smarter interception. Past five stars it keeps getting harder.
- Your best score is saved in `localStorage`.

## Code layout

```
index.html       page, HUD and overlays
css/style.css    UI styling
js/util.js       math helpers and cached glow sprites
js/city.js       city generation, collision, navigation grid, world rendering
js/cars.js       car physics, police AI, car rendering
js/effects.js    particles, tire marks, score pop-ups
js/audio.js      Web Audio synthesized engine, siren and sound effects
js/game.js       game state, loop, input, difficulty, camera, HUD
```

The police share one BFS distance field to the player (updated 5× per second),
and switch to direct pursuit with lead prediction when they have line of sight.
