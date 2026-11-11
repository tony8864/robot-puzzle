# PWA installation and testing — Robot Puzzle

Current behavior and instructions, reviewed 2026-11-11. This cleanup did not run
tests or operate a device. [Browser testing](browser-testing.md) owns harness
isolation and the suite inventory; historical evidence is labeled below.

## 1. Current shell and online requirement

Production links a root-scoped standalone [manifest](../apps/web/public/manifest.webmanifest)
and original SVG, 192/512px PNG, opaque maskable 512px, and 180px Apple touch icons.
Normal browser/invite entry works without installation. Standalone mode does not
promise a banner, fullscreen UI or removal of OS status/gesture bars.

Production registers `/robot-puzzle-sw.js` for verified static caching; ordinary
Vite development does not. Installation does not create a room or renew the fixed
24-hour identity. Browser tabs and installed contexts may have different identity/
tab storage; observe actual seats rather than assuming credentials transfer.

**Multiplayer requires connectivity.** Cached assets may open an offline shell,
but never a cached live room or offline-play queue. Offline UI preserves drafts/
uncertain command IDs and gates submissions. Online hints alone neither establish
synchronization nor automatically replay an uncertain action.

## 2. Automated checks

From the repository root after workspace setup:

```powershell
pnpm build
pnpm typecheck
pnpm --filter @robot-puzzle/web test
pnpm --filter @robot-puzzle/e2e test:e2e tests/pwa-shell.spec.ts tests/pwa-cache.spec.ts tests/pwa-mobile.spec.ts
git diff --check
```

The browser runner creates its own temporary production build and isolated HTTPS
backend; it does not use an existing `dist` or local development rooms. If managed
Chromium is missing, `pnpm test:e2e:install` downloads it. Run broader regressions
sequentially as described in the browser guide.

| Test file | Coverage | Does not establish |
| --- | --- | --- |
| `pwa-shell.spec.ts` | Manifest metadata/MIME, decoded PNG sizes/opacity/mask safety, normal entry/invite asset delivery | Native launcher installation/trust |
| `pwa-cache.spec.ts` | Static-only offline shell, no API caching, cookie-free downloads, atomic failed update, waiting multi-tab activation and preserved identity/state | Physical storage eviction, native app suspension or hosted asset integrity |
| `pwa-mobile.spec.ts` | Offline click/keyboard-submit gating, manual exact retry, narrow/short/tablet/desktop board/control/menu/dialog geometry | Native software keyboard, nonzero safe-area insets, physical iPhone or all zoom settings |

The mobile tests use the private controlled-time fixture; the cache test uses
isolated alternate builds. Both remain outside production routing as detailed in
[browser testing](browser-testing.md). Default runner viewport is not a physical
phone, and responsive CSS assertions do not certify native device behavior.

### Regenerate icons only after artwork changes

Source: [robot-puzzle.svg](../apps/web/public/icons/robot-puzzle.svg).
The existing generator uses managed Chromium and writes four named PNGs:

```powershell
pnpm --filter @robot-puzzle/e2e icons:generate
```

Review exports visually, including circular launcher crop, maskable safe area and
light/dark surroundings. Ordinary builds do not regenerate PNG source assets.
This documentation cleanup does not run the generator or modify artwork.

## 3. Static cache and update expectations

The [build plugin](../apps/web/build/staticPwa.ts) generates a content-addressed
cache name and exact SHA-256 allowlist for public HTML, emitted assets, manifest
and reviewed icons. Maps, worker script, API replies, credentials and room state
are excluded. [Worker source](../apps/web/pwa/worker.ts) owns exact matching rules.

Install downloads omit cookies and check status, MIME, privacy headers and bytes
before completing the cache. Missing/corrupt files or failed writes prevent the
new version from activating; the active version is retained. Host rewriting of
built bytes can break integrity checks, so hosted assets need separate verification.

Eligible root/invite navigation accepts network HTML only if it matches the active
build, otherwise uses that version's cached shell. Real 4xx remain errors.
Unknown files, API routes, query variants of static assets and cross-origin traffic
do not become cached HTML. No runtime cache writes or offline command queue exist.

New versions wait for all old controlled tabs/windows to close. There is no
`skipWaiting`, `clients.claim` or automatic reload. Reloading while another old
tab remains can keep the old build. Cleanup removes only this app's static-cache
namespace, preserving unrelated caches and credential/route/pending-command storage.

Caching is best effort: first-ever offline visits, eviction or denied registration/
storage can prevent offline launch. Online play must still work after install
failure. A missing cached shell shows recovery feedback, never fabricated state.
Do not clear user storage while a live room/uncertain command needs recovery.

The footer reads the version from [web package.json](../apps/web/package.json)
through the build. An open client retains its build's label until update adoption;
a displayed version alone does not prove a particular Git revision or backend
deployment. Historical `v0.1.0` reports below do not establish the current hosted version.

## 4. Local production preview

Use the existing approved HTTPS setup from [local development](local-development.md).
Keep the backend running, stop only the development frontend, then:

```powershell
pnpm build
pnpm --filter @robot-puzzle/web preview --mode https --host 0.0.0.0 --port 5173 --strictPort
```

The installed Vite preview inherits configured server HTTPS/proxy settings;
`--mode https` reads existing ignored certificate paths and fails if missing.
Use the already approved exact Origin/port, certificate and trusted LAN setup.
For loopback-only testing replace `0.0.0.0` with `127.0.0.1`.
This is a local production-build preview, not deployment or native trust evidence.
Do not change CA trust, firewall rules or backend Origins implicitly.

An active service worker can control development pages on the same origin even
though development does not register one. Keep dev and installed-preview sessions
separate where practical. Using another origin/port requires matching approved
Origin/certificate configuration; it also creates separate identity/storage.
Development code does not unregister existing workers or clear caches automatically.

## 5. Physical installation and recovery checklist

Use an already approved, trusted HTTPS origin serving production assets with the
real API. Do not deploy, install a CA or bypass warnings merely to complete checks.
Record device/OS/browser/version, origin, host/guest roles and tab/installed mode.

1. **Install/launch:** Android Chrome's Install/Add to Home Screen menu when offered,
   or iPhone Safari's Share → Add to Home Screen (Open as Web App where offered).
   Wording/availability varies. Check icon/name, standalone presentation and normal
   browser fallback; record any separate identity context without transferring tokens.
2. **Live play:** join an independent PC identity, compare roster/board/bids,
   demonstrate with Undo/Reset, and check invite links. Installation does not let
   a new identity join a started match.
3. **Background:** lock/unlock and switch apps during bidding/demonstration.
   Verify authoritative phase/deadline/positions/history return without duplicate
   seats or fresh-ID retries of uncertain commands.
4. **Offline:** first open online, allow install and refresh online to establish
   control. Disable Wi-Fi/mobile data and reload/relaunch. Expect shell/recovery
   and internet-required feedback, disabled live actions and preserved drafts.
   Restore connectivity, synchronize and explicitly Retry any uncertain action.
5. **Layout:** inspect keyboard, short-screen scrolling, menus/dialogs/results,
   safe areas, touch controls and zoom in normal and standalone modes.
6. **Update:** with old clients open, make a distinct build available through an
   already authorized local workflow. Expect no surprise in-match reload. Close
   all old app windows/tabs and relaunch; verify eventual new-version adoption and
   normal same-seat recovery. A hosted update needs separate deployment approval.
7. Repeat relevant checks on a physical iPhone, including home-screen launch.
   Mark unavailable cases unverified; desktop Chromium/WebKit emulation is separate.

## 6. Historical evidence and remaining limits

[T19.4](archive/v1/tasks/T19-4-pwa-and-device-verification.md) records owner-accepted coverage
on 2026-11-04. Its automated fifteen-case suite passed then; the record includes
workspace tests/types/build and follow-up checks after the version footer.
These are dated results, not reruns during this cleanup.

The owner reported Galaxy A36 5G / Android 15 and PC testing on local trusted HTTPS:
installation/home-screen launch, multiplayer, invites, lock/app switching, offline
feedback/recovery and layout/dialog fit. Exact browser versions and host aliases
were not recorded. A ten-skipped-round no-winner results check is not evidence of
ten successful demonstrations; the earlier mixed-game report is in
[T18.6](archive/v1/tasks/T18-6-device-verification-and-handoff.md).

The owner also reported that an open Android app stayed unchanged, then adopted
the `v0.1.0` footer after old clients closed and home-screen relaunch. This is
observed update adoption by owner report, not inspection of internal waiting state
or proof of a current hosted version. Physical iPhone checks were explicitly
deferred; accepted limits do not turn missing coverage into a pass.

Outstanding: physical iPhone Safari/browser/home-screen behavior, exact browser
versions, broader native inset/keyboard/zoom and storage-eviction cases; intermittent
slow reconnect; and the later Samsung Internet install warning in
[next release](next-release.md). Neither the warning's cause nor the reconnect
delay is established. [Deployment](deployment.md) owns current hosted evidence;
local preview/automation does not certify production resources, TLS or asset rollout.
Keep new results dated and distinguish owner reports, agent observations and
automated assertions. Never publish credentials or private command payloads.
