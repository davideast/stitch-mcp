export interface StepResult {
  success: boolean;
  detail?: string; // For UI status
  reason?: string; // Additional reason (e.g. for skipped steps)
  error?: Error;
  errorCode?: string; // Error code for machine consumption
  shouldExit?: boolean;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'SKIPPED' | 'FAILED';
}

export interface CommandStep<T> {
  id: string;
  name: string; // User visible name
  run(context: T): Promise<StepResult>;
  shouldRun(context: T): Promise<boolean>;
}
