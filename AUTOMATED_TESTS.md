# Automated Concurrency & Reliability Test Suite

This document describes the automated test suite built directly into the Distributed Job Scheduler's backend engine (`/api/tests/run`). 

Users and evaluators can execute these tests in real-time with a single click from the **Stress Testing** tab of the Web Dashboard.

---

## 1. Test Coverage & Assertions

The test suite covers five critical concurrency and reliability behaviors:

### Test 1: Atomic Job Claiming & Double-Execution Guard
* **Purpose**: Verifies that two concurrent worker processes cannot claim the same queued job.
* **Mechanism**: Spawns five parallel threads attempting to claim a single test job. It opens multiple transactions concurrently using SQLite `BEGIN IMMEDIATE TRANSACTION`.
* **Assertion**: Asserts that only one thread successfully changes status to `'claimed'` while the other four are gracefully aborted, ensuring absolute duplicate-execution prevention.

### Test 2: Queue Concurrency Throttling Limits
* **Purpose**: Asserts that a queue's configured `concurrency_limit` is strictly respected by the Worker Engine.
* **Mechanism**: Inspects active running tasks in the queue and compares them with the queue's limits.
* **Assertion**: Validates that active parallel worker execution counts never exceed the configured boundary.

### Test 3: Backoff Retry Intervals Math
* **Purpose**: Verifies the backoff arithmetic calculated for fixed, linear, and exponential strategies.
* **Mechanism**: Simulates multiple consecutive job failures and calculates the expected next execution timing.
* **Assertion**: Validates that exponential delays (e.g. attempt 1 = 1x, attempt 2 = 2x, attempt 3 = 4x) match mathematical formulas perfectly.

### Test 4: Workflow Dependency Solver Chains
* **Purpose**: Asserts that dependent jobs remain blocked in the queue until all predecessor parent jobs have completely finished.
* **Mechanism**: Chains two test jobs: a target job depending on a prerequisite job. It attempts to claim the target job while the parent is still queued.
* **Assertion**: Confirms the target job is blocked while the parent is incomplete, and automatically releases for claiming once the parent is completed.

### Test 5: Dead Letter Queue (DLQ) Promotion
* **Purpose**: Asserts that jobs exceeding their max retry attempts are quarantined in the DLQ table.
* **Mechanism**: Spawns a job with a max limit of 2 retries, simulates two consecutive failures, and triggers execution.
* **Assertion**: Validates that the job is moved out of active queues, its status is changed to `'dlq'`, and detailed diagnostic parameters are written to the `dlq_entries` table.

---

## 2. Running Tests via REST API

You can trigger the test suite programmatically using any REST client:

```bash
curl -X POST http://localhost:3000/api/tests/run \
  -H "Authorization: Bearer user-1" \
  -H "Content-Type: application/json"
```

### Example JSON Response:

```json
{
  "testId": "test-run-1719941162000",
  "testName": "Critical Reliability & Concurrency Tests",
  "status": "passed",
  "assertions": [
    {
      "name": "Job Claim Atomicity Guaranteed",
      "passed": true,
      "message": "Successfully claimed only once by worker-sim-3 out of 5 concurrent requests."
    },
    {
      "name": "Queue Concurrency Limits Respected",
      "passed": true,
      "message": "Active executions count (0) is safely within limit (3)."
    },
    {
      "name": "Exponential Backoff Math Validation",
      "passed": true,
      "message": "Calculated Exponential delay at attempt 1: 1000ms, attempt 2: 2000ms, attempt 3: 4000ms."
    },
    {
      "name": "Job Workflow Dependency Chains",
      "passed": true,
      "message": "Target job correctly blocked when dependency was queued, and released once completed."
    },
    {
      "name": "DLQ Promotion on Exhausted Retries",
      "passed": true,
      "message": "Job was safely promoted to Dead Letter Queue (DLQ) with error details: \"Max retry attempts exhausted.\""
    }
  ],
  "durationMs": 45,
  "logs": [
    "[21:18:09] Starting critical concurrency and reliability test suite...",
    "[21:18:09] Executing ATOMICITY & CLAIM TEST...",
    "[21:18:09] Simulating multiple concurrent workers trying to claim the same job..."
  ]
}
```
