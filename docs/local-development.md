# Local development — Robot Puzzle

This guide covers the current local frontend and multiplayer backend. For system
ownership see [architecture](architecture.md); for hosted evidence and procedures
see [deployment](deployment.md). Running these commands does not deploy the app.

## 1. Prerequisites

Run commands from the repository root. The workspace declares Node >=20.19.0 and
pnpm 12.14.0. Install dependencies with the checked-in lockfile:

```powershell
pnpm install --frozen-lockfile
```

Current repository pins include Wrangler 4.45.0, Workers Vitest pool 0.10.0 and
Miniflare 4.20251011.1, with runtime compatibility date `2025-10-11` and Vitest 3.
These are repository settings, not a claim about latest tooling or a security audit.
Do not silently upgrade tools, compatibility dates or Durable Object migrations.
Dependency installation allows required `esbuild`/`workerd` build steps; unused
transitive `sharp` scripts are disabled in `pnpm-workspace.yaml`.

## 2. Configure HTTPS for multiplayer

Secure-cookie authentication needs the HTTPS setup. HTTP is useful for UI/proxy
checks, but do not weaken cookie security to make LAN HTTP work.

Use existing approved certificates if available. Creating a development CA,
installing trust, changing firewall rules or opening a tunnel requires separate
authorization; these instructions do not perform those operations. A certificate
must cover the hostname/IP actually used: `localhost`, loopback IP if needed,
and the PC's current Wi-Fi IP for phone testing. Keep CA/server private keys outside
Git, preferably outside the repository. Never send private keys to a phone.

If `apps/web/.env.https.local` does not exist, copy
[.env.example](../apps/web/.env.example) there. Otherwise merge settings without
overwriting existing values. Set absolute paths to the supplied certificate/key:

```dotenv
RR_HTTPS_CERT=C:/your-private-cert-directory/localhost.pem
RR_HTTPS_KEY=C:/your-private-cert-directory/localhost-key.pem
```

These are development-server `RR_*` settings, not client-exposed `VITE_*` values.
Missing/unreadable certificates fail startup; HTTPS never silently falls back.

The local [Wrangler config](../apps/server/wrangler.jsonc) defaults to
`ALLOWED_ORIGINS=https://localhost:5173`. If overrides are needed, use the
[example](../apps/server/.dev.vars.example) to create or merge into ignored
`apps/server/.dev.vars`. Preserve other existing settings and list exact origins
including scheme and port, without wildcards. Example for PC and phone access:

```dotenv
ALLOWED_ORIGINS="https://localhost:5173,https://YOUR-PC-WIFI-IP:5173"
```

Replace the IP placeholder before use. Restart the Worker after changes.
The certificate and Origin must match the address used in the browser.
The server rejects missing/untrusted/non-HTTPS Origins and does not trust
browser-supplied forwarding headers as authority.

## 3. Start the backend and frontend

In one terminal:

```powershell
pnpm --filter @robot-puzzle/server dev
```

In a second terminal:

```powershell
pnpm --filter @robot-puzzle/web dev:https
```

Open `https://localhost:5173`. The frontend proxies `/api` HTTP and WebSocket
upgrades to `http://127.0.0.1:8787`, preserving browser Origin/Host; the browser
uses HTTPS/WSS while the same-PC proxy uses loopback HTTP.

The Worker listens on loopback port 8787 and its debugger on 9230. Vite defaults
to loopback 5173 with `strictPort`, so a busy port fails rather than switching.
Stop each server with Ctrl+C. Do not expose Worker/debugger ports on Wi-Fi.

For UI-only/local-simulator checks without HTTPS:

```powershell
pnpm --filter @robot-puzzle/web dev
```

Open `http://127.0.0.1:5173`, or `/?preview=local` for the development simulator.
The simulator is separate from authoritative multiplayer. To check the Worker
proxy, visit `/api/health` on the frontend origin. Its current local-only response:

```json
{"status":"ok","checkpoint":"T14.1"}
```

The checkpoint string is a historical diagnostic label still returned by source;
it does not describe current gameplay scope. Health proves routing only.
The Vite proxy is development-only, not part of the production web build.

## 4. Optional phone testing over Wi-Fi

Use only when LAN serving and certificate trust have been authorized:

```powershell
pnpm --filter @robot-puzzle/web dev:https --host 0.0.0.0
```

Open `https://YOUR-PC-WIFI-IP:5173` on the phone. The PC address must appear in the
certificate and exact allowed Origins. Trust only the public development CA
certificate through device settings; the browser must accept HTTPS without a
security warning. If the IP changes, update the certificate and Origin together.
Use a trusted network and request permission before changing firewall rules.

After testing, stop LAN serving. Remove phone development-CA trust when no longer
needed; PC trust removal is a separate explicit operation, not automatic project
cleanup. No certificate/trust/firewall changes are performed by this guide.

## 5. Exercise the real multiplayer UI

1. On the configured HTTPS origin, enter a nickname and Create Room.
2. In a separate browser profile or device, Join using the code or an invite
   `/room/ACTUAL-CODE`. Invites prefill the code; they do not join automatically.
   Ordinary tabs in one profile share identity and are not separate players.
3. Wait for connection synchronization. Confirm the shared roster/board; only the
   host can Shuffle or Start. Start needs at least two seated players.
4. Start prepares a verified target and enters Thinking. All players may bid;
   first acceptance starts the 60-second server window. Own bids may be lowered.
5. Demonstrate with the active bidder: moves, Undo, Reset and Give Up are live.
   Spectators are read-only. Success carries all four positions forward; failure
   restores round-start positions before the next bidder.
6. The host advances round results and, after final results, may return everyone
   to Lobby. Starting another match is explicit.
7. Review refresh, network loss/resume, guest Leave, host End and disconnected
   bidder grace/skip separately. These are implemented, not future checkpoints.

The client automatically attempts recovery after transient loss/resume and
restores an existing seat from the cookie and validated tab-local routing.
Manual Reconnect remains available. An uncertain bid/move needs explicit Retry
with its original ID/payload; do not replace it with a new action or queue offline
input. Storage denial can limit refresh recovery and is reported by the UI.
Explicit different invites take precedence over saved room auto-resume.

For a lost Create/Join reply, keep the page open and use its Retry control.
Bootstrap requests are retained in memory; do not expect a creation retry to
survive navigation/refresh. The live-room recovery mechanism is separate.
Expired identity needs explicit Start a new session and cannot reclaim an old seat
by nickname. Identity expires 24 hours after issuance, without sliding renewal.
Never copy credentials into console output, URLs or another browser.

Low-level contracts are in [shared requests](../packages/shared/src/clientRequests.ts).
Use current protocol v2 for new actions. Historical v1 console examples are not
current recipes; a bare socket also needs the connection lease/heartbeat protocol.
Use the UI or isolated test adapters instead of treating an unmaintained diagnostic
socket as proof of recovery. Historical decisions/evidence remain in
[server design](archive/v1/tasks/T14-1-server-design-and-local-setup.md) and
[lifecycle verification](archive/v1/tasks/T17-8-recovery-and-lifecycle-verification.md).

## 6. Persistence and deliberate reset

Development storage is `apps/server/.wrangler/state`. Restarting Wrangler preserves
Registry/Room data, including sessions, rooms, matches and replay outcomes.
Local/test/production storage is separate. Do not rename classes or alter migration
history casually. Supported records are validated/migrated; unknown/corrupt records
fail closed rather than being overwritten.

`.wrangler/`, dotenv/`.dev.vars` files (except examples), `.certs/` and generated
Worker types are ignored. Keep keys and credentials out of commits and public assets.

For an intentional local reset, stop the Worker first. Resolve and inspect the
exact `apps/server/.wrangler/state` path inside this repository, then obtain
explicit approval before moving it to a backup outside `.wrangler`. Restart creates
fresh storage and old local identities/rooms no longer resolve there. Restore only
while stopped. Never delete the whole `.wrangler` parent or reset on startup.
No reset is needed for tests or this documentation cleanup.

## 7. Tests and preparation benchmark

```powershell
pnpm --filter @robot-puzzle/server test
pnpm --filter @robot-puzzle/server typecheck
pnpm --filter @robot-puzzle/web typecheck
```

Server `test` runs both Workers tests and the separate Node-hosted runtime/
persistence suite with isolated storage, not developer `.wrangler/state`.
Server typecheck first regenerates `wrangler types` from local config.
`test:watch` watches the Workers suite; rerun the full test command for persistence.

Useful targeted checks:

```powershell
pnpm --filter @robot-puzzle/server exec vitest run test/fullMatch.test.ts
pnpm --filter @robot-puzzle/server exec vitest run test/presence.test.ts
pnpm --filter @robot-puzzle/server exec vitest run --config vitest.persistence.config.ts test/clientRecovery.test.ts
```

Full-match checks cover two-/six-player outcomes, ten rounds and explicit rematch;
client recovery checks exercise actual frontend adapters against a local Worker.
Controlled clocks/fixtures do not make these rendered-browser or physical-device
checks. Runtime recreation is covered separately. The test-only entries and clock
controls are not production APIs.

Rendered-browser checks have their own isolated HTTPS runtime; no manual server
startup or phone trust is required. See [browser testing](browser-testing.md).
For production service-worker/cache checks see [PWA testing](pwa-testing.md);
Vite development startup does not exercise production service-worker registration.

The opt-in preparation benchmark is separate from ordinary tests:

```powershell
pnpm --filter @robot-puzzle/server benchmark:round-setup
```

It runs a test-only Worker/Room in Miniflare and regenerates
`docs/benchmarks/T15-local-workers-results.json`, without live rooms or development
storage. No deployment/account is used. [Measurements](benchmarks/T15-local-workers-preparation.md)
explain reproduction, budgets and local-versus-hosted limits; fixture proofs are
test evidence, never a public game-server API.

## 8. Short local empty-room expiry check

To test without waiting the normal 30 minutes, merge this into existing
`apps/server/.dev.vars`, preserving Origin and other settings:

```dotenv
LOCAL_EMPTY_ROOM_TIMEOUT_SECONDS="60"
```

Restart the backend and create a fresh room. The override accepts 1–1800 seconds
only with `APP_ENV=local`; non-local environments always use 30 minutes.
Close every room tab/device and wait for expiry before reopening the code.
Lost-network detection can first take the normal 30-second lease interval.
An authenticated binding strictly before expiry cancels emptiness; HTTP lookups
do not. Any responsive tab keeps its seat connected.

Remove the setting and restart afterward. Use fresh rooms for each timeout;
existing empty periods preserve their persisted deadlines across configuration
changes/restarts. This does not change the separate 24-hour identity lifetime.

## 9. Troubleshooting and verification limits

- **Port busy:** stop only the process you own or intentionally choose a matching
  frontend port/Origin/certificate setup; do not let a silent port change mask errors.
- **HTTPS startup/trust failure:** check absolute key/certificate paths, hostname/IP
  coverage and browser trust. A warning bypass is not successful trust verification.
- **Create/Join or WSS rejected:** use the exact configured HTTPS origin, restart
  after config changes, check identity expiry and use separate profiles for players.
- **Disconnected/pending action:** let recovery synchronize, then use explicit exact
  Retry if required. Positive online hints alone do not establish a connection.
- **Windows `EBUSY` or canceled I/O diagnostics:** distinguish cleanup warnings from
  assertion failures and investigate new unhandled errors. Do not broadly delete
  temporary folders; each harness owns only its verified temporary directory.
- **Migration/tooling changes:** the pinned config uses `new_sqlite_classes`.
  Upgrades require separate review; do not mix migration formats or wipe rooms
  to make incompatible versions pass.

This guide does not claim these commands or device checks were rerun during
documentation cleanup. Existing [device handoff](archive/v1/tasks/T18-6-device-verification-and-handoff.md)
and [PWA handoff](archive/v1/tasks/T19-4-pwa-and-device-verification.md) records describe prior
evidence. Physical iPhone Safari and general device/browser compatibility remain
incompletely verified. Local tests do not certify hosted quotas, solver CPU/storage
or heartbeat/hibernation costs; deployment requires separate approval.
