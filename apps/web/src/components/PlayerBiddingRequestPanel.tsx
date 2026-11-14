/** Presentation only: accepted agreements and eligibility come from room snapshots. */
export function PlayerBiddingRequestPanel({ agreedCount, playerCount, hasAgreed, disabled, pending, onVote }: {
  readonly agreedCount: number;
  readonly playerCount: number;
  readonly hasAgreed: boolean;
  readonly disabled: boolean;
  readonly pending: boolean;
  readonly onVote: (agree: boolean) => void;
}) {
  return <section className="player-bidding-request" aria-label="Early bidding request">
    <h2><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m3 5 8 7-8 7V5Zm10 0 8 7-8 7V5Z" />
    </svg>End bidding early?</h2>
    <p>The host wants to end the countdown early. Do you agree?</p>
    <div className="player-bidding-request__count"><span>Players agreed</span><strong aria-live="polite">{agreedCount} / {playerCount}</strong></div>
    <div className="player-bidding-request__progress" role="progressbar" aria-label="Players agreed"
      aria-valuemin={0} aria-valuemax={playerCount} aria-valuenow={agreedCount}>
      <span style={{ width: `${agreedCount / playerCount * 100}%` }} />
    </div>
    {hasAgreed ? <div className="player-bidding-request__waiting" role="status">
      <p><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m5 12 4 4L19 6" /></svg>
        You agreed to end bidding early</p>
      <p>Waiting for other players… <span>{agreedCount} / {playerCount}</span></p>
    </div> : <div className="player-bidding-request__actions" aria-busy={pending}>
      <button type="button" disabled={disabled || pending} onClick={() => onVote(false)}>Decline</button>
      <button type="button" className="player-bidding-request__agree" disabled={disabled || pending} onClick={() => onVote(true)}>Agree to end</button>
    </div>}
  </section>;
}
