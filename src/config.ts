export interface VerifyConfig {
  trigger: 'done';
  maxAttempts: number;
}

export interface ReviewConfig {
  trigger: 'done';
  maxAttempts: number;
}

export interface CallbackHooks {
  onDone?: string;
  onBlocked?: string;
  onProgress?: string;
}

export interface Config {
  sessionId: string;
  maxIterations: number;
  message?: string;
  review?: ReviewConfig;
  verify?: VerifyConfig;
  hooks?: CallbackHooks;
}

export interface GoalConfig {
  sessionId: string;
  goal: string;
  hooks?: CallbackHooks;
}

export const EXIT_CODES = {
  SUCCESS: 0,
  BLOCKED: 1,
  MAX_ITERATIONS: 2,
  VERIFICATION_EXHAUSTED: 3,
  REVIEW_EXHAUSTED: 4,
  INTERRUPTED: 130,
} as const;
