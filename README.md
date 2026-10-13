# Missy's Big Day Out

A tiny browser game: Missy, a cream cocker spaniel, is let loose on a city street. The street auto-scrolls,
so keep ahead of the left screen edge, eat everything you can, dodge the parrots, and don't let her owner catch you.

Plain HTML5 canvas + vanilla JS. No build step needed to play, no libraries, no network requests.

## Play

- **Download and double-click:** `dist/missys-big-day-out.html` is a single self-contained file that works offline.
- **Run from source:** `python3 -m http.server` in this folder, then open http://localhost:8000
  (opening `index.html` directly from disk works too).
- **GitHub Pages:** Settings -> Pages -> "Deploy from a branch" -> branch `main`, folder `/ (root)`.
  The root `index.html` loads `game.js`, `audio.js` and `assets/` directly.

## Controls

| Action | Keys |
| --- | --- |
| Move | Left / Right or A / D |
| Jump (hold = higher) | Up / W / Space |
| Duck (slow creep, can't jump) | Down / S |
| Huff (scares parrots) | X / K |
| Pause / Mute | P or Esc / M |

Touch: on-screen buttons (left, right, duck, jump, huff); tapping the game also jumps.

## Rules

- Food is +1; steak, bacon, sausage and salmon hop and are worth +5. Score comes only from food.
- Parrots cost 3 points. Hit one with fewer than 3 points and Missy is stunned for a second.
- Obstacles are solid: climb on top of them. Get squeezed between one and the left screen edge and it's over.
- Every so often the owner shouts something and charges across the street. Touch her and it's over.

## Build the single file

```
python3 -I tools/build_single.py     # writes dist/missys-big-day-out.html
python3 -I tools/pack_assets.py      # (only if assets_raw/ changes) re-copies assets/, recolors parrots
```

Layout: `index.html`, `game.js`, `audio.js` (synthesized sounds), `assets/` (only what the game uses),
`assets_raw/` (untouched source art), `tools/` (asset prep and the single-file builder).
