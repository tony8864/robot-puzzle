# UI Theme — Robot Puzzle

**Status:** Current board visual guidance, reviewed 2026-11-11.

[Product requirements](product.md) define approved visuals and gameplay. This
guide records the board palette and presentation conventions; it does not approve
a broader redesign. Shared rendering lives in
[BoardSvg.tsx](../apps/web/src/components/BoardSvg.tsx), with presentation in
[styles.css](../apps/web/src/styles.css). Proposed changes stay in
[next release](next-release.md) until approved.

## 1. Visual direction

The interface uses a minimal, flat, dark-blue visual style.

- Avoid gradients, ornamental textures, and unnecessary depth effects.
- Keep board geometry crisp and easy to read on narrow phone screens.
- Preserve a clear visual hierarchy between subtle grid lines, internal walls,
  and the outer board boundary.

## 2. Approved colors

| Role | Color | Usage |
|---|---|---|
| Page background | `#080F1F` | Background behind the board and surrounding interface |
| Board cell background | `#111F35` | Background of playable board cells |
| Grid lines | `#263852` | Thin, subtle separation between cells |
| Outer boundary | `#7C96B8` | Thick, continuous border around the complete board |
| Internal walls | `#A8BED8` | Thick, light wall segments between adjacent cells; current appearance confirmed by the owner |
| Blocked central area | `#060D19` | Distinct fill for the blocked central 2×2 cells |
| Red robot | `#F45B69` | Filled circle for the red robot |
| Blue robot | `#4DA3FF` | Filled circle for the blue robot |
| Green robot | `#4DD4A0` | Filled circle for the green robot |
| Yellow robot | `#FFD166` | Filled circle for the yellow robot |
| Robot lettering | `#080F1F` | Dark letters inside robot pieces |
| Wildcard target | `#E4EDF7` | Neutral vortex distinct from robot colors |

The board palette uses semantic CSS tokens. Keep palette changes in those tokens
rather than repeating unrelated values throughout components. The active-target
fill and selected-robot ring are separate treatments described below.

## 3. Board treatment

- Every playable cell uses the board cell background.
- Grid lines are thin and visually subordinate to walls.
- The outer boundary is thick, continuous, and distinguishable from the grid.
- Internal walls are thick, light line segments placed precisely between adjacent
  cells.
- The central 2×2 blocked area uses the blocked-area color and must be clearly
  distinguishable from playable cells.
- The design remains flat: no gradient, texture, bevel, or simulated material
  is currently specified.

CSS defines the current stroke widths. Preserve this visual hierarchy and review
legibility at narrow-phone and larger viewport sizes when changing them:

```text
grid lines < outer boundary and internal walls
```

## 4. Robot treatment

- Render exactly four robots as simple filled circles.
- Use the approved red, blue, green, and yellow robot colors.
- Center the corresponding uppercase letter `R`, `B`, `G`, or `Y` inside each
  circle.
- Use dark, bold lettering with sufficient contrast against every robot color.
- Keep each circle slightly smaller than its cell so grid lines and nearby
  walls remain visible.
- Do not use color as the only robot identifier; the centered letter is part of
  the required design.
- Robots remain flat unless a later approved theme revision introduces another
  treatment.
- Indicate the selected robot with a **thin white ring** around its piece. This
  selection cue is separate from the active target's cell fill.

Robot lettering uses `#080F1F`. Each robot has a radius of `0.34` SVG cell
units (a diameter of `0.68` cell units), leaving the surrounding grid and walls
visible.

## 5. Target treatment

- Render **all 17 targets**: star, crescent moon, upright triangle and square
  in each robot color, plus one neutral vortex wildcard. Symbols identify target
  types; robot letters belong to the robot pieces, not the target artwork.
- Use the reusable SVG artwork in
  [TargetSymbol.tsx](../apps/web/src/components/TargetSymbol.tsx), without external
  images or an icon library. Colored targets use their corresponding robot color;
  the vortex uses neutral `#E4EDF7`.
- Keep inactive targets slightly muted and the active target at full brightness.
- Mark the active target with the approved **soft cell fill**, not a cell outline
  or concentric target rings. Keep the fill visible around a robot occupying the
  cell. It is not the selected robot's thin white ring.
- Render target artwork and the active-cell fill behind robots, preserving wall
  legibility. Highlighting does not change target identity or completion rules.
- Do not add gradients, textures, shadows, or three-dimensional effects.
- Provide accessible descriptions of target color/symbol/position and which
  target is active, alongside robot positions.

## 6. Responsive board treatment

- Render exactly 16 rows and 16 columns.
- Keep the board square at every supported viewport size.
- Maximize available width on mobile without introducing horizontal overflow.
- Keep robots, targets, grid lines, walls, and the outer boundary legible at
  narrow phone widths.
- Use a strong continuous outer boundary and cell-edge wall segments; walls
  must never be represented as filled cells.
- On phones, keep controls below the board, preserve accessible touch
  targets and clear focus/disabled/connection feedback, and respect reduced motion.
- Movement animation presents confirmed state; Reset moves all robots directly
  together, while reconnect/new attempts snap. See
  [architecture](architecture.md) for state and animation ownership.

## 7. Scope of future visual changes

Typography, panels, buttons and feedback states already exist in CSS; they are
not unimplemented tasks. This board guide does not establish that every current
application style has been separately approved. Preserve existing presentation
unless a scoped change is requested, and review any broader redesign explicitly.

The game is named Robot Puzzle. Future branding work, board-color changes,
coordinate gutters and laptop/breakpoint changes require their own review; they
are not approved by this cleanup or by the existing palette. Proposed additions
are tracked only in `next-release.md`.

Visual guidance is not proof of device compatibility. Test changed layouts on
narrow phones and relevant larger/shorter viewports; physical iPhone Safari and
broader device coverage remain subject to the limits in [PWA testing](pwa-testing.md).
