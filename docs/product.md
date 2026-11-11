# Product Requirements — Robot Puzzle

**Status:** Current approved product baseline, reviewed 2026-11-11.

This document defines approved gameplay and UX. [Architecture](architecture.md)
describes implementation; [next release](next-release.md) tracks proposals, which
are not approved requirements until explicitly accepted. Device and deployment
verification limits are recorded separately from product requirements.

## 1. Product vision

A free, mobile-first, private multiplayer puzzle game inspired by the *sliding-robot* gameplay of Ricochet Robots. Friends join a room, inspect the same board, mentally find routes to a target, bid how many moves they need, and demonstrate their solution. The experience should feel like playing a physical tabletop puzzle game together.

The game is named Robot Puzzle and uses original board layouts and visual assets.
This document does not establish intellectual-property clearance.

## 2. Target audience and platform

- Small groups of friends, **2–6 players**.
- **Mobile-first Progressive Web App (PWA)**, playable in iPhone Safari and Android browsers without an app-store installation.
- Portrait orientation is the primary design target; desktop browsers are useful for development and testing.
- An internet connection is required for multiplayer.
- Private rooms only. No public matchmaking.

## 3. Player journey

1. Player opens the game, enters or reuses a nickname, and creates a private room or joins one.
2. Host shares a room code or invite link.
3. Players join the lobby. The host starts the match when at least two players have seats.
4. The room locks to new participants once the match starts.
5. All players see the same 16×16 board, four robots, and active target.
6. Players solve mentally; the board is read-only during thinking and bidding.
7. The first bid starts a 60-second bidding window.
8. After bidding closes, eligible bidders demonstrate in ascending bid order.
9. A successful demonstration awards one point and establishes the robot positions for the next round.
10. The host advances from the round result; prepare and reveal a new target. Repeat for 10 rounds.
11. Show final results. The host may return everyone to the lobby for another match, then explicitly start it.

## 4. Board and visual design

- Board is **16×16 cells**, chosen from a catalog of **several original, individually designed full boards**.
- Match variety comes from selecting a complete board; quadrant rotation/rearrangement and procedural wall generation are not part of the MVP.
- Outer board boundaries block movement. The central 2×2 area is blocked.
- Internal walls are bold, light lines (`#A8BED8`) on **cell edges**; grid lines are subtle and the outer boundary remains distinct. Keep the current light wall appearance, confirmed by the owner on 2026-11-11.
- Four robots are simple solid circles: **red, blue, green, yellow**, with the corresponding letters **R, B, G, Y** so color is not the only identifier.
- Each board has **17 targets** at predefined positions: star, crescent moon, upright triangle, and square in each of the four robot colors, plus one neutral vortex wildcard.
- Each target occupies a cell with two perpendicular wall edges meeting at one cell corner. Interior wall segments form perpendicular angles; an unpaired segment is allowed only when exactly one endpoint touches the outer board border and the other endpoint is inside the board. Outer boundaries and edges beside blocked cells remain implicit barriers.
- Colored targets require the matching robot; the vortex accepts any robot. Symbols identify individual targets and do not change movement or completion rules.
- All 17 targets remain visible on the board. Inactive targets are slightly muted; the active target is shown at full brightness with the approved **soft cell fill**, visible around a robot when occupied.
- The selected robot has a **thin white ring**. This indicates robot selection and is separate from the active target's cell fill.
- Board is displayed with scalable SVG and occupies as much phone width as practical.

## 5. Robot movement rules

- A move consists of selecting a robot and one of four cardinal directions.
- The robot slides in that direction until it would hit a wall, the board boundary, the blocked center, or another robot; it stops in the last legal cell.
- Robots cannot overlap, pass through one another, or cross blocked edges.
- A direction that leaves the robot in the same cell is a no-op and does **not** count as a move.
- The active target is solved when the required robot stops on its target cell; for a wildcard, any robot qualifies.
- The board and movement rules are deterministic: identical state and action must produce identical results.

## 6. Match setup and target selection

- A match has **10 rounds**.
- Before match start, show a preview of a valid full board from the catalog. The host may shuffle to another catalog board in the lobby.
- Starting the match locks the selected board and establishes valid initial robot positions.
- Targets are drawn from predefined locations on that board, including wildcard targets; do not repeat a target within the same match.
- Do not select a target already satisfied by the current robots. It remains unused and can become eligible after robot positions change.
- Before revealing a target for a round, ensure it is **solvable from the robots' current positions** using a hidden validation mechanism. Do not show the solver or solution to players.
- A prevalidated puzzle library may be used to reduce computational cost, but **later rounds must be checked against the actual carry-forward positions**, not just the initial match positions.
- The board layout stays fixed for the duration of the match.
- **Robot positions are not reset between successful rounds.**
- While a verified target is being prepared, show a read-only board and preparation status. If preparation cannot verify a target, preserve official positions and reveal nothing. Deferred/error preparation permits an explicit host Retry after a cooldown; unavailable preparation has no recovery action. Do not silently reset robots, substitute boards, reuse targets or show an unverified target.

## 7. Thinking and bidding

- At the start of each round, reveal one target. All players see the same board and robot positions.
- Thinking has **no automatic time limit** until a bid is placed.
- During thinking and bidding, nobody may move or privately simulate robots in the game interface.
- A bid is a positive integer representing the **maximum number of moves** the player claims to need.
- Every player may bid independently of other players' values. The implementation accepts positive safe integers; no additional gameplay cap is imposed.
- The **first accepted bid** starts a **60-second countdown** visible to everyone.
- Other players may submit bids during that countdown.
- Players may **lower** an existing bid, but may not raise it.
- Bidding closes at the server deadline; no new or revised bid is accepted at or after it. Revising a bid never restarts or extends the window.
- Demonstration order is ascending by final bid count; **earlier first accepted bid has priority for equal bids**, including after reductions.
- If nobody bids, the host may skip the round (with confirmation). No point is awarded.

## 8. Demonstration and undo

- Only the active bidder controls the board during their demonstration; everyone else watches the same moves live.
- Controls: select a robot, then use **four directional buttons**.
- There is **no demonstration timer**.
- Undo reverses the most recent move; reset attempt restores the robots to their **positions at the start of this round**.
- Undo and reset are free. The current demonstrated move sequence, not discarded moves, is counted against the bid.
- A solution succeeds if the target is reached in **at most** the number of moves bid; fewer moves are allowed.
- Reaching the bid limit without solving does not automatically fail the attempt, because the bidder may undo.
- The bidder can explicitly **Give Up**.
- A disconnected active bidder gets 60 seconds from server-detected disconnection to return; if already offline when selected, grace starts when their attempt begins. After grace, the host can confirm skipping the abandoned attempt. Reconnecting before skip acceptance removes eligibility; there is no automatic forfeiture or timer on a connected demonstration.

## 9. Round completion and robot persistence

- **Successful demonstration:** award the bidder **1 point**. The final positions of **all four robots** become the official starting positions for the next round.
- **Failed or abandoned demonstration:** restore all robots to the positions they had **at the beginning of the round**, then let the next eligible bidder try the same target.
- If all eligible bidders fail or the host skips the round, award no points and keep the round-start robot positions for the next round.
- Each new round reveals a new solvable target from the current official positions.
- The round result remains until the host advances. Guests wait; there is no automatic next-round transition. After round 10, the host advances to final results instead of revealing an eleventh target.

## 10. Scoring and match end

- Exactly **1 point** is awarded for each successfully completed round.
- No points for failed or skipped rounds.
- After 10 rounds, show a scoreboard sorted by points.
- Equal highest scores are a **shared win**; no tiebreaker.
- The host's **New Match** action returns the same players to the same room's lobby, retaining the completed board as a preview. The host may Shuffle and must explicitly Start; returning to the lobby does not start a match automatically.
- Starting that match resets scores and uses the selected board's initial robot positions. A different board is optional, not automatic.

## 11. Private rooms and player identity

- No accounts, email addresses, passwords, friends lists, or public matchmaking in the MVP.
- Players choose a nickname; the device may remember it for convenience.
- A private, unguessable browser credential identifies the player's seat for reconnecting; nickname or room code alone is insufficient. Browser identity lasts a fixed 24 hours from issuance and is not renewed by refresh, activity or rematch. An expired identity cannot reclaim a seat by nickname.
- Room invites support **both a shareable link and a short code**.
- Host starts the match; at least two players are required, and the MVP room cap is six.
- **No late joins:** once the match starts, new participants cannot enter, including on final results. Previously joined players may reconnect while their identity and room remain valid. New joins reopen when the host returns to the lobby.
- Host authority stays with the original host; there is no host transfer. If the host is unavailable, host-only actions wait for their return while other permitted play may continue.
- Guests have Leave Room; the host instead has End Room, both with confirmation. Guest Leave exits only the current tab, preserving the seat, bids and scores in every phase, including lobby; other tabs remain connected and no roster slot is freed. If the active bidder's final tab leaves, normal disconnect grace applies rather than implicit Give Up. End Room closes the room for everyone and invalidates its code/invites; it does not declare an unfinished-match winner or award points.
- A room expires after 30 continuous minutes with nobody connected. An authenticated player returning before expiry cancels the countdown. A connected room does not expire merely because nobody makes a move or bid. Expiry is separate from the fixed 24-hour browser identity lifetime.

## 12. Mobile interaction and feedback

- Portrait layout: board at the top, current round/target and bidding information nearby, controls below.
- During thinking, the board is read-only. During demonstration, only the active player sees enabled movement controls.
- Highlight the selected robot; clearly show the active target, current move count, bid limit, countdown, whose turn it is, and scores.
- Keep movement animations short and responsive.
- Show clear states for disconnected, reconnecting, waiting, success, and failure.
- Prioritize touch target size and legibility on real iPhones.
- Do not depend on preventing iPhone screen sleep; recover gracefully when the browser resumes.
- Cached PWA assets may let the app open while offline, but multiplayer requires connectivity. Show connection status and disable state-changing controls until synchronized; do not queue offline bids or moves for later submission.

## 13. Reliability and fairness requirements

- The multiplayer backend is authoritative for room membership, bidding order and deadlines, whose turn it is, accepted moves, scoring, and round transitions.
- Clients must not be able to submit demonstration moves outside their turn.
- A reconnecting client receives a current authoritative state snapshot.
- Simultaneous bids and timer expiry must be resolved consistently by the server.
- A failed demonstration must not permanently alter the official round-start positions.

## 14. Explicitly out of scope for MVP

- User accounts, social profiles, friends lists, chat, leaderboards, achievements, matchmaking.
- AI opponents, hints, player-facing solvers, or private board simulation during thinking.
- Monetization, in-app purchases, advertising.
- Custom user-created boards or an in-app level editor.
- Native App Store / Google Play distribution.

## 15. Remaining verification and product decisions

The catalog, bid tie priority, identity lifetime, disconnect grace, room expiry,
seat-preserving Leave and explicit host rematch flow are settled. Their technical
details belong in [architecture](architecture.md), not an open product backlog.

- **Target availability:** bounded validation does not guarantee ten verified targets from every possible carry-forward position. An alternative recovery policy needs approval; the current behavior preserves positions and withholds unverified targets.
- **Device compatibility:** real iPhone Safari invite, identity, background/resume and PWA behavior remain incompletely verified. See [browser testing](browser-testing.md) and [PWA testing](pwa-testing.md) for evidence and limits.
- **Hosted operation:** solver resource use, general hosted limits and deployed-version identification remain unverified as described in [deployment](deployment.md).
- **Wider distribution:** branding and legal review remain separate from this requirements baseline.

Release additions, including bid increases, early bidding closure and discussion
tools, remain proposals in [next release](next-release.md). This cleanup does not
approve them or certify deployment/device behavior.

## 16. Acceptance scenarios

- **Movement:** Red moves right and stops immediately before a wall or another robot; a blocked direction does not increase move count.
- **Bidding:** Maria bids 7, Alex bids 6, Maria lowers to 5; after the timer ends, Maria demonstrates first.
- **Equal bids:** Maria submits 6 before Alex submits 6; Maria has first priority.
- **Tie after reduction:** Maria submits 7, Alex submits 6, then Maria lowers to 6; Maria retains priority from her first accepted bid and the deadline is unchanged.
- **Undo:** A player bids 7, makes 5 moves, undoes 2, and completes in 6 current moves; the attempt succeeds.
- **Failed attempt:** Maria gives up after moving robots; Alex begins from the original positions for that round.
- **Carry-forward:** Alex solves a target with red and blue moved; the next round begins with **both** at their final positions.
- **Wildcard:** Any robot may stop on the wildcard target to solve it.
- **No bids:** Host skips the round; no point awarded and robot positions remain unchanged.
- **Reconnection:** An existing participant reconnects to their seat after room lock; an unrelated new participant cannot join.
- **Match end:** After 10 rounds, tied leaders share the win.
- **Another match:** Host selects New Match, everyone returns to the lobby, and play waits for an explicit Start. The previous board remains selected unless the host shuffles.
- **Visual indicators:** The active target has the soft cell fill; the selected robot has a thin white ring. Light internal walls remain distinct from the subtle grid.
