import { BaseState, GameHalf, LineupSlot, TeamLineupState } from '@/types';

export const EMPTY_BASES: BaseState = {
  first: null,
  second: null,
  third: null,
};

const baseNames: Array<keyof BaseState> = ['first', 'second', 'third'];
const advancePriority: Array<keyof BaseState> = ['third', 'second', 'first'];

const baseIndex: Record<keyof BaseState, number> = {
  first: 1,
  second: 2,
  third: 3,
};

const indexToBase: Record<number, keyof BaseState> = {
  1: 'first',
  2: 'second',
  3: 'third',
};

export const hitValueMap = {
  single: 1,
  double: 2,
  triple: 3,
  homerun: 4,
} as const;

export function cloneBases(bases: BaseState): BaseState {
  return {
    first: bases.first,
    second: bases.second,
    third: bases.third,
  };
}

function moveRunner(
  bases: BaseState,
  from: keyof BaseState,
  steps: number,
): { scored: boolean; targetBase?: keyof BaseState } {
  const startIndex = baseIndex[from];
  const destinationIndex = startIndex + steps;

  if (destinationIndex >= 4) {
    return { scored: true };
  }

  return {
    scored: false,
    targetBase: indexToBase[destinationIndex],
  };
}

export function advanceRunnersForHit(
  current: BaseState,
  basesTaken: number,
  batterId: string,
) {
  const before = cloneBases(current);
  const next = cloneBases(EMPTY_BASES);
  let runsScored = 0;

  // move existing runners starting from third base
  [...baseNames].reverse().forEach((baseName) => {
    const occupant = before[baseName];
    if (!occupant) {
      return;
    }
    const moveResult = moveRunner(before, baseName, basesTaken);
    if (moveResult.scored) {
      runsScored += 1;
    } else if (moveResult.targetBase) {
      next[moveResult.targetBase] = occupant;
    }
  });

  if (basesTaken >= 4) {
    runsScored += 1; // batter scored
  } else {
    const landingBase = indexToBase[basesTaken];
    if (landingBase) {
      next[landingBase] = batterId;
    }
  }

  return {
    before,
    after: next,
    runsScored,
    rbi: runsScored,
  };
}

export function registerCaughtOut(current: BaseState, runnerId?: string) {
  const before = cloneBases(current);
  const after = cloneBases(current);
  if (runnerId) {
    baseNames.forEach((base) => {
      if (after[base] === runnerId) {
        after[base] = null;
      }
    });
  }
  return { before, after };
}

function locateRunner(current: BaseState, runnerId: string) {
  for (const base of baseNames) {
    if (current[base] === runnerId) {
      return base;
    }
  }
  return undefined;
}

export function resolveSteal(
  current: BaseState,
  runnerId: string,
  success: boolean,
) {
  const before = cloneBases(current);
  const after = cloneBases(current);
  if (!success) {
    const origin = locateRunner(after, runnerId);
    if (origin) {
      after[origin] = null;
    }
    return { before, after, success, runsScored: 0 };
  }

  const moverBase = advancePriority.find((base) => after[base]);
  if (!moverBase) {
    return { before, after, success, runsScored: 0 };
  }
  const occupant = after[moverBase];
  if (!occupant) {
    return { before, after, success, runsScored: 0 };
  }
  after[moverBase] = null;
  const moveResult = moveRunner(before, moverBase, 1);
  if (moveResult.scored) {
    return { before, after, success, runsScored: 1 };
  }
  if (moveResult.targetBase) {
    after[moveResult.targetBase] = occupant;
  }
  return { before, after, success, runsScored: 0 };
}

export function getCurrentBatter(lineup: TeamLineupState): LineupSlot {
  const total = lineup.lineup.length;
  const index = lineup.currentIndex % total;
  return lineup.lineup[index];
}

export function moveToNextBatter(lineup: TeamLineupState): TeamLineupState {
  return {
    ...lineup,
    currentIndex: (lineup.currentIndex + 1) % lineup.lineup.length,
  };
}

export function toggleHalf(half: GameHalf): GameHalf {
  return half === 'top' ? 'bottom' : 'top';
}
