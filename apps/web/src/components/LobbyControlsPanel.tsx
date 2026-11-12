import type { ReactNode } from 'react';
import type { MatchPlayer } from '@robot-puzzle/match';
import { LobbyRoster } from './LobbyRoster';
import { LobbyActions } from './LobbyActions';

/** Lobby presentation only; permissions, eligibility and live state stay with the caller. */
export function LobbyControlsPanel({ players, hostSeatId, currentSeatId, onShuffle, onStart,
  shuffleDisabled, startDisabled, shuffleLabel, startLabel, roster, footer }: {
  readonly players: readonly MatchPlayer[];
  readonly hostSeatId: string;
  readonly currentSeatId: string;
  readonly onShuffle: () => void;
  readonly onStart: () => void;
  readonly shuffleDisabled?: boolean;
  readonly startDisabled?: boolean;
  readonly shuffleLabel?: string;
  readonly startLabel?: string;
  readonly roster?: ReactNode;
  readonly footer?: ReactNode;
}) {
  return <div className="lobby-controls-panel">
    {roster ?? <LobbyRoster players={players} hostSeatId={hostSeatId} currentSeatId={currentSeatId} />}
    <LobbyActions isHost={currentSeatId === hostSeatId}
      hostNickname={players.find((player) => player.seatId === hostSeatId)!.nickname}
      onShuffle={onShuffle} onStart={onStart} shuffleDisabled={shuffleDisabled}
      startDisabled={startDisabled} shuffleLabel={shuffleLabel} startLabel={startLabel} />
    {footer}
  </div>;
}
