import { moveAttemptRobot, resetAttempt, undoAttempt } from '@robot-puzzle/game-engine';
import type { MatchTransitionResult, PlayerMatchCommand, PlayerMatchContext } from './commands';
import type { MatchState } from './model';
import { accepted, noOp, rejected } from './results';

type ExplorationCommand = Extract<PlayerMatchCommand, { type: 'exploration.move' | 'exploration.undo' | 'exploration.reset' | 'exploration.assignControl' }>;

/** Reuse movement/history without demonstration limits, target completion or scoring. */
export function handleExplorationCommand(state: MatchState, context: PlayerMatchContext, command: ExplorationCommand): MatchTransitionResult {
  if (state.phase !== 'exploring') return rejected(state, 'wrong-phase');
  if (command.type === 'exploration.assignControl') {
    if (context.actorSeatId !== context.hostSeatId) return rejected(state, 'not-host');
    if (!state.players.some((player) => player.seatId === command.seatId)) return rejected(state, 'unknown-player');
    return accepted({ ...state, controllerSeatId: command.seatId,
      exploration: { version: (state.exploration?.version ?? 0) + 1, moves: state.exploration?.moves ?? [] } });
  }
  if (context.actorSeatId !== state.controllerSeatId &&
    !(command.type === 'exploration.reset' && context.actorSeatId === context.hostSeatId)) return rejected(state, 'not-controller');
  const attempt = { roundStartRobots: state.round.startRobots, robots: state.robots, moves: state.exploration?.moves ?? [] };
  const next = command.type === 'exploration.move'
    ? moveAttemptRobot(state.puzzle.board, attempt, command.robotId, command.direction).attempt
    : command.type === 'exploration.undo' ? undoAttempt(attempt) : resetAttempt(attempt);
  if (next === attempt) return noOp(state, command.type === 'exploration.move' ? 'blocked-move'
    : command.type === 'exploration.undo' ? 'empty-undo' : 'already-reset');
  return accepted({ ...state, robots: next.robots,
    exploration: { version: (state.exploration?.version ?? 0) + 1, moves: next.moves } });
}
