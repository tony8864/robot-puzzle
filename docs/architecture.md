# Technical Architecture — Robot Puzzle

**Status:** Current source architecture, reviewed 2026-11-11.

[Product requirements](product.md) define approved gameplay; [AGENTS.md](../AGENTS.md)
defines working constraints. This guide explains the implemented system.
[Next release](next-release.md) tracks active work, and [deployment](deployment.md)
records hosted evidence. Source code and local tests do not prove what is deployed.

## 1. System overview

Robot Puzzle is a private, mobile-first PWA for 2–6 friends: React/TypeScript/Vite,
CSS/SVG, Cloudflare Worker with SQLite-backed Durable Objects, pure TypeScript
libraries and pnpm. No external database or UI/state framework is used.
Vitest tests rules/runtime behavior; Playwright tests rendered browser flows.

```text
Browser: React PWA
  | HTTPS: assets, anonymous session, create/join/resume, receipt lookup
  | WSS: commands, private results, authoritative snapshots
  v
Cloudflare Worker: routing, transport/Origin checks, authenticated forwarding
  |
  +--> Registry Durable Object (one per environment)
  |      identity/expiry, room codes, creation reservations/recovery
  |
  +--> Room Durable Object (one per room UUID)
         seats, selected board, match, deadlines, moves and scores
         presence, durable command outcomes, lifecycle and broadcasts
           |
           +--> pure match / game-engine / puzzles libraries
```

Room is authoritative. Registry and Room have separate transaction boundaries:
creation reserves in Registry, initializes Room idempotently, then publishes the
code. Closure commits in Room before an outbox repairs Registry. Durable intent
recovers interrupted work; no transaction spans an RPC. A closed Room refuses
admission independently of directory repair.

## 2. Code boundaries and board rendering

| Location | Responsibility |
| --- | --- |
| `apps/web` | React entry, room transport/recovery, UI and development simulator |
| `apps/server` | Worker, Registry/Room, authentication, scheduling and persistence |
| `apps/e2e` | Playwright with disposable HTTPS backend and isolated storage |
| `packages/game-engine` | Geometry, sliding movement, targets, attempt history, undo/reset |
| `packages/puzzles` | Original board catalog, validation, hidden solver and round setup |
| `packages/match` | Pure phases/transitions, bids, turns, outcomes and standings |
| `packages/shared` | Network types, runtime parsers and safe public-state projection |

Dependencies flow `puzzles -> game-engine`, `match -> game-engine/puzzles`, and
`shared -> game-engine/match/puzzles`. These libraries have no React, Cloudflare,
browser, networking or timer dependencies. Callers supply trusted time and
candidate order; the server owns randomness and scheduling.

[main.tsx](../apps/web/src/main.tsx) enters `AppShell`/`RoomEntry` and then
`ConnectedLobby`. HTTP entry code lives in `src/entry`; live transport/recovery in
`src/lobby`. React owns presentation state (selection, drafts, dialogs).
Connected positions, phases, counts and scores come only from validated server
snapshots; no optimistic movement, local scoring or private Thinking/Bidding
simulation runs there. `src/local` and `?preview=local` are development-only.

[BoardSvg.tsx](../apps/web/src/components/BoardSvg.tsx) draws the board, targets,
robots and walls. [TargetSymbol.tsx](../apps/web/src/components/TargetSymbol.tsx)
provides artwork; [LobbyPreview.tsx](../apps/web/src/components/LobbyPreview.tsx)
shares lobby/match presentation; [styles.css](../apps/web/src/styles.css) owns
appearance, animation and layout.

## 3. Geometry and target preparation

The 16×16 board uses zero-based `{ row, column }`: top-left `(0,0)`, rows downward,
columns rightward. The center cells `(7,7)`, `(7,8)`, `(8,7)`, `(8,8)` are blocked.
Walls are single undirected edges between adjacent cells, normalized in row-major
order; boundaries and blocked-cell barriers are implicit. Exact validation and
movement contracts are in the [engine data model](../packages/game-engine/README.md).

Five original full boards each have 17 targets and validated geometry/starts.
Host Shuffle selects a different whole board in Lobby; Start locks it for ten
rounds. No quadrant rearrangement or procedural walls are used.

Before each reveal, `puzzles/round-setup` excludes used/already-satisfied targets
and searches from current official positions. The bounded breadth-first solver's
selected proof is independently replayed through engine movement, then discarded
from ordinary state. Proofs/diagnostics never reach players; optimality is unnecessary.
Work/storage budgets do not guarantee hosted CPU time or ten-round continuation.

Start/Continue durably queues a job containing exact match/round/board/positions,
used IDs, candidate order and budget. It is claimed before searching, at most once
per logical job. Interrupted running work becomes an error rather than silently
searching again. Acceptance rejects stale context, even if positions match an
earlier round; target consumption and Thinking commit together.

Failed preparation reveals nothing and preserves positions. Deferred/error allows
host Retry after cooldown; unavailable has no escape. No automatic reset, board
substitution, target reuse or budget escalation is approved. Details: [preparation](../apps/server/src/roomPreparation.ts)
and [job policy](../apps/server/src/preparationJob.ts); rationale and local
measurements are in [T15.2](archive/v1/tasks/T15-2-durable-bounded-target-preparation.md) and
[Workers benchmarks](benchmarks/T15-local-workers-preparation.md).

## 4. Match state and lifecycle

Room retains private membership/history/jobs/replays/lifecycle data. Snapshots
explicitly project public roster/presence/puzzle/revision/phase fields, excluding
credentials, identity mappings, history and solver data; parsing invokes no solver.

- **Official positions:** committed across rounds.
- **Round-start positions:** immutable reset/rollback anchor for all bidders.
- **Attempt positions:** provisional until success.

```text
Lobby --host Start--> Preparing --verified target--> Thinking
Thinking --first accepted bid--> Bidding --server deadline--> Demonstrating
Thinking --confirmed host Skip---------------------------> Round Result
Demonstrating --failure--> next bidder, or Round Result if queue exhausted
Demonstrating --success---------------------------------> Round Result
Round Result --host Continue, rounds 1-9--> Preparing
Round Result --host View Results, round 10--> Finished
Finished --host New Match--> Lobby --explicit host Start--> Preparing
```

The server enforces the original 60-second bid deadline and first-acceptance tie
priority, including on reads/retries/rebind; rejected commands can retain a due
transition. Client countdowns are informational. Action-specific context avoids
unfair global-revision rejection of competing bids. Bids currently lower only.
Attempts count retained history and allow corrections without an automatic failure.
Success scores once/commits all four positions; failure rolls all four back.
Product defines complete bidding, demonstration and scoring rules.

Results wait for the host and keep recovery reachable; standings are derived.
The UI presents all-zero standings as “No winner”; equal highest nonzero scores
are a shared win. The model may still derive an all-zero tie without changing
scores. New Match retains room/host/seats/identities,
replay history and board preview, creates a fresh lobby ID, and does not shuffle,
search or start. Explicit Start resets positions/scores; Lobby reopens joins.
Start requires two seated players, not two online players.

The pure reducer returns `{ state, outcome }`; Room supplies trusted actor/time
and authorizes internal preparation/advance/abandonment operations. Always consume
returned state, including on rejection. Detailed transitions and contracts:
[match design](archive/v1/tasks/T11-1-state-and-transition-design.md),
[commands](../packages/match/src/commands.ts).

## 5. Identity, protocol and durable retries

Anonymous identity uses an unguessable HttpOnly/Secure/SameSite=Lax cookie.
Registry stores a verifier, never the raw credential. Its fixed 24-hour lifetime
does not renew on refresh/activity/rematch. Room maps it to seats; nickname, room
code and stored IDs cannot authenticate or recover an expired identity.

Same-origin HTTPS handles bootstrap/resume and receipt lookup; authenticated WSS
handles live commands/snapshots. Runtime validation, raw-size/Origin checks and
per-action authorization apply at the server boundary. Worker strips forged
authority headers; Room rechecks identity/membership, including long-lived sockets.
Only `room.snapshot`/`room.closed` are public broadcasts; bindings/results/errors
and heartbeats are private. Never expose credentials, raw requests or proofs in logs.

Room serializes events and atomically persists state/revision/outcome before
delivery. Revisions stay monotonic across matches. After authentication, exact
ID/payload retries return stored outcomes before stale-context checks; conflicting
reuse rejects. Clients ignore old snapshots and resync equal-revision conflicts.

Context IDs/attempt versions reject delayed actions; Undo/Reset never rewind
versions. Restore checks private/public consistency and history without a solver,
failing closed on corruption/unsupported data. Wire v2 and storage versions are
independent; supported old records stay readable, v1 gameplay rejects, and
historical receipt lookup cannot execute missing actions. Coordinate web/server
protocol upgrades and reload old tabs.

One immutable pending request blocks new mutations until result/revision reconcile.
Uncertain gameplay needs explicit exact Retry across phase changes; taps are not
queued. Validated tab-local storage retains routing/request, never credentials or
history. Storage failure is reported; bootstrap creation refresh recovery is
outside this mechanism. Exact operations, limits, formats and migrations:
[client contracts](../packages/shared/src/clientRequests.ts),
[server contracts](../packages/shared/src/serverMessages.ts),
[stored match](../apps/server/src/storedMatch.ts),
[room adapter](../apps/web/src/lobby/liveLobbyClient.ts).
Design rationale: [protocol](archive/v1/tasks/T13-1-message-inventory-and-protocol-design.md)
and [Registry/Room design](archive/v1/tasks/T14-1-server-design-and-local-setup.md).

## 6. Recovery and room lifecycle

Leases aggregate tabs into one seat; valid incoming traffic renews them, outbound
traffic does not. Effective expiry starts absence. Guarded transport recovery
handles offline/visibility/BFCache with bounded backoff and authenticated resume.
Snapshots restore state without replaying missed inputs or uncertain commands.

Offline active bidders get 60-second grace (from activation if already offline).
Only confirmed host Skip Attempt can then fail/roll back; rebind before acceptance
cancels eligibility. Host authority never transfers; its identity expiry can strand
host-only actions. Bids/deadlines continue through disconnects.

Guest Leave is confirmed/tab-local, retaining seat/bids/scores and other tabs;
refresh does not auto-rejoin. Host End is terminal without scoring. Thirty
continuous empty minutes also closes the room; only authenticated binding strictly
before expiry cancels it. Valid connected idle rooms do not expire for inactivity.

One earliest-due alarm coordinates obligations, backed by normalization on
wake/admission/actions/delivery. Closure precedes directory repair; after 24-hour
retention/redaction private data is purged, unless pending repair delays cleanup.
Non-reusable-code tombstones stay within the creation cap. Retained receipt lookup
never reopens gameplay. Detailed timing, retention and race rationale: [lifecycle design](archive/v1/tasks/T17-1-lifecycle-design-and-contracts.md),
[terminal handling](../apps/server/src/roomTerminal.ts),
[recovery](../apps/web/src/lobby/roomRecovery.ts).

## 7. Presentation and PWA

Connected play uses three top-aligned columns from 1280px width at a minimum 4:3
aspect ratio: 220px MatchSidebar (lobby header before play), square board, and
300px phase/player panels (LobbyControlsPanel before play),
with 20px gaps and a minimum 16px outer inset (or larger safe-area inset).
Lobby and match center the whole three-column group; their sidebar and controls can grow
to 260px and 340px while space allows, preserving the board size, then the 20px
gaps and 16px viewport insets. Both use the viewport height less outer insets,
constrained by available width, with side panels matching the square board height.
The lobby uses compact side panels with stacked host buttons and a roster/control
divider. Its square board uses the viewport height less the top/bottom outer
insets, limited by available column width; both side panels follow the board height.
Narrower layouts keep controls below the board and horizontal lobby host buttons; preview CSS is
separate. Coordinates/discussion changes remain proposals. Round results use a modal;
final match results use a full-screen view. Moves/Undo animate; Reset moves all
robots directly together. Rebind/new attempts/missed versions snap. Animation
never controls state; reduced motion applies.

The desktop sidebar shows connection status, actual target artwork and the
package-sourced app version. The wide lobby shows that version beside its online
count in the existing bottom row. The page footer is hidden for these desktop layouts;
mobile retains the existing header and version footer.

All targets remain visible, inactive ones muted; robot letters supplement color.
The active target's four inset SVG corner brackets differ from the selected robot's
thin white ring. Internal walls remain light (`#A8BED8`), with a distinct outer
boundary and subtle grid, as approved in [product requirements](product.md) and
specified in [UI theme](ui-theme.md). These are the current visual requirements.
Rendering/recovery rationale: [connected controls](archive/v1/tasks/T16-2-connected-demonstration-controls.md).

The generated service worker verifies/caches only public shell/assets; no API,
credentials, state or runtime writes. Navigation keeps HTML/chunks coherent;
updates wait for old clients to close without forced reload. Offline UI retains
drafts/uncertain IDs but disables writes; there is no offline gameplay queue.
[PWA testing](pwa-testing.md) and [caching design](archive/v1/tasks/T19-2-static-caching-and-updates.md)
cover exact validation, lifecycle and storage/device limitations.

## 8. Verification, deployment and open limits

Vitest covers pure rules and runtime authorization/persistence/recovery.
Playwright uses built frontend/Worker in isolated HTTPS Miniflare; ordinary
workspace tests do not launch browsers. Actual-deadline, mixed-match and separate
restart tests have distinct scope; private test clocks are excluded from production.
Historical counts and owner device reports do not certify iPhone Safari or hosting.
Commands/evidence: [browser tests](browser-testing.md), [lifecycle verification](archive/v1/tasks/T17-8-recovery-and-lifecycle-verification.md),
[browser handoff](archive/v1/tasks/T18-6-device-verification-and-handoff.md),
[PWA handoff](archive/v1/tasks/T19-4-pwa-and-device-verification.md).

Local Vite proxies `/api` HTTP/upgrades to the Worker; production has a separate
Wrangler config serving static assets and API together, with SPA invite fallback.
Keep local certificates/config/storage separate. [Local development](local-development.md)
covers current setup, diagnostics and tests. [Deployment](deployment.md)
owns current evidence: the public root served HTML on 2026-11-11; deployed revision,
configuration/backend behavior and tested rollback remain unverified.
The `v1.0.0` source tag does not prove the deployed version. Code rollback does
not reverse durable schema/data changes.

Remaining risks are hosted solver/history costs, continuation when no target can
be verified, cap/tombstone policy beyond the private trial, device/zoom/browser
coverage, intermittent slow reconnection and the Samsung Internet install warning.
Existing Origin/size/rate/socket/replay protections are not comprehensive DoS control.
Do not silently enlarge caps, reuse closed codes or invent preparation fallbacks.

Archived v1 task records in `docs/archive/v1/tasks/` retain historical contracts,
approvals and measurements; they are not current implementation instructions or
the active checklist. Preserve unique decisions when reducing docs.
Product rules win; new fairness/security/architecture decisions require review.
Do not add accounts, hints or public systems. No commit, deployment or infrastructure
change without explicit approval.
