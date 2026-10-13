# Missy's Big Day Out

**[Play it in your browser](https://abartnof.github.io/missys-big-day-out/)**, or to play
offline, save [the page](https://github.com/abartnof/missys-big-day-out/raw/main/missys-big-day-out.html)
(right-click, *Save Link As*) and open it.

Missy, a cream cocker spaniel, is loose on a city street. The street auto-scrolls, so keep
ahead of the left screen edge, eat everything you can, dodge the parrots, and don't let her
owner catch you.

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

## How it's made

The whole game is one self-contained page, `missys-big-day-out.html`: plain HTML5 canvas and
vanilla JS with the scripts inlined and every image embedded, so it makes no network requests.
It's built from the readable sources in `src/`:

```
python3 -I tools/build_single.py   # src/ -> missys-big-day-out.html
```

To work on the sources directly, open `src/index.html` (or serve the folder with
`python3 -m http.server`). Commit the rebuilt `missys-big-day-out.html` along with any
source change; GitHub Pages serves it as-is.

`tools/pack_assets.py` and `tools/recolor_fox.py` regenerate `src/assets/` from the original
asset packs, which are not in this repo (they go in `assets_raw/`).

## Credits

- Dog: [2D Pixel Art Fox Sprites](https://elthen.itch.io/2d-pixel-art-fox-sprites) by Elthen, recolored
- Owner: Minifolks Villagers
- Street: [Pixel Streets Pack](https://fadinfadin.itch.io/pixelstreetspack) by fadinfadin
- Food: Pixel Mart
- Parrots: Free Animal Pack, recolored
