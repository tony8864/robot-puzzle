import { env, runInDurableObject } from 'cloudflare:test';
import { expect, test } from 'vitest';
import { createMatch, prepareMatchRound } from '@robot-puzzle/match';
import { starterBoard } from '@robot-puzzle/puzzles';
import { RECOMMENDED_ROUND_SETUP_BUDGET } from '@robot-puzzle/puzzles/round-setup';
import { projectLobbyState, type RoomRequest } from '@robot-puzzle/shared';
import { executeLobbyCommand, expireBidding, storedRoom } from '../src/lobbyCommands';
import { projectStoredMatch } from '../src/storedMatch';
import type { StoredRoom } from '../src/roomMembership';
import { biddingWindowMs } from '../src/biddingPolicy';

test('local bidding policy defaults to 60 seconds and production ignores overrides', () => {
  expect(biddingWindowMs({ APP_ENV: 'local' })).toBe(60000);
  expect(biddingWindowMs({ APP_ENV: 'local', LOCAL_BIDDING_WINDOW_SECONDS: '' })).toBe(60000);
  expect(biddingWindowMs({ APP_ENV: 'local', LOCAL_BIDDING_WINDOW_SECONDS: '3' })).toBe(3000);
  for (const value of ['3', 'invalid', 3]) {
    expect(biddingWindowMs({ APP_ENV: 'production', LOCAL_BIDDING_WINDOW_SECONDS: value })).toBe(60000);
  }
  for (const value of ['0', '-1', '61', '1.5', 'abc', 3]) {
    expect(() => biddingWindowMs({ APP_ENV: 'local', LOCAL_BIDDING_WINDOW_SECONDS: value })).toThrow();
  }
});

test('local three-second deadline persists across revisions/retries and rejects bids at expiry', async () => {
  await inRoom((storage, room) => {
    const first = request(room, 7);
    const run = (input: RoomRequest, now: number, seconds = '3') => executeLobbyCommand(storage,
      'session-0', room.state.players[0].seatId, input, undefined, undefined, () => now,
      { APP_ENV: 'local', LOCAL_BIDDING_WINDOW_SECONDS: seconds })!;
    expect(run(first, 1000).outcome.status).toBe('accepted');
    expect(storedRoom(storage)!.match!.state).toMatchObject({ phase: 'bidding', deadlineAtMs: 4000 });
    expect(run(request(room, 6), 3999, '10').outcome.status).toBe('accepted');
    expect(run(first, 3999).duplicate).toBe(true);
    expect(storedRoom(storage)!.match!.state).toMatchObject({ phase: 'bidding', deadlineAtMs: 4000 });
    expect(run(request(room, 5), 4000).outcome).toEqual({ status: 'rejected', reason: 'bidding-closed' });
    expect(storedRoom(storage)!.match!.state.phase).toBe('demonstrating');
  });
});

test('production first bid stays at 60 seconds even with a local override supplied', async () => {
  await inRoom((storage, room) => {
    executeLobbyCommand(storage, 'session-0', room.state.players[0].seatId, request(room, 3),
      undefined, undefined, () => 1000, { APP_ENV: 'production', LOCAL_BIDDING_WINDOW_SECONDS: '3' });
    expect(storedRoom(storage)!.match!.state).toMatchObject({ phase: 'bidding', deadlineAtMs: 61000 });
  });
});

async function inRoom(work: (storage: DurableObjectStorage, room: StoredRoom) => void, count = 2) {
  await runInDurableObject(env.ROOMS.get(env.ROOMS.idFromName(crypto.randomUUID())), (_instance, ctx) => {
    const players = Array.from({ length: count }, (_, i) => ({ seatId: crypto.randomUUID(), nickname: `Player ${i}`, connected: false }));
    const lobby = projectLobbyState({ roomId: crypto.randomUUID(), roomCode: 'ABC234', revision: 1, hostSeatId: players[0].seatId,
      lobbyId: crypto.randomUUID(), puzzle: starterBoard, players });
    if (!lobby.ok) throw new Error('Expected lobby');
    const initial = createMatch({ matchId: crypto.randomUUID(), players, puzzle: starterBoard });
    const state = prepareMatchRound(initial, { candidateOrder: starterBoard.targets.map((t) => t.id), budget: RECOMMENDED_ROUND_SETUP_BUDGET }).state;
    if (state.phase !== 'thinking') throw new Error('Expected verified Thinking');
    const match = { version: 2 as const, state };
    const room: StoredRoom = { initialization: '{}', members: Object.fromEntries(players.map((p, i) => [`session-${i}`, p.seatId])),
      state: projectStoredMatch(lobby.value, match), match };
    ctx.storage.sql.exec('INSERT INTO room_state VALUES (1, ?)', JSON.stringify(room));
    work(ctx.storage, room);
  });
}
function request(room: StoredRoom, value: number, commandId = crypto.randomUUID()): Extract<RoomRequest, { command: { type: 'bid.submit' } }> {
  return { version: 2, roomId: room.state.roomId, commandId, context: { matchId: room.match!.state.matchId, roundNumber: 1 }, command: { type: 'bid.submit', value } };
}
function execute(storage: DurableObjectStorage, room: StoredRoom, seat: number, input: RoomRequest, now = 1000) {
  return executeLobbyCommand(storage, `session-${seat}`, room.state.players[seat].seatId, input, undefined, undefined, () => now)!;
}

function earlyEnd(room: StoredRoom, requestId?: string): Extract<RoomRequest, { command: { type: 'bidding.requestEnd' | 'bidding.cancelEnd' } }> {
  const base = { version: 2 as const, roomId: room.state.roomId, commandId: crypto.randomUUID(),
    context: { matchId: room.match!.state.matchId, roundNumber: 1 as const } };
  return requestId ? { ...base, command: { type: 'bidding.cancelEnd', requestId } } : { ...base, command: { type: 'bidding.requestEnd' } };
}
function pendingEarlyEnd(storage: DurableObjectStorage) {
  const state = storedRoom(storage)!.state;
  return state.status === 'playing' && state.match.phase === 'bidding' ? state.match.earlyEndRequest : undefined;
}

test('only the host can create/cancel a durable request during the current bidding window; exact retries are safe', async () => {
  await inRoom((storage, room) => {
    expect(execute(storage, room, 0, earlyEnd(room)).outcome).toEqual({ status: 'rejected', reason: 'wrong-phase' });
    execute(storage, room, 1, request(room, 7)); // Host need not have bid.
    const before = storedRoom(storage)!;
    expect(execute(storage, room, 1, earlyEnd(room)).outcome).toEqual({ status: 'rejected', reason: 'not-host' });
    const input = earlyEnd(room);
    expect(execute(storage, room, 0, { ...input, commandId: crypto.randomUUID(), context: { matchId: crypto.randomUUID(), roundNumber: 1 } }).outcome)
      .toEqual({ status: 'rejected', reason: 'stale-context' });
    const created = execute(storage, room, 0, input);
    expect(created.outcome.status).toBe('accepted');
    const pending = storedRoom(storage)!; // Reload persisted JSON through restore validation.
    expect(pendingEarlyEnd(storage)).toEqual({ requestId: input.commandId, requestedBySeatId: room.state.hostSeatId, agreedSeatIds: [room.state.hostSeatId] });
    expect(pending.match).toEqual(before.match);
    expect(pending.state.revision).toBe(before.state.revision + 1);
    expect(projectStoredMatch(pending.state, pending.match!)).toEqual(pending.state);
    expect(execute(storage, room, 0, input)).toMatchObject({ duplicate: true, changed: false, processedRevision: created.processedRevision });
    expect(execute(storage, room, 0, earlyEnd(room)).outcome).toEqual({ status: 'rejected', reason: 'stale-context' });
    expect(execute(storage, room, 1, earlyEnd(room, input.commandId)).outcome).toEqual({ status: 'rejected', reason: 'not-host' });
    expect(execute(storage, room, 0, earlyEnd(room, crypto.randomUUID())).outcome).toEqual({ status: 'rejected', reason: 'stale-context' });
    const cancel = earlyEnd(room, input.commandId);
    expect(execute(storage, room, 0, cancel).outcome.status).toBe('accepted');
    expect(pendingEarlyEnd(storage)).toBeUndefined();
    const replacement = earlyEnd(room);
    execute(storage, room, 0, replacement);
    expect(execute(storage, room, 0, cancel).duplicate).toBe(true);
    expect(execute(storage, room, 0, earlyEnd(room, input.commandId)).outcome).toEqual({ status: 'rejected', reason: 'stale-context' });
    expect(pendingEarlyEnd(storage)?.requestId).toBe(replacement.commandId);
    expect(storedRoom(storage)!.match).toEqual(before.match);
  });
});

test.each(['increase', 'reduction', 'new-bid'] as const)('%s clears the request; identical bids and exact retries preserve it', async (kind) => {
  await inRoom((storage, room) => {
    const bid = request(room, 7);
    execute(storage, room, 0, bid);
    const input = earlyEnd(room);
    execute(storage, room, 0, input);
    expect(execute(storage, room, 0, request(room, 7)).outcome.status).toBe('no-op');
    expect(execute(storage, room, 0, bid).duplicate).toBe(true);
    expect(pendingEarlyEnd(storage)?.requestId).toBe(input.commandId);
    expect(execute(storage, room, kind === 'new-bid' ? 1 : 0, request(room, kind === 'reduction' ? 6 : 8)).outcome.status).toBe('accepted');
    expect(pendingEarlyEnd(storage)).toBeUndefined();
    expect(storedRoom(storage)!.match!.state).toMatchObject({ phase: 'bidding', deadlineAtMs: 61000 });
  });
});

test('a pending request never ends bidding early and disappears at the original deadline, including a late command', async () => {
  await inRoom((storage, room) => {
    execute(storage, room, 0, request(room, 7));
    const input = earlyEnd(room);
    execute(storage, room, 0, input);
    expect(expireBidding(storage, 60999)).toBe(false);
    expect(pendingEarlyEnd(storage)?.requestId).toBe(input.commandId);
    expect(execute(storage, room, 0, earlyEnd(room, input.commandId), 61000).outcome).toEqual({ status: 'rejected', reason: 'wrong-phase' });
    expect(pendingEarlyEnd(storage)).toBeUndefined();
    expect(storedRoom(storage)!.match!.state.phase).toBe('demonstrating');
    expect(execute(storage, room, 0, input, 61001).duplicate).toBe(true);
    expect(pendingEarlyEnd(storage)).toBeUndefined();
  });
});

test('failed receipt insertion rolls back request creation atomically', async () => {
  await inRoom((storage, room) => {
    execute(storage, room, 0, request(room, 7));
    const before = storedRoom(storage)!;
    const input = earlyEnd(room);
    storage.sql.exec("CREATE TRIGGER fail_early_end BEFORE INSERT ON membership_replays BEGIN SELECT RAISE(ABORT, 'injected'); END");
    try { expect(() => execute(storage, room, 0, input)).toThrow(); }
    finally { storage.sql.exec('DROP TRIGGER fail_early_end'); }
    expect(storedRoom(storage)).toEqual(before);
    expect(execute(storage, room, 0, input).outcome.status).toBe('accepted');
  });
});

function voteEnd(room: StoredRoom, requestId: string, agree = true): Extract<RoomRequest, { command: { type: 'bidding.voteEnd' } }> {
  return { version: 2, roomId: room.state.roomId, commandId: crypto.randomUUID(),
    context: { matchId: room.match!.state.matchId, roundNumber: 1 }, command: { type: 'bidding.voteEnd', requestId, agree } };
}

test.each([2, 3, 6])('%i seated players must all agree, including offline non-bidders, before one immediate demonstration', async (count) => {
  await inRoom((storage, room) => {
    execute(storage, room, 1, request(room, 7));
    const input = earlyEnd(room); execute(storage, room, 0, input);
    const deadline = storedRoom(storage)!.match!.state;
    expect(deadline).toMatchObject({ phase: 'bidding', deadlineAtMs: 61000 });
    for (let i = 1; i < count; i++) {
      const vote = voteEnd(room, input.commandId);
      expect(execute(storage, room, i, vote, 2000 + i).outcome.status).toBe('accepted');
      const after = storedRoom(storage)!;
      expect(execute(storage, room, i, vote, 2000 + i)).toMatchObject({ duplicate: true, changed: false });
      expect(storedRoom(storage)).toEqual(after);
      if (i < count - 1) {
        expect(pendingEarlyEnd(storage)?.agreedSeatIds).toEqual(room.state.players.slice(0, i + 1).map((p) => p.seatId));
        expect(after.match!.state).toEqual(deadline);
        expect(projectStoredMatch(after.state, after.match!)).toEqual(after.state);
        expect(execute(storage, room, i, voteEnd(room, input.commandId)).outcome).toEqual({ status: 'rejected', reason: 'stale-context' });
        expect(execute(storage, room, i, voteEnd(room, input.commandId, false)).outcome).toEqual({ status: 'rejected', reason: 'stale-context' });
      } else {
        expect(after.match!.state).toMatchObject({ phase: 'demonstrating', activeBidderIndex: 0 });
        expect(after.match!.state.officialRobots).toEqual(room.match!.state.officialRobots);
        expect(after.match!.state.scores).toEqual(room.match!.state.scores);
        expect(after.attemptPresence).toMatchObject({ startedAtMs: 2000 + i, disconnect: { disconnectedAtMs: 2000 + i, skipAllowedAtMs: 62000 + i } });
        expect(pendingEarlyEnd(storage)).toBeUndefined();
      }
    }
  }, count);
});

test('decline cancels every agreement and enforces a durable 10-second cooldown without extending the timer', async () => {
  await inRoom((storage, room) => {
    execute(storage, room, 0, request(room, 7));
    const input = earlyEnd(room); execute(storage, room, 0, input);
    execute(storage, room, 1, voteEnd(room, input.commandId));
    const decline = voteEnd(room, input.commandId, false);
    expect(execute(storage, room, 2, decline, 2000).outcome.status).toBe('accepted');
    expect(pendingEarlyEnd(storage)).toBeUndefined();
    const after = storedRoom(storage)!;
    expect(after.state).toMatchObject({ match: { phase: 'bidding', deadlineAtMs: 61000, earlyEndAvailableAtMs: 12000 } });
    expect(execute(storage, room, 2, decline, 2001).duplicate).toBe(true);
    execute(storage, room, 0, request(room, 8), 3000); // Bid changes cannot bypass cooldown.
    expect(execute(storage, room, 0, earlyEnd(room), 11999).outcome).toEqual({ status: 'rejected', reason: 'bidding-request-cooldown' });
    const replacement = earlyEnd(room);
    expect(execute(storage, room, 0, replacement, 12000).outcome.status).toBe('accepted');
    expect(pendingEarlyEnd(storage)?.agreedSeatIds).toEqual([room.state.hostSeatId]);
    expect(execute(storage, room, 2, voteEnd(room, input.commandId), 12001).outcome).toEqual({ status: 'rejected', reason: 'stale-context' });
    expect(execute(storage, room, 2, decline, 12002).duplicate).toBe(true);
    expect(pendingEarlyEnd(storage)?.requestId).toBe(replacement.commandId);
  }, 3);
});

test('host, outsider, stale round/request and late votes cannot change the vote', async () => {
  await inRoom((storage, room) => {
    execute(storage, room, 0, request(room, 7));
    const input = earlyEnd(room); execute(storage, room, 0, input);
    const before = storedRoom(storage)!;
    expect(execute(storage, room, 0, voteEnd(room, input.commandId)).outcome.status).toBe('rejected');
    expect(() => executeLobbyCommand(storage, 'outsider', room.state.players[1].seatId, voteEnd(room, input.commandId))).toThrow();
    expect(execute(storage, room, 1, { ...voteEnd(room, input.commandId), context: { matchId: room.match!.state.matchId, roundNumber: 2 } }).outcome).toEqual({ status: 'rejected', reason: 'stale-context' });
    expect(execute(storage, room, 1, voteEnd(room, crypto.randomUUID())).outcome.status).toBe('rejected');
    expect(storedRoom(storage)).toEqual(before);
    expect(execute(storage, room, 1, voteEnd(room, input.commandId), 61000).outcome).toEqual({ status: 'rejected', reason: 'wrong-phase' });
    expect(storedRoom(storage)!.match!.state.phase).toBe('demonstrating');
  });
});

test.each(['cancel', 'bid', 'expiry'] as const)('%s invalidates in-flight votes, including replacement requests', async (kind) => {
  await inRoom((storage, room) => {
    execute(storage, room, 0, request(room, 7));
    const input = earlyEnd(room); execute(storage, room, 0, input);
    const vote = voteEnd(room, input.commandId);
    if (kind === 'cancel') execute(storage, room, 0, earlyEnd(room, input.commandId));
    else if (kind === 'bid') execute(storage, room, 0, request(room, 6));
    else expireBidding(storage, 61000);
    if (kind !== 'expiry') execute(storage, room, 0, earlyEnd(room));
    const before = storedRoom(storage)!;
    expect(execute(storage, room, 1, vote, kind === 'expiry' ? 61000 : 2000).outcome.status).toBe('rejected');
    expect(storedRoom(storage)).toEqual(before);
  });
});

test.each([true, false])('vote agree=%s rolls back with its receipt, including a final transition or cooldown', async (agree) => {
  await inRoom((storage, room) => {
    execute(storage, room, 0, request(room, 7));
    const input = earlyEnd(room); execute(storage, room, 0, input);
    const before = storedRoom(storage)!;
    const vote = voteEnd(room, input.commandId, agree);
    storage.sql.exec("CREATE TRIGGER fail_vote BEFORE INSERT ON membership_replays BEGIN SELECT RAISE(ABORT, 'injected'); END");
    try { expect(() => execute(storage, room, 1, vote, 2000)).toThrow(); }
    finally { storage.sql.exec('DROP TRIGGER fail_vote'); }
    expect(storedRoom(storage)).toEqual(before);
    expect(execute(storage, room, 1, vote, 2000).outcome.status).toBe('accepted');
  });
});

test.each([2, 6])('%i players bid independently; reductions preserve first priority and the one deadline', async (count) => {
  await inRoom((storage, room) => {
    const first = request(room, 7);
    expect(execute(storage, room, 0, first).outcome.status).toBe('accepted');
    for (let i = 1; i < count; i++) expect(execute(storage, room, i, request(room, 7 + i), 1000).outcome.status).toBe('accepted');
    expect(execute(storage, room, 0, request(room, 7), 2000).outcome).toEqual({ status: 'no-op', reason: 'same-bid' });
    const increase = request(room, 8);
    expect(execute(storage, room, 0, increase, 2000).outcome.status).toBe('accepted');
    expect(execute(storage, room, 0, increase, 2001).duplicate).toBe(true);
    expect(execute(storage, room, 1, request(room, 5), 3000).outcome.status).toBe('accepted');
    expect(execute(storage, room, 0, request(room, 5), 4000).outcome.status).toBe('accepted');
    const bidding = storedRoom(storage)!;
    expect(bidding.match).toMatchObject({ version: 3, state: { phase: 'bidding', deadlineAtMs: 61000 } });
    expect(expireBidding(storage, 60999)).toBe(false);
    expect(expireBidding(storage, 61000)).toBe(true);
    const demo = storedRoom(storage)!;
    if (demo.match?.state.phase !== 'demonstrating') throw new Error('Expected demonstration');
    expect(demo.match.state.bidderQueue.map((b) => b.seatId)).toEqual([
      room.state.players[1].seatId, room.state.players[0].seatId,
      ...room.state.players.slice(2).map((p) => p.seatId),
    ]);
    expect(demo.match.state.attempt.robots).toEqual(room.match!.state.officialRobots);
    expect(demo.match.state.attempt.moves).toEqual([]);
    expect(demo.match.state.scores).toEqual(room.match!.state.scores);
    expect(expireBidding(storage, 99999)).toBe(false);
    expect(storedRoom(storage)).toEqual(demo);
  }, count);
});

test.each([61000, 61001])('bid at %i is rejected while overdue expiry is durably retained', async (now) => {
  await inRoom((storage, room) => {
    execute(storage, room, 0, request(room, 4));
    const result = execute(storage, room, 1, request(room, 3), now);
    expect(result.outcome).toEqual({ status: 'rejected', reason: 'bidding-closed' });
    expect(result.changed).toBe(true);
    const after = storedRoom(storage)!;
    expect(after.match!.state.phase).toBe('demonstrating');
    expect(after.state.revision).toBe(result.processedRevision);
  });
});

test('last-millisecond bid is accepted; duplicate old bid at expiry returns original outcome without resetting time', async () => {
  await inRoom((storage, room) => {
    const first = request(room, 7);
    const original = execute(storage, room, 0, first);
    expect(execute(storage, room, 1, request(room, 3), 60999).outcome.status).toBe('accepted');
    expect(execute(storage, room, 0, first, 61000)).toMatchObject({ duplicate: true, changed: true,
      outcome: original.outcome, processedRevision: original.processedRevision });
    const after = storedRoom(storage)!;
    expect(execute(storage, room, 0, first, 61001).duplicate).toBe(true);
    expect(storedRoom(storage)).toEqual(after);
    expect(execute(storage, room, 0, { ...first, command: { type: 'bid.submit', value: 1 } }, 61002).outcome)
      .toEqual({ status: 'rejected', reason: 'command-id-conflict' });
  });
});

test('stale round/seat inputs cannot bid; a rejected contextual action still commits due expiry', async () => {
  await inRoom((storage, room) => {
    const stale: RoomRequest = { ...request(room, 4), context: { matchId: crypto.randomUUID(), roundNumber: 1 } };
    expect(execute(storage, room, 0, stale).outcome).toEqual({ status: 'rejected', reason: 'stale-context' });
    expect(() => executeLobbyCommand(storage, 'outsider', room.state.hostSeatId, request(room, 1))).toThrow();
    execute(storage, room, 0, request(room, 4));
    expect(execute(storage, room, 1, { ...stale, commandId: crypto.randomUUID() }, 61000).outcome)
      .toEqual({ status: 'rejected', reason: 'stale-context' });
    expect(storedRoom(storage)!.match!.state.phase).toBe('demonstrating');
  });
});

test('failed replay insertion rolls back bid/deadline/revision; same request can then succeed once', async () => {
  await inRoom((storage, room) => {
    const input = request(room, 6);
    storage.sql.exec("CREATE TRIGGER fail_bid BEFORE INSERT ON membership_replays BEGIN SELECT RAISE(ABORT, 'injected'); END");
    try { expect(() => execute(storage, room, 0, input)).toThrow(); }
    finally { storage.sql.exec('DROP TRIGGER fail_bid'); }
    expect(storedRoom(storage)).toEqual(room);
    expect(execute(storage, room, 0, input).outcome.status).toBe('accepted');
    expect(execute(storage, room, 0, input).duplicate).toBe(true);
  });
});

test('a state read normalizes a missed deadline without waiting for the alarm or changing an attempt twice', async () => {
  await inRoom((storage, room) => {
    execute(storage, room, 0, request(room, 6));
    const read: RoomRequest = { version: 2, commandId: crypto.randomUUID(), roomId: room.state.roomId, context: {}, command: { type: 'state.request' } };
    expect(execute(storage, room, 0, read, 61000)).toMatchObject({ changed: true, outcome: { status: 'no-op', reason: 'snapshot-requested' } });
    const after = storedRoom(storage)!;
    expect(after.match!.state.phase).toBe('demonstrating');
    expect(execute(storage, room, 0, read, 62000).duplicate).toBe(true);
    expect(storedRoom(storage)).toEqual(after);
  });
});

test.each(['deadline', 'bid-order', 'attempt-id', 'history', 'extra'] as const)('corrupt %s private bidding/attempt data fails closed', async (kind) => {
  await inRoom((storage, room) => {
    execute(storage, room, 0, request(room, 6));
    if (kind !== 'deadline' && kind !== 'bid-order') expireBidding(storage, 61000);
    const original = storage.sql.exec<{ value: string }>('SELECT value FROM room_state').one().value;
    const bad = JSON.parse(original);
    if (kind === 'deadline') bad.match.state.deadlineAtMs++;
    if (kind === 'bid-order') bad.match.state.bids[0].firstAcceptedOrder++;
    if (kind === 'attempt-id') bad.match.attempt.id = crypto.randomUUID();
    if (kind === 'history') bad.match.state.attempt.moves.push({ robotId: 'red', direction: 'right' });
    if (kind === 'extra') bad.match.internalProof = [];
    storage.sql.exec('UPDATE room_state SET value = ?', JSON.stringify(bad));
    expect(() => storedRoom(storage)).toThrow();
    storage.sql.exec('UPDATE room_state SET value = ?', original);
    expect(storedRoom(storage)).toBeTruthy();
  });
});
