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
- **Room tree** (the studio's Room tab, beside Shopping: one row of two tabs): the room as a tree of lines, each a picture or glyph, a name and a summary (the room and its size, the floor, each wall and its finish; under a wall its windows, doors and radiators, its two parts when split, its mouldings and its rail; the furniture and each piece). A line opens its own page with a "‹ back" link to its parent, the same on desktop and phones. A wall or a piece tapped in the room opens its page or panel; a piece's panel floats at the right on wide screens and takes the sheet's place on phones. What can be added to a wall ("Add window", "Add mouldings or panels", "Add a rail") is a row of outlined buttons on that wall's page. Tapping the Room tab again goes back to the tree.
- **Studio** (the room first): the 3D room fills the screen and everything floats over it.
  - **Top bar**, one row of 44 px round buttons and one label: Back (just the arrow), the room's name with "Saved" (or whose room it is) under it, a ⋯ menu (Download, Take out of Explore) and the one primary button: Publish (or Update in Explore) is a filled round arrow, its name in its tooltip and for screen readers; a published room's visitors get Copy to my homes, in words. When the home has several rooms, the name is the face of the rooms menu. The home's own name is a field on the Rooms tab.
  - **Over the room, top right:** a column of 44 px round icon toggles with `aria-pressed`, a tooltip and an icon that fills when on: Plan view on its own (3D when it's off), then Evening light, Measure and Paint. A tool's toggle, tapped again, goes back to selecting; there is no Select button. On the first visit the toggles show their names beside them until one is tapped.
  - **Fit** (corner marks), bottom right: frames the room again.
  - **Panel:** at the left on wide screens (landscape phones too). On phones (760 px and narrower) it is a bottom sheet with a handle and three heights: low (the handle and one line saying what's open: the room's size, a wall's finish, a piece, the measurement or the tins), half, and full (up to the top bar). It opens low. A wall or a piece tapped raises it to half; empty floor lowers it and lets go of what was picked; Measure and Paint lower it; turning the room never moves it. Tapping the handle steps it up (and from full, back to low); the handle, the line and the tabs can also be dragged.
  - **Camera:** frames the room in the part of the screen the bar and the panel leave clear (the view's centre slides with `setViewOffset`; the distance fits the room's box from the usual high front-left view). When the sheet moves, the room glides to fit again, until someone turns or zooms it; then only its centre moves. A sheet above half covers the room anyway, so the room stays framed for half.
  - **Jobs** (UI_CONTROLS.md): navigation is the back arrow, the rooms menu and the panel's one tab row; the display option, Plan view, is a round toggle rather than a segmented control, so that everything floating over the room reads as one column of round buttons; the one setting is the Evening light toggle, and Measure and Paint are tool toggles in the same style; inputs are the panel's fields and pickers; actions are the one primary button, the ⋯ menu, Fit and the panel's buttons.
- **Picker field:** the one input for choosing a material: a floor, a paint, a wallpaper, a moulding. Always there, whether or not a shop lists that material. A field with the chosen product's picture, name, shop and price, and a chevron; with no shop's product chosen, it says what you have instead (a Nido floor, your own colour, any moulding). It opens the picker dialog. Choices that aren't a shop's sit in the same picker: the floors Nido draws, your uploaded wallpaper images and an upload card, "your own colour". Paint has no Nido list: the provisional Nido Paint brand stands in (docs/CATALOG.md).
- **Picker dialog:** title and Close, a search box and one row of filter chips (what tells that material's products apart: surface, shape, ready-made or mixed), then option cards. A card is one button: tap it to choose and close. The chosen card has an `--accent` border and a "✓ Chosen" tag. "Not from a shop" is the first card where it makes sense. Add furniture is a picker dialog too.
- **Dialogs on phones** (760 px and narrower): picker dialogs fill the screen with square corners and two columns of cards; their title, search and filters stay at the top while the cards scroll, and the filter chips scroll sideways in one line. Other dialogs stay centred cards.
