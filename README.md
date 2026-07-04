# Distributed Background Job Scheduler

A production-inspired, high-fidelity distributed background job execution platform. This system exposes a rich REST API to accept immediate, delayed, scheduled, cron, and workflow-dependent jobs, persisted securely in a relational SQLite structure. In the background, a cluster of resilient, concurrent, and identifiable worker processes poll the database and claim candidate jobs atomically using transaction isolation barriers to prevent duplicate runs. Performance, health telemetry, and system metrics are visible through a highly polished React Dashboard.

## Key Features

- **Relational Integrity**: Normalised schema with organizations, projects, queues, jobs, executions, and dead-letter queues.
- **Atomic Job Claiming**: Prevents double-claiming under heavy worker concurrency using transactional immediate locking.
- **Polished Frontend Dashboard**: React-based monitoring panel featuring real-time queue health, worker telemetry, log streams, and system metrics.
- **Workflow Dependency Chains**: Jobs can declare dependency arrays, triggering automatically once all parent processes succeed.
- **AI Diagnostics**: Leverages Gemini 3.5 Flash server-side to analyze failed execution logs and generate failure root-cause analysis summaries.
- **Configurable Backoff Retries**: Supports Fixed Delay, Linear, and Exponential backoff strategies.
- **Robust Dead Letter Queue (DLQ)**: Automatically quarantines permanently failed workloads with comprehensive debug data.

---

## 🏗️ System Architecture & Data Flow

```
                                    +-----------------------+
                                    |      Client / UI      |
                                    |   (React Dashboard)   |
                                    +-----------------------+
                                        /                \
                         HTTP REST APIs/                  \HTTP REST APIs
                                      v                    v
                   +------------------------+        +------------------------+
                   | Express API Controller |        | Express API Controller |
                   |      (Node Instance 1) |        |      (Node Instance 2) |
                   +------------------------+        +------------------------+
                                        \                  /
                     SQL ACID Operations \                / SQL ACID Operations
                                          v              v
                                     +------------------------+
                                     |    SQLite Database     |
                                     |       (jobs.db)        |
                                     +------------------------+
                                          ^              ^
                       SQL Claim / Poll  /                \ SQL Claim / Poll
                                        /                  \
                   +------------------------+        +------------------------+
                   |  Worker Node Service   |        |  Worker Node Service   |
                   |      (Alpha Core)      |        |      (Beta Silo)       |
                   +------------------------+        +------------------------+
```

---

## 🛠️ Getting Started & Local Setup

### Prerequisites

- **Node.js**: `v22.x.x` or higher (recommended for built-in `node:sqlite` support)
- **NPM**: `v10.x.x` or higher

### Environment Setup

1. Copy the template environment file:
   ```bash
   cp .env.example .env
   ```
2. Configure your environment variables inside `.env`:
   ```env
   PORT=3000
   NODE_ENV=development
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

### Installation

Install the package dependencies:
```bash
npm install
```

### Running the Application

This project is a single unified monorepo running a full-stack Express + Vite development environment. You can spin up both the backend API server (including the internal worker loops) and the frontend Vite server with a single command:

```bash
npm run dev
```

The application will bind to `http://localhost:3000`. 
- **Frontend Dashboard**: Accessible directly in your web browser.
- **REST APIs**: Base path at `http://localhost:3000/api/*`.

### Production Build & Launch

To bundle the application for production deployment:

1. Compile the React frontend assets and package the Express backend server:
   ```bash
   npm run build
   ```
2. Run the production-bundled CommonJS server:
   ```bash
   npm run start
   ```

---

## 🐳 Docker Deployment Setup

You can run the full-stack system inside a multi-container Docker structure to simulate multiple workers distributed across discrete nodes.

### 1. Create a `Dockerfile`

Create a `Dockerfile` in the root of the project:
```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
```

### 2. Create a `docker-compose.yml`

Create a `docker-compose.yml` configuration to spin up the API controller and multiple standalone workers:
```yaml
version: '3.8'

services:
  api-service:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    volumes:
      - db-data:/app/data

  worker-alpha:
    build: .
    environment:
      - NODE_ENV=production
      - PORT=3001
      - WORKER_NAME=Alpha-Core-01
      - RUN_ONLY_WORKER=true
    volumes:
      - db-data:/app/data

  worker-beta:
    build: .
    environment:
      - NODE_ENV=production
      - PORT=3002
      - WORKER_NAME=Beta-Silo-02
      - RUN_ONLY_WORKER=true
    volumes:
      - db-data:/app/data

volumes:
  db-data:
```

Launch the stack using:
```bash
docker-compose up --build
```

---

## 🧪 Running Automated Tests

A comprehensive integration and concurrency test suite is built into the application backend. You can run these tests either from the CLI or directly via the frontend dashboard.

To run the automated test suite from the CLI:
```bash
npm run dev
# In another terminal, trigger the test endpoint:
curl -X POST http://localhost:3000/api/tests/run
```

The assertions verify:
1. Immediate and delayed job state transitions.
2. Concurrent claim prevention (ensuring no double-execution).
3. Backoff retry schedules and failure log structures.
4. Dependency workflows (making sure a child job only runs after parents succeed).
5. Quarantine of exhausted jobs into the DLQ.

---

## 📜 REST API Reference

All requests must contain an authentication header:
`Authorization: Bearer user-1` (or any valid userId).

### Projects & Queues
- **`GET /api/projects`**: Retrieve list of projects.
- **`GET /api/queues`**: Retrieve active job queues and their real-time statistics.
- **`POST /api/queues/:queueId/pause`**: Pause workers from claiming jobs on a queue.
- **`POST /api/queues/:queueId/resume`**: Resume job claiming on a queue.

### Jobs & Executions
- **`GET /api/jobs`**: Explore and filter jobs with optional `status`, `queueId`, and pagination rules.
- **`POST /api/jobs`**: Schedule a single job.
  ```json
  {
    "queueId": "queue-1",
    "name": "send_welcome_email",
    "payload": { "userId": "105" },
    "priority": 1,
    "delayMs": 5000
  }
  ```
- **`POST /api/jobs/batch`**: Schedule a batch of jobs in bulk.
- **`GET /api/jobs/:jobId/logs`**: View active log streams for an individual job.
- **`POST /api/jobs/:jobId/retry`**: Force retry or pull a failed job out of the DLQ back into the active queue.

### AI Diagnostics
- **`POST /api/gemini/summarize-failure`**: Generates a server-side Gemini 3.5 Flash explanation of a failed execution block.
  ```json
  {
    "jobId": "job-s-28"
  }
  ```
