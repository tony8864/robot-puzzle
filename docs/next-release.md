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
- [ ] Add letters and numbers so players can refer to specific cells.
- Decide placement before coding.
- Suggested convention: columns A–P left to right, rows 1–16 top to bottom.
- Preserve the square board and mobile legibility.

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

Documentation cleanup is complete. `MatchSidebar` now has an approved compact
desktop panel at minimum 1024px width and minimum 4:3 aspect ratio. Mobile keeps
the existing header. Wide match screens now use sidebar/board/phase-panel columns
from 1280px and minimum 4:3 aspect ratio. Intermediate widths keep the stacked
layout. These presentation changes do not change gameplay rules.

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
