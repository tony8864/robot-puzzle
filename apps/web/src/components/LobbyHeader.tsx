import type { ReactNode } from 'react';
import { RoomCode } from './RoomCode';
import { MatchActions } from './MatchActions';

/** Lobby presentation only; room actions and connection recovery stay with the caller. */
export function LobbyHeader({ boardName, roomCode, connectionLabel, recovery, onLeave, onEnd, endDisabled = false }: {
  readonly boardName: string;
  readonly roomCode: string;
  readonly connectionLabel: string;
  readonly recovery?: ReactNode;
  readonly onLeave?: () => void;
  readonly onEnd?: () => void;
  readonly endDisabled?: boolean;
}) {
  return <header className="lobby-header">
    <div className="lobby-header__top">
      <div className="lobby-header__heading">
        <h1>Match setup</h1>
        <p className="lobby-header__board" title={boardName} aria-live="polite">{boardName}</p>
      </div>
      <div className="active-match-header__actions">
        <RoomCode code={roomCode} compact /><MatchActions onLeave={onLeave} onEnd={onEnd} endDisabled={endDisabled} />
      </div>
    </div>
    <div className="lobby-header__bottom">
      <p className="lobby-header__waiting">Lobby · Waiting for players</p>
      <span className="lobby-header__version" aria-label={`App version v${__APP_VERSION__}`}>v{__APP_VERSION__}</span>
      <span className="lobby-header__connection" role="status">
        <svg className="lobby-header__users-icon" aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="7" r="4" />
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>{connectionLabel}
      </span>
    </div>
    {recovery}
  </header>;
}
