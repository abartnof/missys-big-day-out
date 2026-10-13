# Missy's Big Day Out

**[Play it in your browser](https://abartnof.github.io/missys-big-day-out/)**, or to play
offline, save [the page](https://github.com/abartnof/missys-big-day-out/raw/main/missys-big-day-out.html)
(right-click, *Save Link As*) and open it.

Missy, a little white dog, is loose on a city street. The street auto-scrolls, so keep
ahead of the left screen edge, eat everything you can, dodge the parrots, and don't let her
owner catch you.

## Controls

| Action | Keys |
| --- | --- |
| Move | Left / Right arrows |
| Jump (hold = higher) | Up arrow / Space |
| Duck (slow creep, can't jump) | Down arrow |
| Huff (scares parrots) | X |
| Pause / Mute | P or Esc / M |
| High scores (title screen) | L (hold C to clear) |

Touch (landscape): buttons live in the side gutters, never over the game (left, right, duck | jump, huff, pause); tap anywhere on the menu screens to start or continue. Portrait shows a rotate prompt.

## Rules

- Food is +1; steak, bacon, sausage and salmon hop and are worth +5. Score comes from food and bonus critters.
- Parrots cost 3 points. Hit one with fewer than 3 points and Missy is stunned for a second.
- Obstacles are solid: climb on top of them. Get squeezed between one and the left screen edge and it's over.
- Each level is 75 m long and ends at a toilet: walk Missy over and she lies down next to it. Food carries across levels; every level is a new street, a bit faster and trickier (parrot types and the owner's tricks unlock level by level).
- Rare bonus critters (bunny +10, kitty +15, froggy +20) can run across a level; just touch them. Only parrots hurt.
- The top 10 scores (with date and how far you got) are kept in your browser.
- Every so often the owner shouts something and charges across the street. Touch her and it's over.

## How it's made

The whole game is one self-contained page, `missys-big-day-out.html`: plain HTML5 canvas and
vanilla JS with the scripts inlined and every image embedded, so it makes no network requests.
It's built from the readable sources in `src/`:

```
python3 -I tools/build_single.py   # src/ -> missys-big-day-out.html and index.html (the same page)
```

To work on the sources directly, open `src/index.html` (or serve the folder with
`python3 -m http.server`). Commit the rebuilt `missys-big-day-out.html` along with any
source change; GitHub Pages serves it as-is.

`tools/art/build_art.py` draws the original art. `tools/pack_assets.py` and
`tools/recolor_fox.py` copy and recolor the third-party sprites from their asset packs,
which are not in this repo (they go in `assets_raw/`).

## Credits and license

The code, sound, music arrangements and original art (the street, buildings, parrots,
critters and bones) are MIT-licensed (`LICENSE`). The rest of the pixel art comes from
these creators and keeps their own terms; see `CREDITS.md`:

- Missy: [2D Pixel Art Fox Sprites](https://elthen.itch.io/2d-pixel-art-fox-sprites) by Elthen, recolored
- The owner: [MiniFolks - Villagers](https://lyaseek.itch.io/minifvillagers) by LYASeeK
- Food: [Pixel Mart](https://ghostpixxells.itch.io/pixel-mart) by ghostpixxells
- Font: [DotGothic16](https://fonts.google.com/specimen/DotGothic16) by Fontworks (SIL Open Font License)
- Music: public-domain melodies (Mozart, Foster, Joplin, Rossini, Grieg, Brahms, Bishop and more), arranged as chiptunes
