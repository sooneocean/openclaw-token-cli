export type SleepFn = (ms: number) => Promise<void>;

export const sleep: SleepFn = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
