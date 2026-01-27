export interface Config {
  sessionId: string;
  maxIterations: number;
}

export const EXIT_CODES = {
  SUCCESS: 0,
  BLOCKED: 1,
  MAX_ITERATIONS: 2,
  INTERRUPTED: 130,
} as const;
