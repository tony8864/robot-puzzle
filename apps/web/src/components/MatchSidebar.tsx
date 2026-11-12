import type { ReactNode } from 'react';
import type { TargetSymbol as TargetShape } from '@robot-puzzle/game-engine';
import { RoomCode } from './RoomCode';
import { MatchActions } from './MatchActions';
import { TargetSymbol } from './TargetSymbol';

/** Presentation only: the caller retains phase permissions and confirmation. */
export function MatchSidebar({ round, phase, boardName, targetLabel, targetColor, targetSymbol,
  roomCode, connectionLabel, isConnected = false, recovery, countdown, onSkip, skipDisabled = false, onLeave, onEnd, endDisabled = false }: {
  readonly round: number;
  readonly phase: string;
  readonly boardName: string;
  readonly targetLabel: string | null;
  readonly targetColor?: string;
  readonly targetSymbol?: TargetShape;
  readonly roomCode: string;
  readonly connectionLabel: string;
  readonly isConnected?: boolean;
  readonly recovery?: ReactNode;
  readonly countdown?: ReactNode;
  readonly onSkip?: () => void;
  readonly skipDisabled?: boolean;
  readonly onLeave?: () => void;
  readonly onEnd?: () => void;
  readonly endDisabled?: boolean;
}) {
  return <header className="active-match-header">
    <div className="active-match-header__top">
      <div className="active-match-header__heading">
        <p className="active-match-header__round">ROUND {round} / 10</p>
        <div className="active-match-header__phase"><h1>{phase}</h1>{countdown}</div>
      </div>
      <div className="active-match-header__actions">
        <RoomCode code={roomCode} compact />
        <MatchActions onSkip={onSkip} skipDisabled={skipDisabled} onLeave={onLeave} onEnd={onEnd} endDisabled={endDisabled} />
      </div>
    </div>
    <div className="active-match-header__bottom">
      <p className="active-match-header__detail" title={targetLabel ? `${boardName} · ${targetLabel}` : boardName}>
        <span>{boardName}</span>{targetLabel && <><span className="active-match-header__target-separator"> · </span><span className="active-match-header__target" style={{ color: targetColor }}>
          {targetSymbol && <span className="active-match-header__target-icon" aria-hidden="true"><TargetSymbol symbol={targetSymbol} /></span>}{targetLabel}
        </span></>}
      </p>
      <span className="active-match-header__connection" role="status">{isConnected && <span className="active-match-header__status-dot" aria-hidden="true" />}{connectionLabel}</span>
    </div>
    {recovery}
    <span className="active-match-header__version" aria-label={`App version v${__APP_VERSION__}`}>v{__APP_VERSION__}</span>
  </header>;
}

