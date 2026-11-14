/** Host status only; the room owns agreements and request cancellation. */
export function HostBiddingRequestPanel({ agreedCount, playerCount, disabled, onCancel }: {
  readonly agreedCount: number;
  readonly playerCount: number;
  readonly disabled: boolean;
  readonly onCancel: () => void;
}) {
  return <section className="player-bidding-request host-bidding-request" aria-label="Early bidding request">
    <h2><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m3 5 8 7-8 7V5Zm10 0 8 7-8 7V5Z" />
    </svg>End bidding early?</h2>
    <p>Waiting for players to agree. The countdown continues.</p>
    <div className="player-bidding-request__count"><span>Players agreed</span><strong aria-live="polite">{agreedCount} / {playerCount}</strong></div>
    <div className="player-bidding-request__progress" role="progressbar" aria-label="Players agreed"
      aria-valuemin={0} aria-valuemax={playerCount} aria-valuenow={agreedCount}>
      <span style={{ width: `${agreedCount / playerCount * 100}%` }} />
    </div>
    <div className="player-bidding-request__waiting"><p>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m5 12 4 4L19 6" /></svg>
      Your agreement is counted
    </p></div>
    <div className="player-bidding-request__actions">
      <button type="button" disabled={disabled} onClick={onCancel}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18" /></svg>
        Cancel request
      </button>
    </div>
  </section>;
}
