import { test, expect } from '../support/fixtures';
import { createRoom, observeRooms } from '../support/lobby';
import { placeBid } from '../support/gameplay';
import { advanceServer, recoveryTransport } from '../support/recovery';

test.use({ controlledTime: true, environmentKey: 'early-bidding-request' });

test('host requests and cancels shared early-end state without closing bidding; bids and expiry clear it', async ({ page, guestPage, environment }, info) => {
  for (const player of [page, guestPage]) await player.setViewportSize({ width: 1280, height: 800 });
  const hostRoom = observeRooms(page);
  const host = await recoveryTransport(page);
  const guest = await recoveryTransport(guestPage);
  const code = await createRoom(page, 'Maria');
  await guestPage.goto(`/room/${code}`);
  await guestPage.getByLabel('YOUR NICKNAME').fill('Alex');
  await guestPage.getByRole('button', { name: 'Join Room', exact: true }).click();
  await page.getByRole('button', { name: 'Start Match', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thinking', exact: true })).toBeVisible();
  await placeBid(guestPage, 7); // Host can request without submitting a bid.
  await expect(page.getByRole('heading', { name: 'Bidding', exact: true })).toBeVisible();
  const first = hostRoom()!;
  if (first.status !== 'playing' || first.match.phase !== 'bidding') throw new Error('Expected bidding');
  const deadline = first.match.deadlineAtMs;
  await page.setViewportSize({ width: 390, height: 844 });
  const notice = (player: typeof page) => player.getByRole('region', { name: 'Early bidding request', exact: true });
  const request = async () => {
    await page.getByRole('button', { name: 'More actions', exact: true }).click();
    await page.getByRole('button', { name: 'End bidding early', exact: true }).click();
    for (const player of [page, guestPage]) await expect(notice(player)).toBeVisible();
  };
  await request();
  await expect(notice(page)).toContainText('The countdown continues.');
  await expect(notice(guestPage).getByRole('button')).toHaveCount(2);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'More actions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'End bidding early', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toContainText('Your agreement is counted');
    await expect(notice(page).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    const bounds = await notice(page).evaluate((element) => {
      const card = element.getBoundingClientRect();
      const bid = document.querySelector('.bid-card')!.getBoundingClientRect();
      const roster = document.querySelector('.player-bids')!.getBoundingClientRect();
      const button = element.querySelector('button')!.getBoundingClientRect();
      const progress = element.querySelector('[role="progressbar"]')!.getBoundingClientRect();
      return { cardTop: card.top, cardBottom: card.bottom, bidBottom: bid.bottom, rosterTop: roster.top,
        buttonWidth: button.width, progressWidth: progress.width, buttonHeight: button.height, progressHeight: progress.height,
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(bounds.cardTop).toBeGreaterThanOrEqual(bounds.bidBottom);
    expect(bounds.rosterTop).toBeGreaterThanOrEqual(bounds.cardBottom);
    expect(bounds.buttonWidth).toBeCloseTo(bounds.progressWidth, 1);
    expect(bounds.buttonHeight).toBe(48);
    expect(bounds.progressHeight).toBe(6);
    expect(bounds.overflow).toBe(false);
    await page.screenshot({ path: info.outputPath(`host-request-${width}.png`), fullPage: true });
  }
  await page.reload();
  await expect(notice(page)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel request', exact: true }).click();
  for (const player of [page, guestPage]) await expect(notice(player)).toHaveCount(0);
  await request();
  await guestPage.setViewportSize({ width: 390, height: 844 });
  await expect(notice(guestPage)).toBeVisible();
  await placeBid(guestPage, 6);
  for (const player of [page, guestPage]) await expect(notice(player)).toHaveCount(0);
  await guestPage.setViewportSize({ width: 1280, height: 800 });
  await request();
  const pending = hostRoom()!;
  if (pending.status !== 'playing' || pending.match.phase !== 'bidding') throw new Error('Expected bidding');
  expect(pending.match.deadlineAtMs).toBe(deadline);
  expect(pending.match.earlyEndRequest).toBeDefined();
  await advanceServer(environment, pending.roomId, deadline, [host, guest]);
  await expect(guestPage.getByRole('region', { name: 'Demonstration controls' })).toBeVisible();
  for (const player of [page, guestPage]) await expect(notice(player)).toHaveCount(0);
});

test('player panel keeps mobile buttons side by side, restores agreement after reload and closes only on unanimity', async ({ page, guestPage, browser, environment }, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const host = await recoveryTransport(page);
  const guest = await recoveryTransport(guestPage);
  const code = await createRoom(page, 'Maria');
  await guestPage.goto(`/room/${code}`);
  await guestPage.getByLabel('YOUR NICKNAME').fill('Alex');
  await guestPage.getByRole('button', { name: 'Join Room', exact: true }).click();
  const context = await browser.newContext({ baseURL: environment.origin, ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } });
  try {
    const thirdPage = await context.newPage();
    await thirdPage.goto(`/room/${code}`);
    await thirdPage.getByLabel('YOUR NICKNAME').fill('Teo');
    await thirdPage.getByRole('button', { name: 'Join Room', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Players', exact: true }).getByRole('listitem')).toHaveCount(3);
    await page.getByRole('button', { name: 'Start Match', exact: true }).click();
    await expect.poll(() => host.room()?.status).toBe('playing');
    await environment.clock!.advanceTo((await environment.clock!.now()) + 1, host.room()!.roomId);
    await expect(page.getByRole('heading', { name: 'Thinking', exact: true })).toBeVisible();
    await placeBid(page, 7);
    const room = host.room()!;
    if (room.status !== 'playing' || room.match.phase !== 'bidding') throw new Error('Expected bidding');
    const deadline = room.match.deadlineAtMs;
    await page.getByRole('button', { name: 'More actions', exact: true }).click();
    await page.getByRole('button', { name: 'End bidding early', exact: true }).click();
    const panel = guestPage.getByRole('region', { name: 'Early bidding request', exact: true });
    await expect(panel.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    for (const width of [1280, 390, 320]) {
      await guestPage.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
      await expect(panel).toBeVisible();
      const bounds = await panel.evaluate((element) => {
        const rect = (selector: string) => {
          const r = element.querySelector(selector)!.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
        };
        const bid = document.querySelector('.bid-card')!.getBoundingClientRect();
        const roster = document.querySelector('.player-bids')!.getBoundingClientRect();
        const outer = element.getBoundingClientRect();
        return { decline: rect('button:first-child'), agree: rect('button:last-child'),
          bidBottom: bid.bottom, top: outer.top, bottom: outer.bottom, rosterTop: roster.top,
          overflow: document.documentElement.scrollWidth > innerWidth };
      });
      expect(bounds.decline.y).toBeCloseTo(bounds.agree.y, 1);
      expect(bounds.decline.width).toBeCloseTo(bounds.agree.width, 1);
      expect(bounds.decline.height).toBeGreaterThanOrEqual(44);
      expect(bounds.agree.x).toBeGreaterThan(bounds.decline.x + bounds.decline.width);
      expect(bounds.top).toBeGreaterThanOrEqual(bounds.bidBottom);
      expect(bounds.rosterTop).toBeGreaterThanOrEqual(bounds.bottom);
      expect(bounds.overflow).toBe(false);
      await guestPage.screenshot({ path: info.outputPath(`player-request-${width}.png`), fullPage: true });
    }
    await expect(guestPage.getByRole('dialog')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Agree to end', exact: true }).click();
    await expect(panel).toContainText('You agreed to end bidding early');
    await expect(panel.getByRole('button')).toHaveCount(0);
    await expect(panel.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    await expect(page.getByRole('region', { name: 'Early bidding request' }).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    await guestPage.reload();
    await expect(panel).toContainText('Waiting for other players…');
    await expect(panel.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    await expect(page.getByRole('heading', { name: 'Bidding', exact: true })).toBeVisible();
    await thirdPage.getByRole('region', { name: 'Early bidding request' }).getByRole('button', { name: 'Agree to end', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Demonstration controls' })).toBeVisible();
    for (const player of [page, guestPage, thirdPage]) await expect(player.getByRole('region', { name: 'Early bidding request' })).toHaveCount(0);
    expect(await environment.clock!.now()).toBeLessThan(deadline);
    await guest.snapshot();
  } finally { await context.close(); }
});

test('player decline clears both panels, leaves bidding open and enforces the request cooldown', async ({ page, guestPage, environment }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const host = await recoveryTransport(page); const guest = await recoveryTransport(guestPage);
  const code = await createRoom(page, 'Maria');
  await guestPage.goto(`/room/${code}`);
  await guestPage.getByLabel('YOUR NICKNAME').fill('Alex');
  await guestPage.getByRole('button', { name: 'Join Room', exact: true }).click();
  await page.getByRole('button', { name: 'Start Match', exact: true }).click();
  await expect.poll(() => host.room()?.status).toBe('playing');
  await environment.clock!.advanceTo((await environment.clock!.now()) + 1, host.room()!.roomId);
  await expect(page.getByRole('heading', { name: 'Thinking', exact: true })).toBeVisible();
  await placeBid(page, 7);
  const request = async () => {
    await page.getByRole('button', { name: 'More actions', exact: true }).click();
    await page.getByRole('button', { name: 'End bidding early', exact: true }).click();
  };
  await request();
  await guestPage.getByRole('region', { name: 'Early bidding request' }).getByRole('button', { name: 'Decline', exact: true }).click();
  for (const player of [page, guestPage]) {
    await expect(player.getByRole('region', { name: 'Early bidding request' })).toHaveCount(0);
    await expect(player.getByRole('heading', { name: 'Bidding', exact: true })).toBeVisible();
  }
  await request();
  await expect(page.getByRole('alert')).toContainText('10 seconds');
  const room = host.room()!;
  if (room.status !== 'playing' || room.match.phase !== 'bidding' || !room.match.earlyEndAvailableAtMs) throw new Error('Expected cooldown');
  await advanceServer(environment, room.roomId, room.match.earlyEndAvailableAtMs, [host, guest]);
  await request();
  await expect(guestPage.getByRole('region', { name: 'Early bidding request' })).toBeVisible();
  const after = host.room()!;
  expect(after.status === 'playing' && after.match.phase === 'bidding' && after.match.deadlineAtMs).toBe(room.match.deadlineAtMs);
});
