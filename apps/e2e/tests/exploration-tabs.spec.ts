import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { test, expect } from '@playwright/test';

// Isolated component harness only: no fake Exploration phase in the application.
let script: string;
let styles: string;
test.beforeAll(async () => {
  const root = fileURLToPath(new URL('../../web/', import.meta.url));
  styles = await readFile(new URL('../../web/src/styles.css', import.meta.url), 'utf8');
  styles += '\n.exploration-preview-frame { display: flex; flex-direction: column; width: 100%; }\n@media (min-width: 1280px) and (min-aspect-ratio: 4 / 3) { .exploration-preview-frame { width: 320px; height: 660px; } }';
  const bundle = await build({ bundle: true, write: false, format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    stdin: { resolveDir: root, loader: 'tsx', contents: `
      import { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { ExplorationTabs } from './src/components/ExplorationTabs';
      import { ExplorationManagePanel } from './src/components/ExplorationManagePanel';
      function Harness() {
        const [disabled, setDisabled] = useState(false);
        const [host, setHost] = useState(true);
        const [exploring, setExploring] = useState(true);
        const [session, setSession] = useState(1);
        const [controller, setController] = useState('host');
        const [busy, setBusy] = useState(false);
        const [action, setAction] = useState('none');
        const players = [
          { seatId: 'host', nickname: 'Maria', connected: true },
          { seatId: 'alex', nickname: 'Alex', connected: true },
          { seatId: 'teo', nickname: 'Teo', connected: false },
          { seatId: 'eli', nickname: 'AnExtraLongPlayerNickname', connected: true },
        ];
        return <>
          <button onClick={() => setDisabled(!disabled)}>Transfer control</button>
          <button onClick={() => setSession(session + 1)}>New exploration</button>
          <button onClick={() => setHost(!host)}>Toggle host</button>
          <button onClick={() => setExploring(!exploring)}>Toggle phase</button>
          <button onClick={() => setBusy(!busy)}>Toggle actions</button>
          <output aria-label="Last action">{action}</output>
          <div className="exploration-preview-frame">
          <ExplorationTabs isHost={host} isExploring={exploring} explorationKey={String(session)}
            exploreDisabled={disabled || controller !== 'host'} exploreContent={<p>Existing movement content</p>}
            manageContent={<ExplorationManagePanel isHost={host} players={players} currentSeatId="host"
              controllerSeatId={controller} disabled={busy}
              onAssignControl={(id) => { setController(id); setAction('assign:' + id); }}
              onResetBoard={() => setAction('reset')} onNextRound={() => setAction('next')} />} />
          </div>
        </>;
      }
      createRoot(document.getElementById('root')).render(<Harness />);
    ` } });
  script = bundle.outputFiles[0].text;
});

for (const width of [320, 1280]) test(`host exploration tabs at ${width}px switch locally and preserve selection through control changes`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 800 });
  await page.setContent('<div id="root"></div>');
  await page.addStyleTag({ content: styles });
  await page.addScriptTag({ content: script });
  const explore = page.getByRole('tab', { name: 'Explore', exact: true });
  const manage = page.getByRole('tab', { name: 'Manage', exact: true });
  const transfer = page.getByRole('button', { name: 'Transfer control', exact: true });
  await expect(explore).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveText('Existing movement content');
  const left = (await explore.boundingBox())!; const right = (await manage.boundingBox())!;
  expect(left.width).toBeCloseTo(right.width, 1); expect(left.height).toBe(44); expect(right.height).toBe(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(explore).toHaveCSS('background-color', 'rgb(33, 55, 84)');
  await manage.click();
  await expect(page.getByRole('tabpanel').getByRole('heading', { name: 'Board Control' })).toBeVisible();
  await transfer.click();
  await expect(explore).toBeVisible(); await expect(explore).toBeDisabled();
  await expect(manage).toHaveAttribute('aria-selected', 'true');
  await transfer.click();
  await expect(explore).toBeEnabled(); await expect(manage).toHaveAttribute('aria-selected', 'true');
  await manage.focus(); await page.keyboard.press('ArrowLeft');
  await expect(explore).toBeFocused(); await expect(explore).toHaveAttribute('aria-selected', 'true');
  await transfer.click();
  await expect(explore).toBeDisabled(); await expect(explore).toHaveAttribute('aria-selected', 'true');
  await manage.click(); await transfer.click();
  await page.getByRole('button', { name: 'New exploration', exact: true }).click();
  await expect(explore).toHaveAttribute('aria-selected', 'true');
  await page.screenshot({ path: info.outputPath(`exploration-tabs-${width}.png`) });
  for (const toggle of ['Toggle host', 'Toggle phase']) {
    await page.getByRole('button', { name: toggle, exact: true }).click();
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await page.getByRole('button', { name: toggle, exact: true }).click();
    await expect(explore).toHaveAttribute('aria-selected', 'true');
  }
});

for (const width of [320, 1280]) test(`Manage panel at ${width}px shows controller/presence and delegates host actions`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 800 });
  await page.setContent('<div id="root"></div>');
  await page.addStyleTag({ content: styles });
  await page.addScriptTag({ content: script });
  await page.getByRole('tab', { name: 'Manage', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Board Control', exact: true });
  const row = (name: string) => panel.getByRole('listitem').filter({ hasText: name });
  await expect(panel).toContainText('4 players');
  await expect(panel.getByRole('listitem')).toHaveCount(4);
  await expect(row('Maria')).toContainText('(you)');
  await expect(row('Maria')).toContainText('Has control');
  await expect(row('Teo')).toContainText('Offline');
  await expect(row('Teo').getByRole('button')).toHaveCount(0);
  await row('Alex').locator('.exploration-manage__name').click();
  await expect(page.getByLabel('Last action')).toHaveText('none'); // Rows themselves never assign control.
  await row('Alex').getByRole('button', { name: 'Give control to Alex' }).click();
  await expect(page.getByLabel('Last action')).toHaveText('assign:alex');
  await expect(row('Alex')).toContainText('Has control');
  await expect(row('Alex').getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Manage' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Explore' })).toBeDisabled();
  await row('Maria').getByRole('button', { name: 'Give control to Maria' }).click();
  await expect(page.getByRole('tab', { name: 'Explore' })).toBeEnabled();
  const reset = panel.getByRole('button', { name: 'Reset Board', exact: true });
  const next = panel.getByRole('button', { name: 'Next Round', exact: true });
  await reset.click(); await expect(page.getByLabel('Last action')).toHaveText('reset');
  await next.click(); await expect(page.getByLabel('Last action')).toHaveText('next');
  const geometry = await panel.evaluate((element) => {
    const actions = element.querySelector('.exploration-manage__actions')!.getBoundingClientRect();
    const roster = element.querySelector('ul')!.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const frame = document.querySelector('.exploration-preview-frame')!.getBoundingClientRect();
    const reset = element.querySelector('.exploration-manage__actions button')!.getBoundingClientRect();
    const next = element.querySelector('.exploration-manage__next')!.getBoundingClientRect();
    return { actionsBottom: actions.bottom, actionsTop: actions.top, rosterBottom: roster.bottom,
      panelBottom: box.bottom, frameBottom: frame.bottom, resetHeight: reset.height, nextHeight: next.height,
      resetWidth: reset.width, nextWidth: next.width, resetBottom: reset.bottom, nextTop: next.top,
      overflow: document.documentElement.scrollWidth > innerWidth };
  });
  expect(geometry.overflow).toBe(false);
  expect(geometry.resetHeight).toBe(48); expect(geometry.nextHeight).toBe(48);
  expect(geometry.resetWidth).toBeCloseTo(geometry.nextWidth, 1);
  expect(geometry.nextTop).toBeGreaterThanOrEqual(geometry.resetBottom);
  expect(geometry.actionsTop).toBeGreaterThanOrEqual(geometry.rosterBottom);
  if (width === 1280) {
    expect(geometry.panelBottom).toBeCloseTo(geometry.frameBottom, 1);
    expect(geometry.panelBottom - geometry.actionsBottom).toBeCloseTo(13, 1);
    expect(geometry.actionsTop - geometry.rosterBottom).toBeGreaterThan(50);
  }
  await page.screenshot({ path: info.outputPath(`exploration-manage-${width}.png`), fullPage: true });
  await page.getByRole('button', { name: 'Toggle actions' }).click();
  for (const button of await panel.getByRole('button').all()) await expect(button).toBeDisabled();
  await page.getByRole('button', { name: 'Toggle host' }).click();
  await expect(panel).toHaveCount(0);
});
