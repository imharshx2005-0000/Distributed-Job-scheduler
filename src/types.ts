export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  createdAt: string;
}

export interface Queue {
  id: string;
  projectId: string;
  name: string;
  priority: number; // 1 = High, 2 = Medium, 3 = Low
  concurrencyLimit: number;
  retryPolicyType: 'fixed' | 'linear' | 'exponential';
  retryPolicyDelayMs: number;
  retryMaxAttempts: number;
  isPaused: boolean;
  createdAt: string;
}

export interface Job {
  id: string;
  queueId: string;
  name: string;
  payload: string; // JSON string
  status: 'queued' | 'scheduled' | 'claimed' | 'running' | 'completed' | 'failed' | 'dlq';
  priority: number;
  maxAttempts: number;
  attemptsMade: number;
  runAt: string | null; // ISO timestamp for delayed/scheduled runs
  cronExpression: string | null;
  batchId: string | null;
  dependencies: string | null; // JSON array of job IDs
  createdAt: string;
  queue_name?: string;
  project_name?: string;
}

export interface JobExecution {
  id: string;
  jobId: string;
  workerId: string;
  attempt: number;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
}

export interface Worker {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  lastHeartbeat: string;
  createdAt: string;
}

export interface WorkerHeartbeat {
  id: string;
  workerId: string;
  timestamp: string;
  loadConcurrency: number;
}

export interface JobLog {
  id: string;
  jobId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  createdAt: string;
}

export interface DLQEntry {
  id: string;
  jobId: string;
  queueId: string;
  failedAt: string;
  attemptsMade: number;
  lastError: string;
}

export interface SystemMetrics {
  totalJobs: number;
  queuedJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  dlqJobs: number;
  activeWorkers: number;
  throughputRate: number; // completed jobs per minute
  queueStats: {
    queueId: string;
    queueName: string;
    projectName: string;
    queuedCount: number;
    runningCount: number;
    completedCount: number;
    failedCount: number;
    dlqCount: number;
  }[];
  recentThroughput: {
    time: string;
    completed: number;
    failed: number;
  }[];
}

export interface TestAssertion {
  name: string;
  passed: boolean;
  message?: string;
}

export interface TestResult {
  testId: string;
  testName: string;
  status: 'passed' | 'failed' | 'running' | 'not_started';
  assertions: TestAssertion[];
  durationMs: number;
  logs: string[];
}
