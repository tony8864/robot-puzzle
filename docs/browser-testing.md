# Browser testing — Robot Puzzle

This guide describes runnable commands and current source coverage, reviewed
2026-11-11. It does not report a fresh test run. Historical results and device
reports are linked below; automated contexts are not physical devices.

## 1. Run

From the repository root, after [workspace setup](local-development.md):

```powershell
pnpm test:e2e:install
pnpm test:e2e
```

Installation downloads the pinned Playwright Chromium into the user's browser
cache; repeat when the runner/browser revision changes. The suite builds temporary
production assets, starts isolated HTTPS backend/storage and tears them down.
No manual frontend/backend, phone, certificate installation or console commands
are required. Downloads/process launch may need environment permission.

`pnpm test` runs Vitest separately; `pnpm typecheck` includes E2E TypeScript.
[Runner config](../apps/e2e/playwright.config.ts) uses Chromium, one worker,
no automatic retries, failure screenshots, and trace/video off. Playwright is
pinned in [package.json](../apps/e2e/package.json); historical runtime/browser
versions are evidence for their recorded run, not current machine detection.

The round/full-match tests include three actual 60-second bidding windows, so
the full run takes several minutes plus startup/actions. Run browser and workspace
regressions sequentially on this development machine: an earlier overlapping
run hit a full-match timeout. Its standalone pass did not establish a root-cause
fix; record/diagnose failures rather than raising budgets or repeatedly rerunning.

Focused commands:

```powershell
pnpm --filter @robot-puzzle/e2e test:e2e tests/round.spec.ts
pnpm --filter @robot-puzzle/e2e test:e2e tests/full-match.spec.ts
pnpm --filter @robot-puzzle/e2e test:e2e tests/recovery.spec.ts
```

For PWA-specific commands and physical install/update checks see
[PWA testing](pwa-testing.md).

## 2. Source coverage inventory

The repository defines 15 test cases across eight files. This inventory is based
on source inspection, not 15 passing tests during this documentation cleanup.

| File in `apps/e2e/tests` | Cases | Scope and important limit |
| --- | --- | --- |
| `entry.smoke.spec.ts` | 2 | Entry, independent Secure/HttpOnly identities, rejected unknown-room WSS, absent production debug routes |
| `lobby.spec.ts` | 3 | Validation, Create/Join/invite/clipboard, shared board, host Shuffle/Start, lock and same-seat refresh |
| `round.spec.ts` | 1 | Real deadline, lowering/ties, corrections/no-ops, failure rollback, second-bidder success and all-four carry-forward |
| `full-match.spec.ts` | 2 | Mixed ten-round match/results/rematch, plus six independent identities sharing roster/board/bids |
| `recovery.spec.ts` | 3 | Offline/tabs/Leave, lost move reply/exact retry/Undo, grace/cancel/skip, modal recovery, End and empty expiry |
| `pwa-shell.spec.ts` | 1 | Manifest/icons/MIME on entry and invite routes; not native installation |
| `pwa-cache.spec.ts` | 1 | Offline static shell/API exclusion, failed update and waiting multi-tab update preserving identity/state |
| `pwa-mobile.spec.ts` | 2 | Offline entry/manual retry and responsive board/control/menu/dialog geometry; not native keyboard/safe-area certification |

The mixed match has one successful round after an earlier failed attempt, one
exhausted-bidder round and eight confirmed host skips. It is not ten successful
demonstrations. Six contexts are six identities, not six phones. Server runtime
recreation has separate tests; these flows do not prove a browser-plus-process
restart or arbitrary future-position solvability.

## 3. Isolation and private fixtures

[Environment](../apps/e2e/support/environment.ts) builds actual React assets and
Worker code and serves them through Miniflare with SPA fallback and exact Origin.
It uses loopback ephemeral ports, a unique OS-temp directory and isolated durable
storage. It does not load developer Wrangler config, `.dev.vars` or Vite dotenv,
borrow development servers, reset `.wrangler/state`, or exercise the Vite LAN proxy.
Teardown removes only its verified `robot-puzzle-e2e-*` parent.

TLS exceptions are confined to disposable Chromium/contexts, including WSS.
They neither install a CA nor certify native/hosted trust; never copy them into
normal browser launch settings or deployment. Clipboard permission is test-scoped.
Separate contexts have separate cookie jars; same-context tabs share a seat.

### Clock and route drivers

Normal round/full-match files use production time. A private Node driver finds
and engine-replays a bounded route for the actual target, then clicks ordinary UI.
Proofs are never sent to the browser or exposed by a game-server API. Search
failure fails the test; it does not authorize a larger budget or injected state.

`recovery.spec.ts` and `pwa-mobile.spec.ts` opt into `controlledTime`. The harness
first verifies the production Worker input graph excludes fixtures, then builds
a separate [test Worker](../apps/server/test/browserRecovery.worker.ts).
Node controls its monotonic clock through a private Durable Object namespace,
not an HTTP debug route. Bounded clock steps and authenticated reads preserve
lease semantics; empty expiry advances without those reads. Normal alarms and
authorization still govern transitions. Browser clocks/backoff remain real.
Do not patch client clocks, shorten production rules or inject accepted game state.

The recovery WebSocket helper drops one acknowledged move reply, not the accepted
move/snapshot, and verifies refresh/exact retry returns a duplicate without applying
it twice. It retains bounded safe metadata, not cookies/private bindings/proofs.
These offline/close scenarios do not cover every mobile half-open connection.

The cache-update fixture alone publishes changed temporary builds, including a
deliberately missing icon. Other files do not gain a production publishing hook.
Service workers are not globally blocked; only PWA-specific cases establish
the particular control/cache/update conditions they assert.

## 4. Failures and private artifacts

Failures identify assertions/source lines and write artifacts to ignored
`apps/e2e/test-results`. Responsive tests may also write diagnostic screenshots;
screenshots/context descriptions need review before sharing. Do not share raw
traces, request logs, cookie dumps or storage state: they can contain credentials
and nicknames. Credential comparisons retain safe properties/booleans only.
A crash may leave an owned temp directory; do not broadly delete OS-temp folders.

Known historical Miniflare alarm-cancellation, Windows cleanup and Node
color-environment warnings are separate from assertions. Investigate new unhandled
errors and report warnings alongside actual results; a previous pass is not a
substitute for a failing current check.

## 5. Historical evidence and outstanding checks

- [T18.6](archive/v1/tasks/T18-6-device-verification-and-handoff.md) records the 2026-11-03
  eleven-case automated checkpoint and the owner's 2026-11-04 PC/phone report of
  a mixed ten-round game, corrections/rollback/carry-forward, recovery and rematch.
  Core coverage was owner-accepted with explicit limits; it is not agent-operated
  device evidence or a claim that all later PWA cases ran in that checkpoint.
- [T19.4](archive/v1/tasks/T19-4-pwa-and-device-verification.md) records the later 2026-11-04
  fifteen-case automated suite and Android/PC PWA reports. See [PWA testing](pwa-testing.md)
  for installation/update evidence and its boundaries.
- Physical iPhone Safari/home-screen behavior, reversed device roles, 3–6 real
  participants, exact current browser versions and broader native keyboard/inset/
  zoom coverage remain unverified. Earlier expiry reports used a labeled short
  local override; they do not prove an observed 30-minute physical-device wait.
- Hosted version/configuration, resource cost, solver limits and rollback evidence
  belong in [deployment](deployment.md). Local test success is not certification
  of those properties, native TLS trust or comprehensive security.

Record new results with date, command, revision, environment/versions and actual
coverage. Keep owner reports separate from agent observations, and missing cases
explicitly unverified. Testing does not authorize CA/firewall/infrastructure
changes, commit or deployment.
