import type { PublicPlayer } from '@robot-puzzle/shared';
import type { Direction, RobotId } from '@robot-puzzle/game-engine';
import { ExplorationTabs } from './ExplorationTabs';
import { ExplorationManagePanel } from './ExplorationManagePanel';
import { DemonstrationControls } from './DemonstrationControls';

/** Server-owned board/controller; tab and robot selection are presentation only. */
export function ExplorationHostPanel({ players, hostSeatId, controllerSeatId, explorationKey, disabled, onNextRound,
  selectedRobot, moveCount, onSelect, onMove, onUndo, onReset, onAssignControl, feedback }: {
  readonly players: readonly PublicPlayer[];
  readonly hostSeatId: string;
  readonly controllerSeatId: string;
  readonly explorationKey: string;
  readonly disabled: boolean;
  readonly onNextRound: () => void;
  readonly selectedRobot: RobotId;
  readonly moveCount: number;
  readonly onSelect: (robotId: RobotId) => void;
  readonly onMove: (direction: Direction) => void;
  readonly onUndo: () => void;
  readonly onReset: () => void;
  readonly onAssignControl: (seatId: string) => void;
  readonly feedback: string | null;
}) {
  return <ExplorationTabs isHost isExploring explorationKey={explorationKey} exploreDisabled={controllerSeatId !== hostSeatId}
    exploreContent={<DemonstrationControls exploring selectedRobot={selectedRobot} moveCount={moveCount} onSelect={onSelect}
      onMove={onMove} onUndo={onUndo} onReset={onReset} onGiveUp={() => {}}
      disabled={disabled || controllerSeatId !== hostSeatId} selectionDisabled={disabled || controllerSeatId !== hostSeatId} feedback={feedback} />}
    manageContent={<ExplorationManagePanel isHost players={players} currentSeatId={hostSeatId}
      controllerSeatId={controllerSeatId} disabled={disabled} onAssignControl={onAssignControl} onResetBoard={onReset} onNextRound={onNextRound} />} />;
}
