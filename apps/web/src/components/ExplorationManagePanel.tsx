import { useId } from 'react';
import type { PublicPlayer } from '@robot-puzzle/shared';

/** UI only: controller/presence come from the caller; actions are callbacks. */
export function ExplorationManagePanel({ isHost, players, currentSeatId, controllerSeatId, disabled = false,
  onAssignControl, onResetBoard, onNextRound }: {
  readonly isHost: boolean;
  readonly players: readonly PublicPlayer[];
  readonly currentSeatId: string;
  readonly controllerSeatId: string;
  readonly disabled?: boolean;
  readonly onAssignControl?: (seatId: string) => void;
  readonly onResetBoard?: () => void;
  readonly onNextRound: () => void;
}) {
  const headingId = useId();
  if (!isHost) return null;
  return <section className="exploration-manage" aria-labelledby={headingId}>
    <div className="exploration-manage__heading">
      <h2 id={headingId}>Board Control</h2><span>{players.length} {players.length === 1 ? 'player' : 'players'}</span>
    </div>
    <ul className="exploration-manage__players" aria-label="Board control players">
      {players.map((player) => <li className="exploration-manage__row" key={player.seatId}>
        <span className="exploration-manage__name">{player.nickname}{player.seatId === currentSeatId && <span> (you)</span>}</span>
        <div className="exploration-manage__status">
          {player.seatId === controllerSeatId && <span className="exploration-manage__controller">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m5 12 4 4L19 6" /></svg>
            Has control
          </span>}
          {!player.connected ? <span className="exploration-manage__offline">Offline</span>
            : player.seatId !== controllerSeatId && <button type="button" disabled={disabled || !onAssignControl}
              aria-label={`Give control to ${player.nickname}`} onClick={() => onAssignControl?.(player.seatId)}>Give control</button>}
        </div>
      </li>)}
    </ul>
    <div className="exploration-manage__actions">
      <button type="button" disabled={disabled || !onResetBoard} onClick={onResetBoard}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7" />
        </svg>Reset Board
      </button>
      <button type="button" className="exploration-manage__next" disabled={disabled} onClick={onNextRound}>Next Round</button>
    </div>
  </section>;
}
