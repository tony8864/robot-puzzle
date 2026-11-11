# Private Cloudflare deployment

Status (2026-11-11): the public root URL serves the Robot Puzzle HTML shell.
The deployed source revision and Cloudflare deployment/version ID are unverified.

## Current deployment evidence

- A read-only HTTPS GET to `https://robot-puzzle.tonyivanov88.workers.dev/`
  returned HTTP 200 with `Content-Type: text/html`, title `Robot Puzzle`, and
  references to the app's JavaScript, stylesheet, manifest and icons on 2026-11-11.
  Those referenced resources were not fetched and the app was not rendered.
- Local Git tag `v1.0.0` resolves to
  `a8e4d0761c3563a7f9db80c100586214d3cdb887`, also the current HEAD at this review.
  This is a source baseline, not evidence that this commit or version is deployed.
- This check did not verify API/WebSocket behavior, hosted room persistence,
  multiplayer gameplay, PWA installation/update behavior, device compatibility,
  solver performance or hosted resource limits. Earlier local checks below do
  not establish these hosted properties.
- Deployment time, account/plan state, hosted configuration and migration state,
  Cloudflare deployment/version IDs, and a tested rollback procedure remain
  unverified in this review. No deployment or infrastructure change was made.

## Selected setup

The following describes repository configuration and the selected hosting plan,
not independently verified hosted account state.

- One Worker named `robot-puzzle`, serving the built React app and API together.
- Configured production origin: `https://robot-puzzle.tonyivanov88.workers.dev`.
- Existing SQLite-backed Registry and Room classes; new hosted namespaces, not
  a copy of local `.wrangler` storage. Local nicknames/seats/rooms do not migrate.
- Start on Workers Free. Hosted limits, solver CPU/storage usage and iPhone
  behavior still require verification; no billing-plan change is authorized.

## Configuration and local checks

`apps/server/production/wrangler.json` is deliberately separate from the existing
local config and its `.dev.vars`. Paths are relative to that config file. It
sets `APP_ENV=production`, accepts only the intended HTTPS Origin, disables
preview URLs and persisted observability, and leaves local timeout overrides out.
The Worker name/subdomain must match the signed-in target account. Stop if they
do not; never broaden allowed Origins to work around a mismatch.

In the repository configuration, static assets come from `apps/web/dist`;
`/room/:code` uses the SPA shell.
`/api` and `/api/*` always reach the actual Worker, including unknown API paths
and WebSocket upgrades. No Vite server, local certificates, private keys or
developer variables are deployed. The production service worker remains an
unchanged static build artifact.

From the repository root:

```powershell
pnpm build
pnpm --filter @robot-puzzle/server check:production
```

The second command is **dry-run only**: bundles/configures locally under ignored
`.wrangler/production-dry-run`; it does not upload assets, create namespaces or
publish the app. Test routing independently with:

```powershell
pnpm --filter @robot-puzzle/server exec vitest run --config vitest.persistence.config.ts test/productionConfig.test.ts
```

That test uses production config settings and actual backend code with small
temporary asset fixtures. Existing browser tests cover the real production web
build separately; neither proves hosted quotas or TLS behavior.

## Historical preparation evidence

### Preparation evidence (2026-11-05)

- `pnpm build`: passed.
- `pnpm typecheck`: passed across the workspace.
- `pnpm --filter @robot-puzzle/server check:production`: passed; Wrangler reported
  the intended production vars/classes and exited at `--dry-run`, without upload.
- The two production-config tests passed, covering configuration and isolated
  runtime asset/invite/API routing, exact Origin, cookie issuance, room creation
  and real WebSocket binding. Initial Node-test transport resets after an
  intentionally rejected POST were resolved by consuming replies and disabling
  keepalive in that test's POST helper; no application transport change was made.
- Six production-browser checks passed: entry (2), lobby/invites (3), PWA shell (1).
- `git diff --check`: passed (Windows LF/CRLF notices only).

No dependencies, game logic, browser trust, local config or account resources
were changed. Wrangler prints an update-available notice; tooling was not upgraded.
These are preparation checks, not a hosted performance or deployment pass.

## Gate before future deployment

Do not run a real deploy until the owner explicitly approves it. Confirm:

- Signed-in account owns `tonyivanov88.workers.dev` and stays on the chosen plan.
- Review the pinned Node-20-compatible Wrangler 4.45.0 before release; dry-run
  success is not an up-to-date-toolchain/security certification. Do not silently
  upgrade tooling, change compatibility date or alter Durable Object migrations.
- Build/type checks, production-routing tests and dry run pass.
- The public URL will be internet-accessible; room codes are not a site-wide
  access control. Existing request limits are not comprehensive DoS protection.

For an approved deployment, verify the exact public URL, assets/PWA,
API rejection behavior, two-device full game, solver performance, reconnects and
the deferred iPhone Safari checks before sharing broadly. Do not assume local
sessions or installed local PWA credentials carry to the hosted origin. Keep
releases coordinated with clients; code rollback does not undo durable data or
schema migrations. Version IDs and a tested rollback procedure are still part
of the deployment checkpoint, not claimed complete here.

References: [Static Assets](https://developers.cloudflare.com/workers/static-assets/),
[Workers routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/),
[workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/).
