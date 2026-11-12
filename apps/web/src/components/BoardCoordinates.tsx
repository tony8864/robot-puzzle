import type { ReactNode } from 'react';
import { BOARD_SIZE } from '@robot-puzzle/game-engine';

/** Coordinates surround the unchanged SVG; each track corresponds to one cell. */
export function BoardCoordinates({ children }: { readonly children: ReactNode }) {
  return <div className="board-coordinates">
    <div className="board-coordinates__columns" aria-hidden="true">
      {Array.from({ length: BOARD_SIZE }, (_, index) => <span key={index}>{String.fromCharCode(65 + index)}</span>)}
    </div>
    <div className="board-coordinates__rows" aria-hidden="true">
      {Array.from({ length: BOARD_SIZE }, (_, index) => <span key={index}>{index + 1}</span>)}
    </div>
    {children}
  </div>;
}
