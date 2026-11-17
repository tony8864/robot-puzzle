import { expect, test } from 'vitest';
import { DIRECTIONS, ROBOT_IDS, isTargetComplete, moveRobot } from '@robot-puzzle/game-engine';
import { starterBoard } from '@robot-puzzle/puzzles';
import { prepareNextRound, RECOMMENDED_ROUND_SETUP_BUDGET } from '@robot-puzzle/puzzles/round-setup';
import { createMatch, prepareMatchRound, transitionMatch, type ExploringMatchState, type MatchState, type PlayerMatchCommand } from './index';

const context = { actorSeatId: 'host', hostSeatId: 'host', nowMs: 0 };
const options = { candidateOrder: starterBoard.targets.map((t) => t.id), budget: RECOMMENDED_ROUND_SETUP_BUDGET };
function act(state: MatchState, command: PlayerMatchCommand, actorSeatId = 'host') {
  return transitionMatch(state, { source: 'player', context: { ...context, actorSeatId }, command });
}
function fixture(): ExploringMatchState {
  let state = prepareMatchRound(createMatch({ matchId: 'explore', puzzle: starterBoard,
    players: [{ seatId: 'host', nickname: 'Host' }, { seatId: 'guest', nickname: 'Guest' }] }), options).state;
  state = act(state, { type: 'round.skip', confirmed: true }).state;
  state = act(state, { type: 'exploration.start' }).state;
  if (state.phase !== 'exploring') throw new Error('Expected Exploration');
  return state;
}
function step(state: ExploringMatchState): Extract<PlayerMatchCommand, { type: 'exploration.move' }> {
  for (const robotId of ROBOT_IDS) for (const direction of DIRECTIONS) {
    if (moveRobot(state.puzzle.board, state.robots, robotId, direction).moved) return { type: 'exploration.move', robotId, direction };
  }
  throw new Error('Expected legal movement');
}

test('unlimited exploration uses sliding geometry, never changes completed round data', () => {
  const original = fixture(); const before = JSON.stringify(original);
  let state = original;
  for (let i = 0; i < 150; i++) {
    const command = step(state);
    const expected = moveRobot(state.puzzle.board, state.robots, command.robotId, command.direction);
    const next = act(state, command);
    expect(next.outcome.status).toBe('accepted');
    if (next.state.phase !== 'exploring') throw new Error('Expected Exploration');
    state = next.state;
    expect(state.robots).toEqual(expected.robots);
    expect(state.exploration).toMatchObject({ version: i + 1, moves: expect.any(Array) });
    expect(state.exploration!.moves).toHaveLength(i + 1);
    expect(state.officialRobots).toBe(original.officialRobots);
    expect(state.scores).toBe(original.scores); expect(state.outcome).toBe(original.outcome);
  }
  expect(JSON.stringify(original)).toBe(before);
});

test('blocked moves are free, Undo reverses the last move, Reset clears all history without rewinding versions', () => {
  const original = fixture(); const command = step(original);
  const first = act(original, command).state as ExploringMatchState;
  expect(act(first, command)).toEqual({ state: first, outcome: { status: 'no-op', reason: 'blocked-move' } });
  const second = act(first, step(first)).state as ExploringMatchState;
  const undo = act(second, { type: 'exploration.undo' }).state as ExploringMatchState;
  expect(undo.robots).toEqual(first.robots); expect(undo.exploration!.version).toBe(3);
  const reset = act(undo, { type: 'exploration.reset' }).state as ExploringMatchState;
  expect(reset.robots).toEqual(original.round.startRobots);
  expect(reset.exploration).toEqual({ version: 4, moves: [] });
  expect(reset.controllerSeatId).toBe('host');
  expect(act(reset, { type: 'exploration.undo' }).outcome).toEqual({ status: 'no-op', reason: 'empty-undo' });
  expect(act(reset, { type: 'exploration.reset' }).outcome).toEqual({ status: 'no-op', reason: 'already-reset' });
});

test('reaching the target never scores or ends Exploration; moves can continue', () => {
  const original = fixture();
  const proof = prepareNextRound({ ...options, puzzle: original.puzzle, robots: original.robots, usedTargetIds: [],
    candidateOrder: [original.round.target.id, ...options.candidateOrder.filter((id) => id !== original.round.target.id)] });
  if (proof.status !== 'selected') throw new Error('Expected proof');
  let state = original;
  for (const move of proof.internalProof) state = act(state, { type: 'exploration.move', ...move }).state as ExploringMatchState;
  expect(isTargetComplete(state.robots, state.round.target)).toBe(true);
  expect(state.phase).toBe('exploring'); expect(state.scores).toEqual(original.scores);
  expect(act(state, step(state)).outcome.status).toBe('accepted');
  const advanced = transitionMatch(state, { source: 'controller', context: { nowMs: 0 }, command: { type: 'round.advance' } }).state;
  expect(advanced.officialRobots).toEqual(original.officialRobots);
});

test('guests and other phases reject Exploration actions, including invalid movement payloads', () => {
  const state = fixture();
  for (const command of [step(state), { type: 'exploration.undo' }, { type: 'exploration.reset' }] as const) {
    expect(act(state, command, 'guest').outcome).toEqual({ status: 'rejected', reason: 'not-controller' });
    expect(act({ ...state, phase: 'round-result' } as MatchState, command).outcome).toEqual({ status: 'rejected', reason: 'wrong-phase' });
  }
  expect(act(state, { type: 'exploration.move', robotId: 'invalid', direction: 'up' } as unknown as PlayerMatchCommand).outcome)
    .toEqual({ status: 'rejected', reason: 'invalid-command' });
});

test('host transfers control without changing positions/history; the new controller can undo previous moves', () => {
  const original = fixture();
  const moved = act(original, step(original)).state as ExploringMatchState;
  const command = { type: 'exploration.assignControl', seatId: 'guest' } as const;
  expect(act(moved, command, 'guest').outcome).toEqual({ status: 'rejected', reason: 'not-host' });
  expect(act(moved, { ...command, seatId: 'stranger' }).outcome).toEqual({ status: 'rejected', reason: 'unknown-player' });
  const transferred = act(moved, command).state as ExploringMatchState;
  expect(transferred.controllerSeatId).toBe('guest');
  expect(transferred.robots).toBe(moved.robots);
  expect(transferred.exploration).toEqual({ version: 2, moves: moved.exploration!.moves });
  expect(transferred.officialRobots).toBe(original.officialRobots);
  expect(transferred.scores).toBe(original.scores); expect(transferred.outcome).toBe(original.outcome);
  expect(act(transferred, step(transferred)).outcome).toEqual({ status: 'rejected', reason: 'not-controller' });
  const undone = act(transferred, { type: 'exploration.undo' }, 'guest').state as ExploringMatchState;
  expect(undone.robots).toEqual(original.robots);
  const guestMove = act(undone, step(undone), 'guest').state as ExploringMatchState;
  const reset = act(guestMove, { type: 'exploration.reset' }).state as ExploringMatchState;
  expect(reset.controllerSeatId).toBe('guest');
  expect(reset.robots).toEqual(original.robots); expect(reset.exploration!.moves).toEqual([]);
  const reclaimed = act(reset, { ...command, seatId: 'host' }).state as ExploringMatchState;
  expect(reclaimed.controllerSeatId).toBe('host'); expect(reclaimed.exploration!.version).toBe(6);
  expect(act(reclaimed, step(reclaimed), 'guest').outcome).toEqual({ status: 'rejected', reason: 'not-controller' });
});
