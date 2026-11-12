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
    const size = page.viewportSize()!;
    const wide = size.width >= 1280;
    const growth = wide ? Math.max(0, Math.min(40, (size.width - size.height - 560) / 2)) : 0;
    expect(geometry.width).toBeCloseTo(220 + growth, 0);
    expect(geometry).toMatchObject({ background: 'rgb(17, 31, 53)', border: '1px',
      borderColor: 'rgb(38, 56, 82)', radius: '10px', padding: '12px', gap: '12px' });
    expect(geometry.heading.bottom).toBeLessThan(geometry.detail.y);
    expect(geometry.detail.bottom).toBeLessThan(geometry.actions.y);
    expect(geometry.connection.y).toBeCloseTo(geometry.heading.y, 0);
    if (wide) {
      const bounds = (await sidebar.boundingBox())!;
      expect(geometry.version.bottom).toBeCloseTo(bounds.y + bounds.height - 13, 0);
    } else expect(geometry.version.y - geometry.actions.bottom).toBeCloseTo(6, 0);
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

async function expectLobbyLayout(page: Page) {
  const size = page.viewportSize()!;
  const wide = size.width >= 1280 && size.width / size.height >= 4 / 3;
  await page.evaluate(() => scrollTo(0, 0));
  const layout = await page.locator('.connected-lobby--setup').evaluate((element) => {
    const bounds = (selector: string) => {
      const rect = element.querySelector(selector)!.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, bottom: rect.bottom, right: rect.right };
    };
    const panel = element.querySelector('.lobby-controls-panel')!;
    const style = getComputedStyle(panel);
    const buttons = Array.from(panel.querySelectorAll('.lobby-actions__button')).map((button) => {
      const rect = button.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom };
    });
    const controls = panel.querySelector('.lobby-actions, .lobby-waiting')!;
    return { header: bounds('.lobby-header'), board: bounds('.board-preview__canvas'),
      panel: bounds('.lobby-controls-panel'), display: style.display, background: style.backgroundColor,
      border: style.borderTopWidth, borderColor: style.borderTopColor, radius: style.borderRadius,
      padding: style.paddingTop, headerBackground: getComputedStyle(element.querySelector('.lobby-header')!).backgroundColor,
      divider: getComputedStyle(controls).borderTopWidth, buttons,
      roster: bounds('.lobby-roster'), lastBottom: panel.lastElementChild!.getBoundingClientRect().bottom,
      notice: panel.querySelector('.connected-lobby__notice') ? bounds('.lobby-controls-panel .connected-lobby__notice') : null };
  });
  const header = page.locator('.lobby-header');
  const sidebar = await header.evaluate((element) => {
    const bounds = (selector: string) => {
      const rect = element.querySelector(selector)!.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right };
    };
    const waiting = element.querySelector('.lobby-header__waiting')!;
    return { copy: bounds('.room-code__button'), more: bounds('.match-actions__toggle'),
      waiting: bounds('.lobby-header__waiting'), connection: bounds('.lobby-header__connection'),
      version: bounds('.lobby-header__version'), usersIcon: bounds('.lobby-header__users-icon'),
      dotColor: getComputedStyle(waiting, '::before').backgroundColor,
      dotContent: getComputedStyle(waiting, '::before').content };
  });
  const usersIcon = header.locator('.lobby-header__users-icon');
  const lobbyVersion = header.locator('.lobby-header__version');
  if (wide) {
    const panelGrowth = Math.max(0, Math.min(40, (size.width - size.height - 560) / 2));
    expect(layout.header.width).toBeCloseTo(220 + panelGrowth, 0);
    expect(layout.panel.width).toBeCloseTo(300 + panelGrowth, 0);
    expect(layout.board.y).toBeCloseTo(layout.header.y, 0);
    expect(layout.header.bottom).toBeCloseTo(layout.board.bottom, 0);
    expect(layout.panel.y).toBeCloseTo(layout.board.y, 0);
    expect(layout.panel.bottom).toBeCloseTo(layout.board.bottom, 0);
    expect(layout.roster.y).toBeCloseTo(layout.panel.y + 13, 0);
    expect(layout.lastBottom).toBeCloseTo(layout.panel.bottom - 13, 0);
    expect(layout.board.x - layout.header.right).toBeCloseTo(20, 0);
    expect(layout.panel.x - layout.board.right).toBeCloseTo(20, 0);
    expect(layout.header.x).toBeCloseTo(size.width - layout.panel.right, 0);
    expect(layout.board.bottom).toBeLessThanOrEqual(size.height);
    const expectedBoardSize = Math.min(size.height - 32, size.width - 32 - 560);
    expect(layout.board.width).toBeCloseTo(expectedBoardSize, 0);
    expect(layout.board.y).toBeCloseTo(16, 0);
    if (size.height - 32 <= size.width - 32 - 560) {
      expect(size.height - layout.board.bottom).toBeCloseTo(layout.board.y, 0);
    }
    expect(layout).toMatchObject({ display: 'flex', background: 'rgb(17, 31, 53)', border: '1px',
      borderColor: 'rgb(38, 56, 82)', radius: '10px', padding: '12px',
      headerBackground: 'rgb(17, 31, 53)', divider: '1px' });
    await expect(header.locator('h1')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(header.locator('.lobby-header__board')).toHaveCSS('margin-top', '4px');
    await expect(header.locator('.lobby-header__waiting')).toHaveCSS('color', 'rgb(168, 190, 216)');
    await expect(header.locator('.lobby-header__connection')).toHaveCSS('font-size', '12px');
    await expect(usersIcon).toBeVisible();
    await expect(lobbyVersion).toBeVisible();
    await expect(lobbyVersion).toHaveText(await page.locator('.app-version').innerText());
    await expect(lobbyVersion).toHaveCSS('font-size', '11px');
    await expect(lobbyVersion).toHaveCSS('color', 'rgb(112, 131, 155)');
    await expect(page.locator('.app-version')).toBeHidden();
    expect(sidebar.version.x).toBeCloseTo(layout.header.x + 13, 0);
    expect(sidebar.version.right).toBeLessThan(sidebar.usersIcon.x);
    expect(sidebar.version.y + sidebar.version.height / 2).toBeCloseTo(sidebar.connection.y + sidebar.connection.height / 2, 0);
    expect(sidebar.dotColor).toBe('rgb(77, 212, 160)');
    expect(sidebar.more.width).toBe(44); expect(sidebar.more.height).toBe(44);
    expect(sidebar.copy.y).toBe(sidebar.more.y);
    expect(sidebar.more.x - sidebar.copy.right).toBeCloseTo(8, 0);
    expect(sidebar.more.right).toBeCloseTo(layout.header.right - 13, 0);
    expect(sidebar.copy.x).toBeCloseTo(layout.header.x + 13, 0);
    expect(sidebar.connection.y).toBeGreaterThan(sidebar.waiting.y);
    expect(sidebar.waiting.y - sidebar.copy.y - sidebar.copy.height).toBeCloseTo(12, 0);
    expect(sidebar.connection.y + sidebar.connection.height).toBeCloseTo(layout.header.bottom - 13, 0);
    expect(sidebar.connection.right).toBeCloseTo(sidebar.more.right, 0);
    if (layout.buttons.length) {
      const [shuffle, start] = layout.buttons;
      expect(start.y - shuffle.bottom).toBeCloseTo(8, 0);
      expect(shuffle.x).toBe(start.x);
      expect(shuffle.width).toBe(layout.panel.width - 26);
      expect(start.width).toBe(shuffle.width);
      expect(shuffle.height).toBe(48); expect(start.height).toBe(48);
      if (layout.notice) expect(layout.notice.y - start.bottom).toBeCloseTo(12, 0);
    }
  } else {
    await expect(usersIcon).toBeHidden();
    await expect(lobbyVersion).toBeHidden();
    await expect(page.locator('.app-version')).toBeVisible();
    expect(sidebar.dotContent).toBe('none');
    expect(sidebar.waiting.y).toBeCloseTo(sidebar.connection.y, 0);
    expect(layout.display).toBe('contents');
    expect(layout.header.bottom).toBeLessThanOrEqual(layout.board.y);
    if (layout.buttons.length) {
      expect(layout.buttons[0].y).toBe(layout.buttons[1].y);
      expect(layout.buttons[0].y).toBeGreaterThanOrEqual(layout.board.bottom);
    }
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
    const size = page.viewportSize()!;
    const growth = Math.max(0, Math.min(40, (size.width - size.height - 560) / 2));
    expect(geometry.sidebar.width).toBeCloseTo(220 + growth, 0);
    expect(geometry.panels.width).toBeCloseTo(300 + growth, 0);
    expect(geometry.board.width).toBeCloseTo(Math.min(size.height - 32, size.width - 592), 0);
    expect(geometry.board.x - geometry.sidebar.right).toBeCloseTo(20, 0);
    expect(geometry.panels.x - geometry.board.right).toBeCloseTo(20, 0);
    expect(geometry.sidebar.y).toBeCloseTo(geometry.board.y, 0);
    expect(geometry.panels.y).toBeCloseTo(geometry.board.y, 0);
    expect(geometry.sidebar.bottom).toBeCloseTo(geometry.board.bottom, 0);
    expect(geometry.panels.bottom).toBeCloseTo(geometry.board.bottom, 0);
    expect(geometry.sidebar.x).toBeCloseTo(size.width - geometry.panels.right, 0);
    expect(geometry.sidebar.y + geometry.scrollY).toBeCloseTo(16, 0);
  } else {
    expect(geometry.panelDisplay).toBe('contents');
    expect(geometry.board.y).toBeGreaterThanOrEqual(geometry.sidebar.bottom);
    expect(geometry.firstPanel.y).toBeGreaterThanOrEqual(geometry.board.bottom);
  }
  expect(geometry.board.width).toBeCloseTo(geometry.board.height, 0);
  const marker = page.locator('.game-board__target-highlight');
  await expect(marker).toHaveCount(1);
  await expect(page.locator('.game-board__target--active .game-board__target-highlight')).toHaveCount(1);
  const bracket = await marker.evaluate((element) => {
    const path = element as SVGPathElement;
    const box = path.getBBox();
    const style = getComputedStyle(path);
    return { tag: path.tagName, fill: style.fill, color: style.stroke, stroke: parseFloat(style.strokeWidth),
      x: box.x, y: box.y, width: box.width, height: box.height, length: path.getTotalLength(),
      scale: path.getScreenCTM()!.a, animation: style.animationName };
  });
  expect(bracket).toMatchObject({ tag: 'path', fill: 'none', color: 'rgb(184, 204, 227)', animation: 'none' });
  expect(bracket.length).toBeCloseTo(1.6, 2);
  expect(bracket.x - bracket.stroke / 2).toBeGreaterThan(-0.5);
  expect(bracket.y - bracket.stroke / 2).toBeGreaterThan(-0.5);
  expect(bracket.x + bracket.width + bracket.stroke / 2).toBeLessThan(0.5);
  expect(bracket.y + bracket.height + bracket.stroke / 2).toBeLessThan(0.5);
  expect(bracket.stroke * bracket.scale).toBeCloseTo(geometry.board.width / 16 / 24, 1);
  await expect(page.locator('.game-board__surface')).toHaveCSS('fill', 'rgb(17, 31, 53)');
  const blocked = page.locator('.game-board__blocked-area');
  await expect(blocked).toHaveCount(1);
  const blockedStyle = await blocked.evaluate((element) => {
    const rect = element as SVGRectElement;
    const pattern = rect.ownerSVGElement!.querySelector('pattern')!;
    const stripe = pattern.querySelector('path')!;
    const style = getComputedStyle(rect);
    const box = rect.getBBox();
    return { x: box.x, y: box.y, width: box.width, height: box.height,
      color: style.stroke, stroke: parseFloat(style.strokeWidth), scale: rect.getScreenCTM()!.a,
      stripeColor: getComputedStyle(stripe).stroke, stripeWidth: parseFloat(getComputedStyle(stripe).strokeWidth),
      spacing: pattern.width.baseVal.value, rotation: pattern.getAttribute('patternTransform'),
      fill: rect.getAttribute('fill'), patternId: pattern.id };
  });
  expect(blockedStyle).toMatchObject({ x: 7, y: 7, width: 2, height: 2,
    color: 'rgb(58, 82, 114)', stripeColor: 'rgb(58, 82, 114)', rotation: 'rotate(45)' });
  expect(blockedStyle.fill).toBe(`url(#${blockedStyle.patternId})`);
  const cellSize = geometry.board.width / 16;
  expect(blockedStyle.stroke * blockedStyle.scale).toBeCloseTo(cellSize * 1.5 / 48, 2);
  expect(blockedStyle.stripeWidth * blockedStyle.scale).toBeCloseTo(cellSize * 1.25 / 48, 2);
  expect(blockedStyle.spacing * blockedStyle.scale).toBeCloseTo(cellSize * 10 / 48, 2);
  await expect(page.locator('.game-board__blocked-cell')).toHaveCSS('fill', 'rgb(8, 15, 31)');
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
  const lobbySizes = [...layoutSizes, { width: 1279, height: 800 }, { width: 1280, height: 1200 },
    { width: 1280, height: 400 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }];
  for (const size of lobbySizes) {
    await page.setViewportSize(size); await expectMobileLayout(page); await expectLobbyLayout(page);
    await expect(page.getByRole('button', { name: 'Start Match', exact: true })).toBeDisabled();
    await expect(page.getByText('At least two players are needed to start.', { exact: true })).toHaveCSS('text-align', 'center');
  }
  await guestPage.goto(`/room/${code}`);
  await guestPage.getByLabel('YOUR NICKNAME').fill('Alex');
  await guestPage.getByRole('button', { name: 'Join Room', exact: true }).click();
  await expect(guestPage.getByRole('heading', { name: 'Match setup', exact: true })).toBeVisible();
  await expect(page.locator('.lobby-roster__heading')).toContainText('2 / 6');
  await expect(page.getByRole('button', { name: 'Start Match', exact: true })).toBeEnabled();
  await guestPage.setViewportSize({ width: 1366, height: 768 });
  await expectLobbyLayout(guestPage);
  await expect(guestPage.getByRole('button', { name: 'Start Match', exact: true })).toHaveCount(0);
  await expect(guestPage.getByText('Waiting for Maria to start the match.', { exact: true })).toBeVisible();
  for (const size of lobbySizes) {
    await page.setViewportSize(size); await expectMobileLayout(page); await expectLobbyLayout(page);
    await page.getByRole('button', { name: 'More actions', exact: true }).click();
    const menu = (await page.locator('.match-actions__panel').boundingBox())!;
    expect(menu.x).toBeGreaterThanOrEqual(0); expect(menu.x + menu.width).toBeLessThanOrEqual(size.width);
    await page.keyboard.press('Escape');
  }
  await page.screenshot({ path: info.outputPath('desktop-lobby-panels.png') });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: `Copy room code ${code}` }).click();
  await expect(page.getByText('Room code copied.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath('mobile-lobby-panels.png') });
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
    if (size.width === 390 && size.height === 844) await page.screenshot({ path: info.outputPath('mobile-target-brackets.png') });
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
