import { useId, useRef, useState, type ReactNode } from 'react';

interface ExplorationTabsProps {
  readonly isHost: boolean;
  readonly isExploring: boolean;
  /** Stable for one exploration; changing controller must not change this key. */
  readonly explorationKey: string;
  readonly exploreDisabled?: boolean;
  readonly exploreContent: ReactNode;
  readonly manageContent: ReactNode;
}

/** Presentation only. The Exploration screen supplies existing tab content. */
export function ExplorationTabs(props: ExplorationTabsProps) {
  if (!props.isHost || !props.isExploring) return null;
  return <TabContent key={props.explorationKey} {...props} />;
}

function TabContent({ exploreDisabled = false, exploreContent, manageContent }: ExplorationTabsProps) {
  const [active, setActive] = useState<'explore' | 'manage'>('explore');
  const id = useId();
  const explore = useRef<HTMLButtonElement>(null);
  const manage = useRef<HTMLButtonElement>(null);
  return <div className="exploration-tabs">
    <div className="exploration-tabs__bar" role="tablist" aria-label="Exploration controls" onKeyDown={(event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = exploreDisabled || event.key === 'End' ? 'manage'
        : event.key === 'Home' ? 'explore' : active === 'explore' ? 'manage' : 'explore';
      setActive(next);
      (next === 'explore' ? explore : manage).current?.focus();
    }}>
      <button ref={explore} type="button" role="tab" id={`${id}-explore`} aria-controls={`${id}-explore-panel`}
        aria-selected={active === 'explore'} disabled={exploreDisabled}
        tabIndex={active === 'explore' && !exploreDisabled ? 0 : -1} onClick={() => setActive('explore')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M6 8h12a3 3 0 0 1 3 2.5l1 7a2 2 0 0 1-3.4 1.7L16 17H8l-2.6 2.2A2 2 0 0 1 2 17.5l1-7A3 3 0 0 1 6 8Z" />
          <path d="M6 12h4M8 10v4M16 12h.01M19 14h.01" />
        </svg>Explore
      </button>
      <button ref={manage} type="button" role="tab" id={`${id}-manage`} aria-controls={`${id}-manage-panel`}
        aria-selected={active === 'manage'} tabIndex={active === 'manage' || exploreDisabled ? 0 : -1} onClick={() => setActive('manage')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 20v-2a6 6 0 0 0-3-5.2" />
        </svg>Manage
      </button>
    </div>
    <div role="tabpanel" id={`${id}-explore-panel`} aria-labelledby={`${id}-explore`} hidden={active !== 'explore'}>
      {active === 'explore' ? exploreContent : null}
    </div>
    <div role="tabpanel" id={`${id}-manage-panel`} aria-labelledby={`${id}-manage`} hidden={active !== 'manage'}>
      {active === 'manage' ? manageContent : null}
    </div>
  </div>;
}
