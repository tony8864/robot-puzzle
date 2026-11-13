import { test, expect } from '../support/fixtures';
import { createRoom, observeRooms } from '../support/lobby';
import { placeBid } from '../support/gameplay';
import { advanceServer, recoveryTransport } from '../support/recovery';

test.use({ controlledTime: true, environmentKey: 'bid-revisions' });

test('increases reset tie priority; reductions, reconnect and deadline preserve accepted state', async ({ page, guestPage, environment }) => {
  const hostRoom = observeRooms(page);
  const host = await recoveryTransport(page);
  const guest = await recoveryTransport(guestPage);
  const code = await createRoom(page, 'Maria');
  await guestPage.goto(`/room/${code}`);
  await guestPage.getByLabel('YOUR NICKNAME').fill('Alex');
  await guestPage.getByRole('button', { name: 'Join Room', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start Match', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Start Match', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thinking', exact: true })).toBeVisible();
  await placeBid(page, 3);
  const first = hostRoom()!;
  if (first.status !== 'playing' || first.match.phase !== 'bidding') throw new Error('Expected bidding');
  const deadline = first.match.deadlineAtMs;
  await placeBid(guestPage, 6);
  await placeBid(page, 6);
  for (const player of [page, guestPage]) {
    await expect(player.getByRole('list', { name: 'Player bids list' }).getByRole('listitem').first()).toContainText('Alex');
  }
  await placeBid(page, 5);
  await expect(page.getByRole('list', { name: 'Player bids list' }).getByRole('listitem').first()).toContainText('Maria');
  await placeBid(page, 6);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bidding', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Increase bid', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Place Bid', exact: true })).toBeDisabled();
  await expect(page.getByRole('list', { name: 'Player bids list' }).getByRole('listitem').first()).toContainText('Alex');
  const revised = hostRoom()!;
  if (revised.status !== 'playing' || revised.match.phase !== 'bidding') throw new Error('Expected bidding after reconnect');
  expect(revised.match.deadlineAtMs).toBe(deadline);
  await advanceServer(environment, revised.roomId, deadline, [host, guest]);
  await expect(guestPage.getByRole('region', { name: 'Demonstration controls' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Demonstration controls' })).toHaveCount(0);
  for (const player of [page, guestPage]) await expect(player.getByRole('button', { name: 'Place Bid', exact: true })).toHaveCount(0);
});
