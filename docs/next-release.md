# Next Release — Robot Puzzle

## Starting point

- Source release baseline: Git tag `v1.0.0`; deployed version unverified.
- Public app URL: https://robot-puzzle.tonyivanov88.workers.dev
  (HTML shell returned HTTP 200 on 2026-11-11; see `docs/deployment.md` for limits).
- Confirm git status and recent commits before making changes.
- The next release number has not been decided.

## Working approach

- Read AGENTS.md, docs/product.md, and docs/architecture.md.
- Work on one small, verifiable change at a time.
- Explain important design decisions so I can understand the architecture.
- Discuss gameplay changes before implementing them.
- Update product rules and tests when a rule change is explicitly approved.
- Keep this checklist current; do not create separate task documents by default.
- Preserve unrelated changes. Do not commit or deploy without approval.

## Proposed additions

### 1. Board coordinates
- [x] Desktop coordinates: columns A–P above, rows 1–16 to the left, centered on cells.
- Use muted text and 20px gutters inside the existing square board allocation;
  the SVG stays square and unchanged. Labels appear from 1024px at minimum 4:3
  aspect ratio; mobile retains the original board without gutters.
- Verified: 73 component tests, 2 responsive browser tests, Web/E2E typechecks
  (web via build), production build and whitespace check passed. Browser checks
  measure all label centers against cells; desktop screenshot reviewed.

### 2. Board colors
- [ ] Change the central four cells' color.
- Agree on the exact center-cell color before implementation.
- Keep the current light internal walls, as confirmed by the owner.
- No movement or board-geometry changes.

### 3. Bid revisions
- [ ] Allow players to raise their own bids, not only lower them.
- This is a proposed rule change, not a correction to the existing rules.
- Agree on:
  - Whether revisions are unrestricted while bidding is open.
  - Tie priority after a revision, especially after raising a bid.
  - Whether the original deadline remains unchanged.
- The server must validate revisions and reject bids after closure.

### 4. End bidding early
- [ ] Provide a way to avoid waiting when players agree the solution is trivial.
- Agree on:
  - Who may request early closure.
  - Whether other players must consent.
  - What happens to accepted bids and simultaneous submissions.
- Preserve a server-authoritative deadline and demonstration order.

### 5. Post-round discussion
- [ ] Let players inspect the board and discuss ideas after a round.
- The current result modal obscures the board.
- Agree on:
  - Whether to change the result presentation or introduce a new phase.
  - Which robot positions are displayed.
  - Whether the board is read-only or supports exploration.
  - Who advances to the next round.
- Keep exploratory positions separate from official game state if exploration
  is approved.

### 6. Audio
- [ ] Add optional sound effects for agreed interactions.
- [ ] Consider background music separately.
- Agree on sound triggers, default settings, mute controls, and remembered
  preferences.
- Audio must not be necessary to understand or play the game.

### 7. Laptop and responsive layout
- [ ] Improve laptop presentation and review the existing UI breakpoints.
- A friend now plays on a laptop; keep phone/tablet play supported as well.
- Before implementation, inspect current layout rules and obtain the friend's
  browser viewport size and zoom when available. Identify the actual layout
  problems rather than assuming the laptop model determines the breakpoint.
- Propose layout and breakpoints based on available width and height, including
  short laptop windows, before changing CSS.
- Preserve a square, legible board, accessible controls, and minimum 44px touch
  targets. Coordinate spacing with the new board letters and numbers.
- Preserve working phone layouts. Do not automatically restore the previously
  rejected two-column layout; any side-by-side layout needs explicit approval.
- Review lobby, thinking/bidding, demonstration, discussion and results screens.
- Presentation only: no changes to board geometry, movement, or server authority.

## Suggested order

1. Laptop/responsive layout, coordinated with board-coordinate placement.
2. Board coordinates.
3. Board colors.
4. Bid revisions.
5. Early bidding closure.
6. Post-round discussion.
7. Sound effects, then optional music.

## Current focus

- [x] Final demonstration spacing: owner's 48px robot row gap and 48px separation
  between robot selectors and D-pad retained for this checkpoint; supersedes
  earlier 12px spacing measurements below.

- [x] Local bidding shortcut: optional `LOCAL_BIDDING_WINDOW_SECONDS` (1–60),
  guarded by `APP_ENV=local`, changes only the server deadline on a first accepted
  bid. Production/default/shared rules remain 60 seconds; persisted deadlines,
  retries and reductions keep the original cutoff. Local setup documented.
  Enabled 3 seconds in ignored `.dev.vars`; backend restart required. Automated
  tests disable the manual override. Verification: 16 bidding tests, 25 socket
  tests, 2 production-config tests and server typechecks passed. Changed server/
  docs whitespace check passed; existing UI whitespace left untouched.

- [x] Complete desktop robot-column alignment: B/Y centers align with the right
  arrow, matching R/G alignment with the left arrow. Other spacing and mobile unchanged.
  Verification: both responsive browser tests and whitespace check passed.

- [x] Desktop demonstration alignment, first step: move only R/G so their centers
  align vertically with the left arrow. B/Y, D-pad, button sizes and mobile unchanged.
  Verification: both responsive browser tests and whitespace check passed;
  measured R/G alignment and preserved right-column placement.

- [x] Restore desktop demonstration robot selectors to 2×2 (R/B above G/Y),
  retaining current D-pad placement, spacing, button styles and mobile layout.
  This supersedes the horizontal selector row recorded below. Deferring removal
  of desktop on-screen movement controls to a later release.
  Verification: both responsive browser tests and whitespace check passed.

- [x] Desktop demonstration cluster refinement: one horizontal R/B/G/Y row with
  unchanged 48px selectors, centered D-pad 12px below. Flexible spacers put the
  cluster in the upper-middle of available space; bottom actions and mobile
  presentation unchanged. Supersedes the earlier desktop 2×2 selector layout.
  Verification: both responsive browser tests and whitespace check passed;
  checked robot order, upper-middle placement, 12px D-pad gap, bottom actions
  and mobile layout; desktop screenshot reviewed.

- [x] Desktop demonstration header: player name above muted bid on the left;
  larger move count above small MOVES caption on the right. Preserve top flex
  alignment, divider, panel size and mobile's inline status text.
  Verification: 52 match-rendering tests, 2 responsive browser tests, frontend
  typechecks/build and whitespace check passed; desktop screenshot reviewed.

- [x] Desktop demonstration panel: status/bid left and move count right above a
  subtle divider; centered 2×2 robot selectors and D-pad with 12px gap; existing
  attempt actions at the bottom. Hide only redundant selection text on wide
  desktop; preserve feedback, mobile markup presentation and all handlers.
  Verification: 59 component tests, 2 responsive browser tests, Web/E2E
  typechecks (web via build), production build and whitespace check passed;
  desktop screenshot reviewed. Updated the coordinate check for the owner's
  existing 4px gap. Checked robot-grid order, centering, 12px D-pad gap,
  bottom action placement, disabled Undo/Reset and mobile selection feedback.

Documentation cleanup is complete. `MatchSidebar` now has an approved compact
desktop panel at minimum 1024px width and minimum 4:3 aspect ratio. Mobile keeps
the existing header. Wide match screens now use sidebar/board/phase-panel columns
from 1280px and minimum 4:3 aspect ratio. Intermediate widths keep the stacked
layout. These presentation changes do not change gameplay rules.

- [x] Desktop match layout parity: share the lobby's viewport-height board sizing,
  centered group and equal side-column expansion (220–260px / 300–340px).
  MatchSidebar and right phase panel stretch to board height. Sidebar details
  stay at the top and version at the bottom; bidding controls stay above the
  player list, with the list at the bottom. Demonstration controls sit below
  status at the bottom; constrained right panels scroll. Mobile/intermediate
  layouts and game behavior unchanged.
  Verification: 2 responsive browser tests, Web/E2E typechecks (web via build),
  production build and whitespace check passed. Checked match phases, sidebar/
  right-panel height, centered margins, equal column growth, timers and controls;
  desktop screenshot reviewed.

- [x] Desktop lobby panel expansion: let the sidebar grow from 220 to 260px and
  controls panel from 300 to 340px, sharing available width while keeping the
  board size, 20px gaps and 16px insets. Narrow viewports retain the minimum widths.
  Corrected the sidebar's fixed width so it fills its column; calculate equal
  panel growth from spare width so expansion never takes space from the board.
  Verification: both responsive browser tests and whitespace check passed;
  checked equal panel growth, board size and mobile layout; desktop screenshot reviewed.

- [x] Desktop lobby centering: center the whole three-column group in the available
  width, distributing leftover space on both sides. Board size, panel widths,
  gaps, match alignment and mobile layout unchanged; supersedes lobby left alignment.
  Verification: both responsive browser tests and whitespace check passed;
  equal outer margins asserted across desktop sizes and screenshot reviewed.

- [x] Desktop lobby controls height: stretch to the board's grid row; keep the
  roster at the top and use a flex auto margin to push host controls to the bottom.
  Keep the start requirement directly below Start Match. Preserve styling and
  mobile layout; allow panel scrolling only if its contents cannot fit.
  Verification: 2 responsive browser tests, Web/E2E typechecks (web via build),
  production build and whitespace check passed; desktop screenshot reviewed.
  Checked panel/board bottom alignment, roster position, bottom controls and
  start-requirement spacing across desktop sizes, plus unchanged mobile buttons.

- [x] Desktop lobby board sizing: use viewport height less the existing top/bottom
  16px (or larger safe-area) insets instead of reserving 8rem and capping at 768px.
  Remove the lobby-only overall width cap so the square board can grow on wider
  screens. Available width still limits its size to avoid horizontal scrolling;
  the sidebar follows its height. Match and mobile sizing unchanged.
  Verification: 2 responsive browser tests, Web/E2E typechecks (web via build),
  production build and whitespace check passed; desktop screenshot reviewed.
  Checked equal vertical gaps when height-limited and safe sizing when width-limited.

- [x] Desktop lobby sidebar height: stretch to the board's grid-row height, keeping
  setup/actions/status at the top and version/count at the bottom with empty space
  between. No fixed height; size containment on the controls wrapper lets the
  board determine that row even if the controls extend below it. Mobile unchanged.
  Verification: 55 existing lobby tests, 2 responsive browser tests, Web/E2E
  typechecks and whitespace check passed; desktop screenshot reviewed.

- [x] Desktop lobby version: package-sourced version at the left of the existing
  online-count row, 11px muted text; preserve the users icon/count at the right.
  Hide the duplicate page footer only at the wide lobby breakpoint; mobile
  header/footer and panel geometry unchanged.
  Verification: 55 relevant component tests, 5 lobby/responsive browser tests,
  Web/E2E typechecks, production build and whitespace check passed. Verified
  package-sourced text, same-row alignment, desktop footer hiding and mobile footer preservation.

- [x] Desktop lobby sidebar inner polish: compact white heading and muted board
  name, expanding room copy button beside 44px More Actions, inline green lobby
  status dot and a right-aligned live count with a decorative users icon. Scope
  these refinements to the existing wide-lobby breakpoint; outer panel geometry,
  mobile header, recovery, menus and host permissions remain unchanged.
  Verification: 62 relevant component tests, 5 lobby/responsive browser tests,
  Web/E2E typechecks, production build and whitespace check passed. Desktop/mobile
  screenshots reviewed; copy, menu, live counts and mobile-hidden decorations checked.

- [x] Wide lobby layout: reuse the match layout's 1280px / minimum 4:3 breakpoint,
  220px left header, square board, 300px right controls and 20px gaps. Compact
  themed side panels; roster/control divider, stacked 48px host buttons and
  centered start requirement. Constrain the board by viewport height, including
  short desktop windows. Below the breakpoint, preserve the existing lobby and
  horizontal buttons. The controls wrapper uses `display: contents` there.
  Verification: 83 existing component/start-flow tests, 5 lobby/responsive browser
  tests, Web/E2E typechecks, production build and whitespace check passed.
  Reviewed desktop/mobile screenshots; checked one/two-player host eligibility,
  guest waiting, menus, breakpoint boundaries and short-desktop board visibility.

- [x] Lobby controls extraction: `LobbyControlsPanel` reuses `LobbyRoster` /
  `PlayerRoster` and `LobbyActions`, including the existing start-requirement
  footer. No new DOM wrapper or styling; permissions, eligibility, messages and
  live state remain with their existing owners. Lobby layout remains unchanged.
  Verification: 83 existing component/start-flow tests, 2 responsive browser
  tests, frontend typecheck and whitespace check passed.

- [x] Blocked center appearance: continuous `#080F1F` 2×2 square, subtle 45-degree
  `#3A5272` stripes and a thin matching outer border; hide internal grid lines.
  Cell-relative sizing gives approximately 1.25px stripes, 10px spacing and a
  1.5px border on 48px desktop cells. Active-target brackets and game rules unchanged.
  Verification: 9 board tests, 2 responsive browser tests, Web/E2E typechecks,
  production build and whitespace check passed; desktop/mobile screenshots reviewed.

- [x] Active board target: replace the former white/soft cell fill with four
  inset `#B8CCE3` corner brackets. Keep the normal dark-blue background and all
  target/robot/wall geometry and interactions. Use cell-relative inset, arm and
  stroke dimensions for desktop/mobile scaling. This approved visual change
  supersedes the earlier fill approvals recorded below; archive records unchanged.
  Refined to shorter 20%-cell arms, a 10%-cell inset and a 1/24-cell stroke
  (approximately 5px inset and 2px stroke on the current 48px desktop cell).
  Refinement verified: 7 board tests, 2 responsive browser tests, frontend
  typecheck and whitespace check passed.
  Verification: all 7 board-rendering tests and both focused responsive browser
  tests passed; desktop/mobile screenshots reviewed. Web/E2E typechecks, web
  build and whitespace check passed. Full web suite: 436 passed, with the existing
  `AppShell.test.tsx` failure expecting `v0.1.0` instead of package `v1.0.0`.

- [x] Desktop sidebar inner layout: round/phase beside online status, actual
  target shape/color, expanding copy button plus 44px actions button, and the
  package-sourced version below/right. Hide the page version only on desktop
  matches; preserve mobile header/footer and outer panel geometry. Green status
  dot requires an actual connected client; recovery remains available.
  Verification: 2/2 focused browser tests passed (desktop/mobile versions,
  actual target icons, action spacing, phase timer, offline/rebind and layout
  regressions). Nine sidebar tests passed; full frontend run had 435 passes and
  the unchanged AppShell v0.1.0/v1.0.0 assertion failure. Web/E2E typechecks,
  production build and `git diff --check` passed; desktop screenshots reviewed.

- [x] Desktop outer-spacing adjustment: left-align the existing three columns
  with 16px outer padding, respecting safe-area insets. Preserve board-size limits,
  column widths, 20px gaps and narrower layouts. This supersedes centering below.
  Keep desktop action buttons spread across their row so the dropdown does not
  clip the left viewport edge. Verification: 2/2 focused browser tests passed,
  including 16px left/top inset, menu/copy behavior and narrow-layout regressions;
  web/E2E typechecks, production build and `git diff --check` passed. Screenshot
  reviewed; unit suite not rerun for this spacing-only follow-up.

- [x] Wide match layout (initial centered version): top-aligned 220px sidebar / square board /
  300px phase/player panels, with 20px gaps. Board sizing stays prominent and
  bounded; below 1280px or in portrait the previous layout remains. Reuse existing
  components with a display-contents wrapper on narrow screens; keep recovery,
  preparation and retry feedback with the right-side panels. No backend/gameplay
  changes or board/control/player component restyling.
  Verification: focused browser tests 2/2 passed, checking top alignment, column
  widths/gaps, board prominence/square geometry, centered layout, no overflow,
  phone/portrait-tablet fallback and 1279/1280px boundary in Thinking/Bidding/
  Demonstration. Desktop screenshot reviewed. Web/E2E typechecks and production
  build passed; frontend tests 430 passed with the unchanged AppShell version
  failure. `git diff --check` passed. Physical Mac/iPhone checks remain unverified.

- [x] Desktop MatchSidebar panel: 220px width, theme background/border, 10px radius,
  12px padding/gaps; phase/timer, board/target, copy/menu row, online count stacked.
  One component/state tree; no board or other panel styling changes. Breakpoint
  keeps phone and portrait-tablet presentation intact.
  Verification: both focused PWA/mobile browser tests passed, including panel
  geometry/order, 1023/1024px boundary, phones/tablets, 1280/1366/1440px desktop,
  bidding timer placement, copy and menu. Desktop screenshot reviewed. Web/E2E
  typechecks and production build passed. Frontend tests: 430 passed, the same
  pre-existing AppShell version assertion failed. No physical Mac/iPhone check.

- [x] Reuse `ActiveMatchHeader` as `MatchSidebar` and update its connected-screen
  reference and existing tests. Preserve markup, CSS classes, props and callbacks;
  no board/panels/controls/player-list, backend or dependency changes.
  Verification: source comparison confirms only component-name/import changes;
  frontend typecheck, production build and `git diff --check` passed. Frontend
  tests: 430 passed, one pre-existing AppShell version-label failure (expects
  v0.1.0; package is v1.0.0). MatchSidebar's four tests and all 52 connected-screen
  tests passed. The unrelated version assertion remains unchanged.

- [x] Deployment-status cleanup: record the 2026-11-11 public-root response,
  distinguish source tag from deployed version, preserve historical preparation
  evidence and label unverified hosted behavior in `docs/deployment.md`.
- [x] Architecture cleanup: owner authorized completing the remaining steps
  together. Replace historical progress narratives with current system overview,
  code/rendering boundaries, geometry/preparation, state/lifecycle, identity and
  protocol, persistence/retries, recovery, presentation/PWA, verification and limits.
  Preserve essential decisions in the summary and link existing task records for
  rationale and historical evidence; leave `docs/archive/v1/tasks/` untouched.
- [x] Architecture second pass: shorten the 470-line guide to 256 lines, keeping
  system/state/code boundaries and essential decisions. Link existing source and
  reference records for detailed limits, timing, protocol/storage and caching
  mechanics; create no new reference documents and leave task files untouched.
  Verification: 35 local Markdown links across architecture/deployment/checklist
  resolved, architecture code fences balanced, and `git diff --check` passed.
  Documentation only; application tests/type checks were not rerun.
- [x] Product cleanup: replace pre-implementation status/open questions with the
  current baseline, clarify settled tie/identity/rematch/preparation behavior,
  and preserve gameplay rules. Record the approved soft target fill separately
  from the selected robot ring, and the owner's 2026-11-11 confirmation to keep
  current light internal walls. No release additions approved or code changed.
  Verification: seven local Markdown links resolved; movement, demonstration,
  reliability and out-of-scope sections match the source baseline exactly;
  `git diff --check` passed. Application tests/type checks were not rerun.
- [x] Align AGENTS and architecture visual references with product: soft active
  target fill, separate thin white robot-selection ring, light internal walls
  and distinct boundary/subtle grid. Remove stale confirmation/reconciliation
  wording. Historical task records remain untouched; no rendering changes.
- [x] Local-development guide: replace obsolete checkpoint/v1-console instructions
  with current HTTPS setup, PC/phone UI flow, recovery, storage/reset guidance,
  tests, benchmark, local expiry shortcut and troubleshooting. Preserve trust/reset
  approval boundaries and link historical evidence; update architecture's guide
  description. No code, configuration, certificates or development data changed.
  Verification: 49 local links and balanced fences across the three touched docs;
  11 filtered commands checked against scripts/test paths; `git diff --check`
  passed. Servers and application tests were not run for this documentation edit.

- [x] Retire `docs/plan.md` from active planning. Keep its path and original
  milestones/progress evidence, including unique T20/T21 notes, as historical
  reference. Replace active task-selection instructions with pointers to this
  checklist and current guides; label the old deployment next-action note
  superseded. Do not reassess old checkboxes or modify task documents.
  Verification: milestone/decision records and progress log match the source
  baseline; nine local links resolve; `git diff --check` passed. Documentation
  only; application tests/type checks were not rerun.

- [x] UI-theme cleanup: align the board palette, 17 SVG targets, soft active-cell
  fill and separate white robot-selection ring with product and rendering.
  Remove old single-target/concentric-ring specifications and unimplemented-style
  claims; preserve existing application styles without approving a broader redesign.
  No CSS, artwork, gameplay or historical task records changed.
  Verification: seven local links resolve, code fences balance, all 11 unique
  documented palette colors match CSS, and `git diff --check` passed.
  Application tests/type checks were not rerun for this documentation-only edit.

- [x] Browser/PWA guide cleanup: replace chronological checkpoint instructions
  with current commands, source coverage, fixture boundaries, install/update
  expectations and physical-device checklists. Keep dated automated results and
  owner PC/Android reports separate from unverified Safari/hosted behavior.
  Source inventory has 15 browser cases; this is not a fresh passing run. Both
  recovery and mobile-layout files use private controlled time. Historical task
  evidence, application code and test/config files remain unchanged.
  Verification: 22 local links and balanced fences across the three touched docs;
  12 documented commands matched scripts/test paths; 15 case declarations in
  eight source files confirmed; `git diff --check` passed. No application tests,
  builds, browser downloads or physical-device checks were run for this edit.

- [x] Archive v1 task records: move all 72 files from the former task folder to
  `docs/archive/v1/tasks/`, retaining decisions, approvals and evidence. Update
  active-guide, historical-plan and package README references, plus parent-relative
  links inside the archive. No records deleted; content changes limited to paths.
  Earlier cleanup entries describe their original scope; this approved relocation
  supersedes the earlier instruction to leave task files in place.
  Verification: all 72 records match source-baseline contents except path repairs;
  240 local links across 90 Markdown files resolve; no stale task-folder references;
  `git diff --check` passed. No application tests/type checks were rerun.

- [x] Clarify existing result presentation: all-zero scores display “No winner”;
  equal highest nonzero scores share the win. Round results use a modal; final
  match results use a full-screen view. Documentation only; scoring/code unchanged.

After documentation cleanup, agree on laptop layout/breakpoints and coordinate
placement together, plus the implementation order, before coding additions.

## Verification

- Run tests and type checks relevant to each change.
- Run broader regression checks at meaningful integration/release checkpoints.
- Review layout on a real phone.
- Review on a real laptop and at representative wide/short browser sizes;
  regression-check phone/tablet layouts and browser zoom behavior.
- Test multiplayer rule changes with independent player sessions.
- Keep frontend/server compatibility and existing stored rooms in mind.
- Update the displayed version when preparing a release.
- Deployment requires separate approval.

## Known follow-ups

- Intermittent slow reconnection was observed, but its cause was not established.
- Samsung Internet showed an installation warning; installation through Chrome
  worked on the owner's phone.
- Broader browser/device compatibility and hosted resource limits are not
  certified by the existing tests.
