# Technical Architecture & Relational Schema Specifications

This document describes the high-level system architecture, database design, REST API specifications, and design trade-offs of the Distributed Job Scheduler platform.

---

## 1. System Architecture

The platform follows a clean, decoupled, event-polling architecture:

```
+-------------------+      HTTP REST APIs      +------------------------+
|   Client / UI     | =======================> | Express API Controller |
| (React Dashboard) | <======================= |      (server.ts)       |
+-------------------+   Polling Responses      +------------------------+
                                                           ||
                                                           || ACID SQL Reads/Writes
                                                           \/
+-------------------+      Poll & Claim        +------------------------+
|  Virtual Workers  | =======================> |   SQLite Database      |
|  (Alpha, Beta)    | <======================= |       (jobs.db)        |
+-------------------+                          +------------------------+
```

1. **REST API Ingestion**: Clients dispatch job payloads (immediate, delayed, scheduled, cron, or batch groups) to the API.
2. **Durable Relational Persistence**: Jobs are saved to SQLite instantly in `'queued'` or `'scheduled'` states.
3. **Atomic Polling Engine**: In the background, Worker Nodes check for candidate jobs and claim them atomically within transaction isolation boundaries, avoiding race conditions and duplicate executions.
4. **Resiliency Processing**: If job runs fail, backoff retry schedules are computed; if failures persist, they are moved to the Dead Letter Queue (DLQ).
5. **AI Diagnostics**: Administrators can trigger server-side Gemini 3.5 Flash queries to analyze failed job execution logs and diagnose problems automatically.

---

## 2. Relational Database Schema Design

The schema is built on third-normal-form (3NF) normalization to avoid data redundancy and maintain operational referential integrity.

### Entity-Relationship Diagram

```
+------------------+         +------------------+
|  organizations   | <------ |      users       |
+------------------+         +------------------+
       ^
       | ON DELETE CASCADE
       |
+------------------+         +------------------+
|     projects     | <------ |      queues      |
+------------------+         +------------------+
                                    ^
                                    | ON DELETE CASCADE
                                    |
+------------------+         +------------------+
|   dlq_entries    | <------ |      jobs        |
+------------------+         +------------------+
                                    ^
                                    | ON DELETE CASCADE
                                    |
                             +------------------+
                             |  job_executions  |
                             +------------------+
```

### Table Definitions

1. **`organizations`**: Holds company partition profiles.
2. **`users`**: Customer logins. `org_id` foreign key supports tenancy partitioning.
3. **`projects`**: Clusters containing queues.
4. **`queues`**: Holds configuration states (priority, concurrency limits, retry strategies).
5. **`jobs`**: The background workloads. Retains dependencies as a JSON array of predecessor job IDs.
6. **`job_executions`**: Execution history records of worker attempts, status, and error states.
7. **`dlq_entries`**: Quarantined items that completely exhausted their max attempts.

---

## 3. REST API Documentation

All routes expect header `"Authorization: Bearer <user-id>"`.

* **`GET /api/queues`**: Returns all queues under the user's organization with current live processing metrics.
* **`POST /api/jobs`**: Enqueues a new background job. Supports `delayMs` (delay timers), `cronExpression` (cron intervals), and `dependencies` (workflow chains).
* **`POST /api/jobs/batch`**: Accepts an array of jobs, bulk-inserting them under a unique transaction.
* **`POST /api/gemini/summarize-failure`**: Leverages Gemini 3.5 Flash server-side to diagnose a failed job based on its database execution logs.
* **`POST /api/tests/run`**: Triggers a local backend stress test suite and returns assertions.

---

## 4. Engineering Decisions & Major Trade-offs

### Built-in `node:sqlite` vs. Native binaries
* **Decision**: We chose Node 22's native built-in `node:sqlite` module.
* **Trade-off**: While Postgres (via `pg`) offers higher concurrent write capabilities, choosing a standard, zero-dependency engine eliminates Native C++ build compiler errors during containerized cloud deployments, guaranteeing flawless out-of-the-box operations.

### Atomic Claiming using Transactions
* **Decision**: We claim candidate jobs using SQLite transactions wrapped inside standard `BEGIN IMMEDIATE TRANSACTION` boundaries.
* **Trade-off**: This locks the database during the status flip from `'queued'` to `'claimed'`, avoiding double-claims. While database-level locking temporarily serializes writes, it provides absolute concurrency safety for small-to-medium cluster pools.
