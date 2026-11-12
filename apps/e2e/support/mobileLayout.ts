import type { Page } from '@playwright/test';
import { expect } from './fixtures';

export const layoutSizes = [
  { width: 320, height: 568 }, { width: 375, height: 667 },
  { width: 390, height: 844 }, { width: 768, height: 1024 },
  { width: 1032, height: 1376 }, { width: 1280, height: 800 },
  { width: 390, height: 320 }, // Short viewport, not a claim of native keyboard emulation.
];

export async function expectMobileLayout(page: Page, board = true) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  if (board) {
    const bounds = await page.locator('.board-preview__canvas').boundingBox();
    expect(bounds).not.toBeNull();
    expect(Math.abs(bounds!.width - bounds!.height)).toBeLessThanOrEqual(1);
    expect(bounds!.x).toBeGreaterThanOrEqual(5);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width - 5 + 1);
    const size = page.viewportSize()!;
    const desktop = size.width >= 1024 && size.width / size.height >= 4 / 3;
    const columns = page.locator('.board-coordinates__columns');
    const rows = page.locator('.board-coordinates__rows');
    if (desktop) {
      await expect(columns).toBeVisible(); await expect(rows).toBeVisible();
      await expect(columns.locator('span')).toHaveText('ABCDEFGHIJKLMNOP'.split(''));
      await expect(rows.locator('span')).toHaveText(Array.from({ length: 16 }, (_, i) => String(i + 1)));
      const svg = (await page.locator('.game-board').boundingBox())!;
      expect(svg.width).toBeCloseTo(svg.height, 0);
      expect(svg.x - bounds!.x).toBeCloseTo(20, 0);
      expect(svg.y - bounds!.y).toBeCloseTo(20, 0);
      for (let i = 0; i < 16; i++) {
        const column = (await columns.locator('span').nth(i).boundingBox())!;
        const row = (await rows.locator('span').nth(i).boundingBox())!;
        expect(column.x + column.width / 2).toBeCloseTo(svg.x + (i + 0.5) * svg.width / 16, 0);
        expect(row.y + row.height / 2).toBeCloseTo(svg.y + (i + 0.5) * svg.height / 16, 0);
      }
    } else {
      await expect(columns).toBeHidden(); await expect(rows).toBeHidden();
      const svg = (await page.locator('.game-board').boundingBox())!;
      expect(svg.width).toBeCloseTo(bounds!.width, 0);
    }
  }
  const targets = await page.locator('button:visible, input:visible').evaluateAll((elements) => elements.map((element) => {
    const bounds = element.getBoundingClientRect();
    return { name: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? element.tagName,
      width: bounds.width, height: bounds.height };
  }));
  // SVG robot cells aren't HTML touch controls; dedicated selectors remain 44px.
  for (const target of targets) {
    expect(target.width, `${target.name} width`).toBeGreaterThanOrEqual(44 - 0.1);
    expect(target.height, `${target.name} height`).toBeGreaterThanOrEqual(44 - 0.1);
  }
}
