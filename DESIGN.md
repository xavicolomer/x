# Nido design system

Clean, white, minimal. The rooms are the colour; the interface stays out of their way.
Tokens live at the top of `src/index.html` (`:root`); components use the tokens, never raw values.
Which control does which job follows the shared "one job, one control" standard (UI_CONTROLS.md, kept outside this repository).

## Colour

| Token | Value | Use |
|---|---|---|
| `--bg` | `#ffffff` | Page |
| `--surface` | `#ffffff` | Panels, cards, dialogs |
| `--surface-2` | `#f4f4f2` | Fills: inputs, idle chips, picture backgrounds, segmented tracks |
| `--scene` | `#f2f2f0` | Behind the 3D room |
| `--fg` | `#141414` | Text |
| `--muted` | `#6a6a66` | Secondary text (5.5:1 on white) |
| `--line` | `#e7e7e4` | Borders and dividers |
| `--accent` | `#2c6b58` | The one accent: primary buttons, selection, focus, links |
| `--accent-soft` | `#e8f2ee` | Selected tabs and tags |
| `--clay` | `#a5543f` | Prices, and the Measure and Paint tools in the 3D |
| `--bad` | `#b2391b` | Destructive actions and errors |

White only: there is no dark theme.

## Shape

| Token | Value | Use |
|---|---|---|
| `--r-btn` | `999px` | Fully rounded ends: buttons, chips, segmented controls and their options, tabs, tags |
| `--r-panel` | `10px` | Panels: cards, the studio's side and property panels, toolbars, dialogs, toasts, input fields |
| `--r-media` | `6px` | Small pictures inside a panel: thumbnails, wallpaper swatches |

Colour dots are circles. Bottom sheets on phones round their top corners only (`10px 10px 0 0`).

## Edges and elevation

One or the other, never both:

- **On the page:** a 1px `--line` border, no shadow (cards, boxes, list rows).
- **Floating over the 3D or the page:** `--elev`, a single soft shadow, and no border (studio panels and toolbars, dialogs, toasts).

## Logo

A house inside a scan frame, drawn in Lucide's line style: four rounded corner marks (Lucide's `scan`) around a small house. It reads as "your home, measured to the centimetre". Strokes are 2 on a 24-unit grid, with round caps and joins, in `--accent`, next to the word "Nido". The same mark, in `#2c6b58`, is the browser-tab icon.

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
  <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
  <path d="M7 11.5 12 7.5l5 4V17H7z"/>
</svg>
```

## Type

Geist for everything, Geist Mono for numbers that must line up (sizes, prices, strip counts): technical, but clear. Headings are Geist at 800 with tight tracking (-0.025em); body 14px; small text 12.5px. Both are open-licensed (SIL OFL), loaded from Google Fonts on the web and bundled in `src/fonts` for the offline file.

## Controls

- **Primary button:** the one filled (`--accent`) button in a view.
- **Secondary button:** white with a `--line` border.
- **Chip:** filters and choices among many; filled `--accent` when on.
- **Segmented control:** a `--surface-2` pill track; the chosen option is a white pill.
- **Field:** a `--surface-2` fill, a `--line` border, and `--accent` on focus.
- **Picker field:** the input for choosing a shop's product (a floor, a paint, a wallpaper, a moulding). A field with the chosen product's picture, name, shop and price, and a chevron; empty, it says what you get without one. It opens the picker dialog.
- **Picker dialog:** title and Close, a search box and one row of filter chips (what tells that material's products apart: surface, shape, ready-made or mixed), then option cards. A card is one button: tap it to choose and close. The chosen card has an `--accent` border and a "✓ Chosen" tag. "Not from a shop" is the first card where it makes sense. Add furniture is a picker dialog too.
- **Dialogs on phones** (760 px and narrower): picker dialogs fill the screen with square corners and two columns of cards; their title, search and filters stay at the top while the cards scroll, and the filter chips scroll sideways in one line. Other dialogs stay centred cards.
