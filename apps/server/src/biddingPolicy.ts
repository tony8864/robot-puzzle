import { BIDDING_WINDOW_MS } from '@robot-puzzle/match';

export interface BiddingEnvironment {
  readonly APP_ENV: string;
  readonly LOCAL_BIDDING_WINDOW_SECONDS?: unknown;
}

/** Local manual testing only. Production always uses the approved 60 seconds. */
export function biddingWindowMs(env: BiddingEnvironment): number {
  const value = env.LOCAL_BIDDING_WINDOW_SECONDS;
  if (env.APP_ENV !== 'local' || value === undefined || value === '') return BIDDING_WINDOW_MS;
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 60) {
    throw new Error('LOCAL_BIDDING_WINDOW_SECONDS must be an integer from 1 to 60');
  }
  return Number(value) * 1000;
}
