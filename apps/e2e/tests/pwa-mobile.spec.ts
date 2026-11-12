import { test, expect } from '../support/fixtures';
import { createRoom } from '../support/lobby';
import { advanceServer, recoveryTransport } from '../support/recovery';
import { placeBid } from '../support/gameplay';
import { expectMobileLayout, layoutSizes } from '../support/mobileLayout';
import type { Page } from '@playwright/test';

async function expectMatchSidebar(page: Page, desktop: boolean) {
  const sidebar = page.locator('.active-match-header');
  await expect(sidebar).toHaveCount(1);
  const geometry = await sidebar.evaluate((element) => {
    const bounds = (selector: string) => {
      const rect = element.querySelector(selector)!.getBoundingClientRect();
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
    };
    const style = getComputedStyle(element);
    return { width: element.getBoundingClientRect().width, background: style.backgroundColor,
      border: style.borderTopWidth, borderColor: style.borderTopColor, radius: style.borderRadius,
      padding: style.paddingTop, gap: style.rowGap,
      heading: bounds('.active-match-header__heading'), detail: bounds('.active-match-header__detail'),
      actions: bounds('.active-match-header__actions'), connection: bounds('.active-match-header__connection'),
      version: bounds('.active-match-header__version'),
      phase: bounds('h1'), copy: bounds('.room-code__button'), more: bounds('.match-actions__toggle') };
  });
  if (desktop) {
    expect(geometry.width).toBe(220);
    expect(geometry).toMatchObject({ background: 'rgb(17, 31, 53)', border: '1px',
      borderColor: 'rgb(38, 56, 82)', radius: '10px', padding: '12px', gap: '12px' });
    expect(geometry.heading.bottom).toBeLessThan(geometry.detail.y);
    expect(geometry.detail.bottom).toBeLessThan(geometry.actions.y);
    expect(geometry.connection.y).toBeCloseTo(geometry.heading.y, 0);
    expect(geometry.version.y - geometry.actions.bottom).toBeCloseTo(6, 0);
    await expect(sidebar.locator('.active-match-header__version')).toBeVisible();
    await expect(page.locator('.app-version')).toBeHidden();
    await expect(sidebar.locator('.active-match-header__status-dot')).toHaveCSS('background-color', 'rgb(77, 212, 160)');
    const icon = sidebar.locator('.target-symbol');
    await expect(icon).toHaveCSS('width', '18px');
    await expect(icon).toHaveCSS('height', '18px');
    expect(await icon.getAttribute('data-symbol')).toBe(await page.locator('.game-board__target--active .target-symbol').getAttribute('data-symbol'));
    expect(geometry.copy.right + 8).toBeCloseTo(geometry.more.x, 0);
    expect(geometry.more.right).toBeCloseTo(geometry.connection.right, 0);
  } else {
    expect(geometry.background).toBe('rgb(8, 15, 31)');
    expect(geometry.border).toBe('0px');
    expect(geometry.padding).toBe('0px');
    expect(geometry.actions.x).toBeGreaterThan(geometry.heading.x);
    expect(geometry.detail.y).toBeGreaterThanOrEqual(geometry.heading.bottom);
    await expect(sidebar.locator('.active-match-header__version')).toBeHidden();
    await expect(sidebar.locator('.active-match-header__status-dot')).toBeHidden();
    await expect(sidebar.locator('.active-match-header__target-icon')).toBeHidden();
    await expect(page.locator('.app-version')).toBeVisible();
  }
  expect(geometry.copy.y).toBe(geometry.more.y);
  expect(geometry.copy.right).toBeLessThan(geometry.more.x);
  await expect(sidebar.getByRole('button', { name: /Copy room code/ })).toHaveCount(1);
  await expect(sidebar.getByRole('button', { name: 'More actions' })).toHaveCount(1);
  const timer = sidebar.getByRole('timer');
  if (await timer.count()) {
    await expect(timer).toBeVisible();
    const bounds = (await timer.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(geometry.phase.right);
    expect(Math.abs(bounds.y - geometry.phase.y)).toBeLessThan(12);
  }
}

async function expectMatchColumns(page: Page, threeColumns: boolean) {
  const geometry = await page.locator('.connected-lobby__content').evaluate((element) => {
    const bounds = (selector: string) => {
      const rect = element.querySelector(selector)!.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
    };
    return { sidebar: bounds('.active-match-header'), board: bounds('.board-preview__canvas'),
      panels: bounds('.board-preview__panels'), firstPanel: bounds('.board-preview__panels > :first-child'),
      panelDisplay: getComputedStyle(element.querySelector('.board-preview__panels')!).display,
      scrollY };
  });
  if (threeColumns) {
    expect(geometry.sidebar.width).toBe(220);
    expect(geometry.panels.width).toBe(300);
    expect(geometry.board.width).toBeGreaterThan(geometry.panels.width);
    expect(geometry.board.x - geometry.sidebar.right).toBeCloseTo(20, 0);
    expect(geometry.panels.x - geometry.board.right).toBeCloseTo(20, 0);
    expect(geometry.sidebar.y).toBeCloseTo(geometry.board.y, 0);
    expect(geometry.firstPanel.y).toBeCloseTo(geometry.board.y, 0);
    expect(geometry.sidebar.x).toBeCloseTo(16, 0);
    expect(geometry.sidebar.y + geometry.scrollY).toBeCloseTo(16, 0);
  } else {
    expect(geometry.panelDisplay).toBe('contents');
    expect(geometry.board.y).toBeGreaterThanOrEqual(geometry.sidebar.bottom);
    expect(geometry.firstPanel.y).toBeGreaterThanOrEqual(geometry.board.bottom);
  }
  expect(geometry.board.width).toBeCloseTo(geometry.board.height, 0);
}

test.use({ controlledTime: true, environmentKey: 'pwa-mobile' });

test('offline entry prevents click/keyboard submission and preserves manual exact retry across network events', async ({ page, context }) => {
  let posts = 0;
  page.on('request', (request) => { if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/')) posts++; });
  await page.goto('/room/ABC234');
  await page.getByLabel('YOUR NICKNAME').fill('Mobile player');
  await expect(page.getByRole('button', { name: 'Join Room', exact: true })).toBeEnabled();
  await context.setOffline(true);
  await expect(page.getByText('You are offline. Internet connection required.', { exact: true })).toBeVisible();
  for (const name of ['Create Room', 'Join Room']) await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  await expect(page.getByLabel('YOUR NICKNAME')).toBeEditable();
  await page.locator('form').evaluate((form) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await page.getByRole('textbox', { name: 'ROOM CODE', exact: true }).press('Enter');
  await context.setOffline(false);
  await expect(page.getByRole('button', { name: 'Create Room', exact: true })).toBeEnabled();
  expect(posts).toBe(0);
  await expect(page.getByRole('textbox', { name: 'ROOM CODE', exact: true })).toHaveValue('ABC234');

  await page.route('**/api/session', (route) => route.abort('connectionfailed'));
  await page.getByRole('button', { name: 'Create Room', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry Create Room', exact: true })).toBeEnabled();
  const before = posts;
  await context.setOffline(true);
  await expect(page.getByRole('button', { name: 'Retry Create Room', exact: true })).toBeDisabled();
  await expect(page.getByLabel('YOUR NICKNAME')).toBeDisabled();
  await page.locator('form').evaluate((form) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await context.setOffline(false);
  await expect(page.getByRole('button', { name: 'Retry Create Room', exact: true })).toBeEnabled();
  expect(posts).toBe(before); // No background replay on an online hint.
  await page.unroute('**/api/session');
  await page.getByRole('button', { name: 'Retry Create Room', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Match setup', exact: true })).toBeVisible();
});

test('entry, live board, menus, attempt controls and results retain square geometry and accessible targets at responsive sizes', async ({ page, guestPage, environment, context }, info) => {
  test.setTimeout(90_000);
  await page.goto('/');
  for (const size of layoutSizes) {
    await page.setViewportSize(size);
    await page.getByLabel('YOUR NICKNAME').focus();
    await expectMobileLayout(page, false);
    expect(await page.getByLabel('YOUR NICKNAME').evaluate((input) => getComputedStyle(input).fontSize)).toBe('16px');
    await page.getByRole('button', { name: 'Join Room', exact: true }).scrollIntoViewIfNeeded();
    const button = (await page.getByRole('button', { name: 'Join Room', exact: true }).boundingBox())!;
    expect(button.y + button.height).toBeLessThanOrEqual(size.height + 1);
  }
  await page.screenshot({ path: info.outputPath('short-entry.png') });
  const host = await recoveryTransport(page); const guest = await recoveryTransport(guestPage);
  const code = await createRoom(page, 'Maria');
  await guestPage.goto(`/room/${code}`);
  await guestPage.getByLabel('YOUR NICKNAME').fill('Alex');
  await guestPage.getByRole('button', { name: 'Join Room', exact: true }).click();
  await expect(guestPage.getByRole('heading', { name: 'Match setup', exact: true })).toBeVisible();
  for (const size of layoutSizes) {
    await page.setViewportSize(size); await expectMobileLayout(page);
    await page.getByRole('button', { name: 'More actions', exact: true }).click();
    const menu = (await page.locator('.match-actions__panel').boundingBox())!;
    expect(menu.x).toBeGreaterThanOrEqual(0); expect(menu.x + menu.width).toBeLessThanOrEqual(size.width);
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: 'More actions', exact: true }).click();
  await page.getByRole('button', { name: 'End Room', exact: true }).click();
  const end = page.getByRole('dialog');
  await expect(end).toBeVisible(); await expectMobileLayout(page);
  await end.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Start Match', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thinking', exact: true })).toBeVisible();
  const matchSizes = [...layoutSizes, { width: 1023, height: 768 },
    { width: 1024, height: 768 }, { width: 1279, height: 800 }, { width: 1280, height: 600 },
    { width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }];
  for (const size of matchSizes) {
    await page.setViewportSize(size); await expectMobileLayout(page);
    await expectMatchSidebar(page, size.width >= 1024 && size.width / size.height >= 4 / 3);
    await expectMatchColumns(page, size.width >= 1280 && size.width / size.height >= 4 / 3);
  }
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: `Copy room code ${code}` }).click();
  await expect(page.getByText('Room code copied.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await page.getByRole('button', { name: 'More actions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Skip Round', exact: true })).toBeVisible();
  const desktopMenu = (await page.locator('.match-actions__panel').boundingBox())!;
  expect(desktopMenu.x).toBeGreaterThanOrEqual(0);
  expect(desktopMenu.x + desktopMenu.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: info.outputPath('desktop-match-sidebar.png') });
  await context.setOffline(true);
  await expect(page.locator('.active-match-header__status-dot')).toHaveCount(0);
  await expectMobileLayout(page);
  await context.setOffline(false);
  await expect(page.locator('.active-match-header__status-dot')).toHaveCount(1);
  await placeBid(guestPage, 4); await placeBid(page, 5);
  for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(size);
    await expect(page.getByRole('timer')).toHaveCount(1);
    await expectMatchSidebar(page, size.width >= 1024);
    await expectMatchColumns(page, size.width >= 1280);
  }
  const bidding = host.room()!;
  if (bidding.status !== 'playing' || bidding.match.phase !== 'bidding') throw new Error('Expected bidding');
  await advanceServer(environment, bidding.roomId, bidding.match.deadlineAtMs + 1, [host, guest]);
  await expect(guestPage.getByRole('region', { name: 'Demonstration controls' })).toBeVisible();
  for (const size of matchSizes) {
    await guestPage.setViewportSize(size); await expectMobileLayout(guestPage);
    await expectMatchSidebar(guestPage, size.width >= 1024 && size.width / size.height >= 4 / 3);
    await expectMatchColumns(guestPage, size.width >= 1280 && size.width / size.height >= 4 / 3);
  }
  await guestPage.screenshot({ path: info.outputPath('short-demonstration.png') });
  await guestPage.getByRole('button', { name: 'Give up', exact: true }).click();
  await page.getByRole('button', { name: 'Give up', exact: true }).click();
  for (const size of layoutSizes) {
    await page.setViewportSize(size);
    await expect(page.getByRole('dialog')).toBeVisible(); await expectMobileLayout(page);
    const panel = (await page.locator('.round-result-panel').boundingBox())!;
    expect(panel.y).toBeGreaterThanOrEqual(0); expect(panel.y + panel.height).toBeLessThanOrEqual(size.height + 1);
    await page.getByRole('button', { name: 'Continue', exact: true }).scrollIntoViewIfNeeded();
  }
});
