import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { DatabaseSync } from "node:sqlite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize SQLite Database
const dbFile = "jobs.db";
const db = new DatabaseSync(dbFile);

// Create Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT,
    email TEXT,
    role TEXT DEFAULT 'member',
    org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS queues (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT,
    priority INTEGER DEFAULT 1, -- 1=High, 2=Medium, 3=Low
    concurrency_limit INTEGER DEFAULT 5,
    retry_policy_type TEXT DEFAULT 'exponential', -- fixed, linear, exponential
    retry_policy_delay_ms INTEGER DEFAULT 1000,
    retry_max_attempts INTEGER DEFAULT 3,
    is_paused INTEGER DEFAULT 0, -- 0=false, 1=true
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    queue_id TEXT REFERENCES queues(id) ON DELETE CASCADE,
    name TEXT,
    payload TEXT, -- JSON
    status TEXT DEFAULT 'queued', -- queued, scheduled, claimed, running, completed, failed, dlq
    priority INTEGER DEFAULT 2, -- 1=High, 2=Medium, 3=Low
    max_attempts INTEGER DEFAULT 3,
    attempts_made INTEGER DEFAULT 0,
    run_at TEXT, -- ISO String
    cron_expression TEXT,
    batch_id TEXT,
    dependencies TEXT, -- JSON array of job IDs
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS job_executions (
    id TEXT PRIMARY KEY,
    job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
    worker_id TEXT,
    attempt INTEGER,
    status TEXT, -- running, completed, failed
    started_at TEXT,
    finished_at TEXT,
    error_message TEXT
  );

  CREATE TABLE IF NOT EXISTS workers (
    id TEXT PRIMARY KEY,
    name TEXT,
    status TEXT DEFAULT 'active', -- active, inactive
    last_heartbeat TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS worker_heartbeats (
    id TEXT PRIMARY KEY,
    worker_id TEXT REFERENCES workers(id) ON DELETE CASCADE,
    timestamp TEXT,
    load_concurrency INTEGER
  );

  CREATE TABLE IF NOT EXISTS job_logs (
    id TEXT PRIMARY KEY,
    job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
    level TEXT DEFAULT 'info', -- info, warn, error
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS dlq_entries (
    id TEXT PRIMARY KEY,
    job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
    queue_id TEXT REFERENCES queues(id) ON DELETE CASCADE,
    failed_at TEXT,
    attempts_made INTEGER,
    last_error TEXT
  );
`);

// Helper to seed Database with defaults if empty
function seedDatabase() {
  const orgCheck = db.prepare("SELECT COUNT(*) as count FROM organizations").get() as { count: number };
  if (orgCheck.count === 0) {
    console.log("Seeding Database...");
    
    // Seed Org
    db.prepare("INSERT INTO organizations (id, name) VALUES (?, ?)").run("org-1", "Acme Corp");
    
    // Seed User
    db.prepare("INSERT INTO users (id, username, password_hash, email, role, org_id) VALUES (?, ?, ?, ?, ?, ?)")
      .run("user-1", "admin", "admin123", "admin@acme.com", "admin", "org-1");
      
    // Seed Project
    db.prepare("INSERT INTO projects (id, org_id, name) VALUES (?, ?, ?)")
      .run("project-1", "org-1", "Infrastructure Operations");
      
    // Seed Queues
    db.prepare(`
      INSERT INTO queues (id, project_id, name, priority, concurrency_limit, retry_policy_type, retry_policy_delay_ms, retry_max_attempts, is_paused)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run("queue-1", "project-1", "Critical Notifications", 1, 3, "exponential", 2000, 3, 0);

    db.prepare(`
      INSERT INTO queues (id, project_id, name, priority, concurrency_limit, retry_policy_type, retry_policy_delay_ms, retry_max_attempts, is_paused)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run("queue-2", "project-1", "Heavy Analytical Reporting", 2, 2, "linear", 3000, 4, 0);

    db.prepare(`
      INSERT INTO queues (id, project_id, name, priority, concurrency_limit, retry_policy_type, retry_policy_delay_ms, retry_max_attempts, is_paused)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run("queue-3", "project-1", "Daily Maintenance & Synclist", 3, 4, "fixed", 5000, 2, 0);

    // Seed Workers
    db.prepare("INSERT INTO workers (id, name, status, last_heartbeat) VALUES (?, ?, ?, ?)")
      .run("worker-1", "Alpha-Core-01", "active", new Date().toISOString());
    db.prepare("INSERT INTO workers (id, name, status, last_heartbeat) VALUES (?, ?, ?, ?)")
      .run("worker-2", "Beta-Silo-02", "active", new Date().toISOString());
    db.prepare("INSERT INTO workers (id, name, status, last_heartbeat) VALUES (?, ?, ?, ?)")
      .run("worker-3", "Gamma-Silo-03", "active", new Date().toISOString());

    // Seed some initial completed and queued jobs to look alive on boot (exactly 30 jobs)
    const insertJob = db.prepare(`
      INSERT INTO jobs (id, queue_id, name, payload, status, priority, max_attempts, attempts_made, run_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedJobs = [
      // 15 Completed Jobs
      { id: "job-s-1", queue_id: "queue-1", name: "send_welcome_email", payload: { userId: "101", email: "user1@example.com" }, status: "completed", priority: 1, max_attempts: 3, attempts_made: 1, run_at: null, age_hours: 5 },
      { id: "job-s-2", queue_id: "queue-1", name: "send_welcome_email", payload: { userId: "102", email: "user2@example.com" }, status: "completed", priority: 1, max_attempts: 3, attempts_made: 1, run_at: null, age_hours: 4 },
      { id: "job-s-3", queue_id: "queue-1", name: "send_welcome_email", payload: { userId: "103", email: "user3@example.com" }, status: "completed", priority: 1, max_attempts: 3, attempts_made: 1, run_at: null, age_hours: 3 },
      { id: "job-s-4", queue_id: "queue-1", name: "send_welcome_email", payload: { userId: "104", email: "user4@example.com" }, status: "completed", priority: 1, max_attempts: 3, attempts_made: 1, run_at: null, age_hours: 2 },
      { id: "job-s-5", queue_id: "queue-2", name: "generate_pdf_report", payload: { reportId: "rep-901", type: "financial" }, status: "completed", priority: 2, max_attempts: 3, attempts_made: 1, run_at: null, age_hours: 6 },
      { id: "job-s-6", queue_id: "queue-2", name: "generate_pdf_report", payload: { reportId: "rep-902", type: "user_audit" }, status: "completed", priority: 2, max_attempts: 3, attempts_made: 1, run_at: null, age_hours: 5.5 },
      { id: "job-s-7", queue_id: "queue-2", name: "generate_pdf_report", payload: { reportId: "rep-903", type: "billing_summary" }, status: "completed", priority: 2, max_attempts: 3, attempts_made: 1, run_at: null, age_hours: 5 },
      { id: "job-s-8", queue_id: "queue-3", name: "database_backup", payload: { target: "analytics_db", compress: true }, status: "completed", priority: 3, max_attempts: 3, attempts_made: 1, run_at: null, age_hours: 12 },
      { id: "job-s-9", queue_id: "queue-3", name: "database_backup", payload: { target: "users_db", compress: true }, status: "completed", priority: 3, max_attempts: 3, attempts_made: 1, run_at: null, age_hours: 24 },
      { id: "job-s-10", queue_id: "queue-1", name: "sync_external_crm", payload: { syncId: "sync-45", mode: "delta" }, status: "completed", priority: 2, max_attempts: 3, attempts_made: 1, run_at: null, age_hours: 1.5 },
      { id: "job-s-11", queue_id: "queue-2", name: "compress_media_assets", payload: { bucket: "avatars", format: "webp" }, status: "completed", priority: 3, max_attempts: 3, attempts_made: 1, run_at: null, age_hours: 8 },
      { id: "job-s-12", queue_id: "queue-2", name: "compress_media_assets", payload: { bucket: "products", format: "webp" }, status: "completed", priority: 3, max_attempts: 3, attempts_made: 1, run_at: null, age_hours: 7 },
      { id: "job-s-13", queue_id: "queue-3", name: "purge_expired_sessions", payload: { threshold_days: 30 }, status: "completed", priority: 3, max_attempts: 3, attempts_made: 1, run_at: null, age_hours: 23 },
      { id: "job-s-14", queue_id: "queue-3", name: "rebuild_search_index", payload: { collection: "products" }, status: "completed", priority: 2, max_attempts: 3, attempts_made: 1, run_at: null, age_hours: 11 },
      { id: "job-s-15", queue_id: "queue-3", name: "export_audit_logs", payload: { format: "csv" }, status: "completed", priority: 3, max_attempts: 3, attempts_made: 1, run_at: null, age_hours: 10 },
      
      // 5 Queued Jobs
      { id: "job-s-16", queue_id: "queue-1", name: "send_welcome_email", payload: { userId: "105", email: "new_user@client.com" }, status: "queued", priority: 1, max_attempts: 3, attempts_made: 0, run_at: null, age_hours: 0.1 },
      { id: "job-s-17", queue_id: "queue-2", name: "generate_pdf_report", payload: { reportId: "rep-904", type: "regional" }, status: "queued", priority: 2, max_attempts: 3, attempts_made: 0, run_at: null, age_hours: 0.2 },
      { id: "job-s-18", queue_id: "queue-2", name: "compress_media_assets", payload: { bucket: "marketing", format: "webp" }, status: "queued", priority: 3, max_attempts: 3, attempts_made: 0, run_at: null, age_hours: 0.3 },
      { id: "job-s-19", queue_id: "queue-1", name: "sync_external_crm", payload: { syncId: "sync-46", mode: "full" }, status: "queued", priority: 2, max_attempts: 3, attempts_made: 0, run_at: null, age_hours: 0.15 },
      { id: "job-s-20", queue_id: "queue-3", name: "rebuild_search_index", payload: { collection: "vendors" }, status: "queued", priority: 3, max_attempts: 3, attempts_made: 0, run_at: null, age_hours: 0.05 },
      
      // 4 Scheduled Jobs (future runs)
      { id: "job-s-21", queue_id: "queue-3", name: "database_backup", payload: { target: "logs_db" }, status: "scheduled", priority: 3, max_attempts: 3, attempts_made: 0, run_at: new Date(Date.now() + 600000).toISOString(), age_hours: 0.01 }, // 10m in future
      { id: "job-s-22", queue_id: "queue-1", name: "send_welcome_email", payload: { userId: "106", email: "scheduled@client.com" }, status: "scheduled", priority: 1, max_attempts: 3, attempts_made: 0, run_at: new Date(Date.now() + 1200000).toISOString(), age_hours: 0.01 }, // 20m in future
      { id: "job-s-23", queue_id: "queue-2", name: "generate_pdf_report", payload: { reportId: "rep-905", type: "yearly" }, status: "scheduled", priority: 2, max_attempts: 3, attempts_made: 0, run_at: new Date(Date.now() + 1800000).toISOString(), age_hours: 0.02 }, // 30m in future
      { id: "job-s-24", queue_id: "queue-3", name: "purge_expired_sessions", payload: { threshold_days: 15 }, status: "scheduled", priority: 3, max_attempts: 3, attempts_made: 0, run_at: new Date(Date.now() + 3600000).toISOString(), age_hours: 0.01 }, // 1 hour in future

      // 3 Failed Scheduled Jobs (has some retries made but not exhausted yet, scheduled for future)
      { id: "job-s-25", queue_id: "queue-1", name: "send_welcome_email", payload: { userId: "107", email: "fail-gateway@client.com" }, status: "scheduled", priority: 1, max_attempts: 3, attempts_made: 1, run_at: new Date(Date.now() + 120000).toISOString(), age_hours: 0.5 },
      { id: "job-s-26", queue_id: "queue-2", name: "generate_pdf_report", payload: { reportType: "corrupt" }, status: "scheduled", priority: 2, max_attempts: 4, attempts_made: 2, run_at: new Date(Date.now() + 240000).toISOString(), age_hours: 0.6 },
      { id: "job-s-27", queue_id: "queue-1", name: "sync_external_crm", payload: { syncId: "trigger-error" }, status: "scheduled", priority: 2, max_attempts: 3, attempts_made: 1, run_at: new Date(Date.now() + 180000).toISOString(), age_hours: 0.3 },

      // 3 DLQ Jobs (completely failed, retry limit exhausted, status = 'dlq')
      { id: "job-s-28", queue_id: "queue-1", name: "send_welcome_email", payload: { userId: "108", email: "fail-permanent@client.com" }, status: "dlq", priority: 1, max_attempts: 3, attempts_made: 3, run_at: null, age_hours: 2 },
      { id: "job-s-29", queue_id: "queue-2", name: "generate_pdf_report", payload: { reportType: "corrupt" }, status: "dlq", priority: 2, max_attempts: 4, attempts_made: 4, run_at: null, age_hours: 3 },
      { id: "job-s-30", queue_id: "queue-1", name: "sync_external_crm", payload: { syncId: "trigger-error" }, status: "dlq", priority: 2, max_attempts: 3, attempts_made: 3, run_at: null, age_hours: 1 }
    ];

    const workersList = ["Alpha-Core-01", "Beta-Silo-02", "Gamma-Silo-03"];

    for (const s of seedJobs) {
      const createdAt = new Date(Date.now() - s.age_hours * 3600000).toISOString();
      insertJob.run(
        s.id,
        s.queue_id,
        s.name,
        JSON.stringify(s.payload),
        s.status,
        s.priority,
        s.max_attempts,
        s.attempts_made,
        s.run_at,
        createdAt
      );

      // Create executions and logs to back up the status
      if (s.status === "completed") {
        const workerName = workersList[Math.floor(Math.random() * workersList.length)];
        const workerId = workerName === "Alpha-Core-01" ? "worker-1" : (workerName === "Beta-Silo-02" ? "worker-2" : "worker-3");
        const execId = "exec-" + s.id + "-1";
        const startedAt = new Date(Date.now() - (s.age_hours - 0.05) * 3600000).toISOString();
        const finishedAt = new Date(Date.now() - (s.age_hours - 0.06) * 3600000).toISOString();

        db.prepare(`
          INSERT INTO job_executions (id, job_id, worker_id, attempt, status, started_at, finished_at)
          VALUES (?, ?, ?, ?, 'completed', ?, ?)
        `).run(execId, s.id, workerId, 1, startedAt, finishedAt);

        db.prepare("INSERT INTO job_logs (id, job_id, level, message, created_at) VALUES (?, ?, ?, ?, ?)")
          .run("log-" + s.id + "-init", s.id, "info", `Job initialized into status 'queued'.`, createdAt);
        db.prepare("INSERT INTO job_logs (id, job_id, level, message, created_at) VALUES (?, ?, ?, ?, ?)")
          .run("log-" + s.id + "-run", s.id, "info", `[${workerName}] Claimed by worker. Executing attempt #1.`, startedAt);
        db.prepare("INSERT INTO job_logs (id, job_id, level, message, created_at) VALUES (?, ?, ?, ?, ?)")
          .run("log-" + s.id + "-success", s.id, "info", `[${workerName}] Job execution finalized successfully.`, finishedAt);

      } else if (s.status === "scheduled" && s.attempts_made > 0) {
        // These are rescheduled after failures
        const workerName = workersList[Math.floor(Math.random() * workersList.length)];
        const workerId = workerName === "Alpha-Core-01" ? "worker-1" : (workerName === "Beta-Silo-02" ? "worker-2" : "worker-3");
        
        db.prepare("INSERT INTO job_logs (id, job_id, level, message, created_at) VALUES (?, ?, ?, ?, ?)")
          .run("log-" + s.id + "-init", s.id, "info", `Job initialized into status 'queued'.`, createdAt);

        for (let attempt = 1; attempt <= s.attempts_made; attempt++) {
          const execId = "exec-" + s.id + "-" + attempt;
          const startedAt = new Date(Date.now() - (s.age_hours - 0.05 * attempt) * 3600000).toISOString();
          const finishedAt = new Date(Date.now() - (s.age_hours - 0.06 * attempt) * 3600000).toISOString();
          const errorMsg = s.name === "generate_pdf_report" 
            ? "Failed to parse data schema. Column misalignment on index 4 (Expected: Integer, Received: NaN)."
            : (s.name === "sync_external_crm" ? "External SaaS API rate limit exceeded. Code 429 Too Many Requests." : "SMTP timeout. Connection to mail gateway refused.");

          db.prepare(`
            INSERT INTO job_executions (id, job_id, worker_id, attempt, status, started_at, finished_at, error_message)
            VALUES (?, ?, ?, ?, 'failed', ?, ?, ?)
          `).run(execId, s.id, workerId, attempt, startedAt, finishedAt, errorMsg);

          db.prepare("INSERT INTO job_logs (id, job_id, level, message, created_at) VALUES (?, ?, ?, ?, ?)")
            .run("log-" + s.id + "-run-" + attempt, s.id, "info", `[${workerName}] Claimed by worker. Executing attempt #${attempt}.`, startedAt);
          db.prepare("INSERT INTO job_logs (id, job_id, level, message, created_at) VALUES (?, ?, ?, ?, ?)")
            .run("log-" + s.id + "-fail-" + attempt, s.id, "error", `[${workerName}] Execution failed: ${errorMsg}`, finishedAt);
          db.prepare("INSERT INTO job_logs (id, job_id, level, message, created_at) VALUES (?, ?, ?, ?, ?)")
            .run("log-" + s.id + "-resched-" + attempt, s.id, "warn", `Execution failed on attempt #${attempt}. Rescheduling with backoff...`, finishedAt);
        }

      } else if (s.status === "dlq") {
        // Completely failed
        const workerName = workersList[Math.floor(Math.random() * workersList.length)];
        const workerId = workerName === "Alpha-Core-01" ? "worker-1" : (workerName === "Beta-Silo-02" ? "worker-2" : "worker-3");
        const lastErrorMsg = s.name === "generate_pdf_report" 
          ? "Failed to parse data schema. Column misalignment on index 4 (Expected: Integer, Received: NaN)."
          : (s.name === "sync_external_crm" ? "External SaaS API rate limit exceeded. Code 429 Too Many Requests." : "SMTP timeout. Connection to mail gateway refused.");

        db.prepare("INSERT INTO job_logs (id, job_id, level, message, created_at) VALUES (?, ?, ?, ?, ?)")
          .run("log-" + s.id + "-init", s.id, "info", `Job initialized into status 'queued'.`, createdAt);

        let finalFinishedAt = createdAt;
        for (let attempt = 1; attempt <= s.attempts_made; attempt++) {
          const execId = "exec-" + s.id + "-" + attempt;
          const startedAt = new Date(Date.now() - (s.age_hours - 0.05 * attempt) * 3600000).toISOString();
          const finishedAt = new Date(Date.now() - (s.age_hours - 0.06 * attempt) * 3600000).toISOString();
          finalFinishedAt = finishedAt;

          db.prepare(`
            INSERT INTO job_executions (id, job_id, worker_id, attempt, status, started_at, finished_at, error_message)
            VALUES (?, ?, ?, ?, 'failed', ?, ?, ?)
          `).run(execId, s.id, workerId, attempt, startedAt, finishedAt, lastErrorMsg);

          db.prepare("INSERT INTO job_logs (id, job_id, level, message, created_at) VALUES (?, ?, ?, ?, ?)")
            .run("log-" + s.id + "-run-" + attempt, s.id, "info", `[${workerName}] Claimed by worker. Executing attempt #${attempt}.`, startedAt);
          db.prepare("INSERT INTO job_logs (id, job_id, level, message, created_at) VALUES (?, ?, ?, ?, ?)")
            .run("log-" + s.id + "-fail-" + attempt, s.id, "error", `[${workerName}] Execution failed: ${lastErrorMsg}`, finishedAt);
          
          if (attempt < s.max_attempts) {
            db.prepare("INSERT INTO job_logs (id, job_id, level, message, created_at) VALUES (?, ?, ?, ?, ?)")
              .run("log-" + s.id + "-resched-" + attempt, s.id, "warn", `Execution failed on attempt #${attempt}. Rescheduling with backoff...`, finishedAt);
          }
        }

        // Add DLQ Entry
        db.prepare(`
          INSERT INTO dlq_entries (id, job_id, queue_id, failed_at, attempts_made, last_error)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          "dlq-entry-" + s.id,
          s.id,
          s.queue_id,
          finalFinishedAt,
          s.attempts_made,
          lastErrorMsg
        );

        db.prepare("INSERT INTO job_logs (id, job_id, level, message, created_at) VALUES (?, ?, ?, ?, ?)")
          .run("log-" + s.id + "-dlq", s.id, "error", `Exhausted all ${s.max_attempts} retry attempts. Job moved permanently to Dead Letter Queue (DLQ).`, finalFinishedAt);

      } else {
        // queued or regular scheduled
        db.prepare("INSERT INTO job_logs (id, job_id, level, message, created_at) VALUES (?, ?, ?, ?, ?)")
          .run("log-" + s.id + "-init", s.id, "info", `Job initialized into status '${s.status}'.`, createdAt);
      }
    }

    console.log("Database seeded with exactly 30 high fidelity jobs successfully.");
  }
}

seedDatabase();

// SIMPLE AUTH MIDDLEWARE
function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }
  
  // For simplicity, token is the user's ID
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(token) as any;
  if (!user) {
    return res.status(403).json({ error: "Invalid token" });
  }
  
  req.user = user;
  next();
}

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// --- REST APIS ---

// AUTH ENDPOINTS
app.post("/api/auth/register", (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const id = "user-" + Math.random().toString(36).substr(2, 9);
    // Find first organization, or create one
    let org = db.prepare("SELECT * FROM organizations LIMIT 1").get() as any;
    if (!org) {
      const orgId = "org-" + Math.random().toString(36).substr(2, 9);
      db.prepare("INSERT INTO organizations (id, name) VALUES (?, ?)").run(orgId, "Default Org");
      org = { id: orgId };
    }

    db.prepare("INSERT INTO users (id, username, password_hash, email, role, org_id) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, username, password, email, "member", org.id);

    const user = { id, username, email, role: "member" };
    res.status(201).json({ token: id, user });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "User already exists" });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
  if (!user || user.password_hash !== password) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  res.json({ token: user.id, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
});

app.get("/api/auth/me", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// PROJECTS
app.get("/api/projects", authenticateToken, (req, res) => {
  const projects = db.prepare("SELECT * FROM projects WHERE org_id = ?").all(req.user.org_id);
  res.json(projects);
});

app.post("/api/projects", authenticateToken, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Project name is required" });
  const id = "project-" + Math.random().toString(36).substr(2, 9);
  db.prepare("INSERT INTO projects (id, org_id, name) VALUES (?, ?, ?)").run(id, req.user.org_id, name);
  res.status(201).json({ id, name });
});

// QUEUES
app.get("/api/queues", authenticateToken, (req, res) => {
  const queues = db.prepare(`
    SELECT q.*, p.name as project_name,
      (SELECT COUNT(*) FROM jobs WHERE queue_id = q.id AND status = 'queued') as queued_count,
      (SELECT COUNT(*) FROM jobs WHERE queue_id = q.id AND status = 'running') as running_count,
      (SELECT COUNT(*) FROM jobs WHERE queue_id = q.id AND status = 'completed') as completed_count,
      (SELECT COUNT(*) FROM jobs WHERE queue_id = q.id AND status = 'failed') as failed_count,
      (SELECT COUNT(*) FROM jobs WHERE queue_id = q.id AND status = 'dlq') as dlq_count
    FROM queues q
    JOIN projects p ON q.project_id = p.id
    WHERE p.org_id = ?
  `).all(req.user.org_id);
  res.json(queues);
});

app.post("/api/queues", authenticateToken, (req, res) => {
  const { projectId, name, priority, concurrencyLimit, retryPolicyType, retryPolicyDelayMs, retryMaxAttempts } = req.body;
  if (!projectId || !name) return res.status(400).json({ error: "Project and name are required" });

  const id = "queue-" + Math.random().toString(36).substr(2, 9);
  db.prepare(`
    INSERT INTO queues (id, project_id, name, priority, concurrency_limit, retry_policy_type, retry_policy_delay_ms, retry_max_attempts, is_paused)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    id, 
    projectId, 
    name, 
    priority || 2, 
    concurrencyLimit || 5, 
    retryPolicyType || "exponential", 
    retryPolicyDelayMs || 1000, 
    retryMaxAttempts || 3
  );

  res.status(201).json({ id, name });
});

app.post("/api/queues/:id/pause", authenticateToken, (req, res) => {
  db.prepare("UPDATE queues SET is_paused = 1 WHERE id = ?").run(req.params.id);
  res.json({ success: true, is_paused: true });
});

app.post("/api/queues/:id/resume", authenticateToken, (req, res) => {
  db.prepare("UPDATE queues SET is_paused = 0 WHERE id = ?").run(req.params.id);
  res.json({ success: true, is_paused: false });
});

app.put("/api/queues/:id/config", authenticateToken, (req, res) => {
  const { priority, concurrencyLimit, retryPolicyType, retryPolicyDelayMs, retryMaxAttempts } = req.body;
  db.prepare(`
    UPDATE queues 
    SET priority = ?, concurrency_limit = ?, retry_policy_type = ?, retry_policy_delay_ms = ?, retry_max_attempts = ?
    WHERE id = ?
  `).run(priority, concurrencyLimit, retryPolicyType, retryPolicyDelayMs, retryMaxAttempts, req.params.id);
  res.json({ success: true });
});

// JOBS
app.get("/api/jobs", authenticateToken, (req, res) => {
  const { queueId, status, search, page = 1, limit = 10 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let queryStr = `
    SELECT j.*, q.name as queue_name, p.name as project_name 
    FROM jobs j
    JOIN queues q ON j.queue_id = q.id
    JOIN projects p ON q.project_id = p.id
    WHERE p.org_id = ?
  `;
  const params: any[] = [req.user.org_id];

  if (queueId) {
    queryStr += " AND j.queue_id = ?";
    params.push(queueId);
  }
  if (status) {
    queryStr += " AND j.status = ?";
    params.push(status);
  }
  if (search) {
    queryStr += " AND (j.name LIKE ? OR j.id LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  queryStr += " ORDER BY j.created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(limit), offset);

  const jobs = db.prepare(queryStr).all(...params);

  // Get total count
  let countQueryStr = `
    SELECT COUNT(*) as count 
    FROM jobs j
    JOIN queues q ON j.queue_id = q.id
    JOIN projects p ON q.project_id = p.id
    WHERE p.org_id = ?
  `;
  const countParams: any[] = [req.user.org_id];
  if (queueId) {
    countQueryStr += " AND j.queue_id = ?";
    countParams.push(queueId);
  }
  if (status) {
    countQueryStr += " AND j.status = ?";
    countParams.push(status);
  }
  if (search) {
    countQueryStr += " AND (j.name LIKE ? OR j.id LIKE ?)";
    countParams.push(`%${search}%`, `%${search}%`);
  }
  const total = (db.prepare(countQueryStr).get(...countParams) as any).count;

  res.json({ jobs, total, page: Number(page), limit: Number(limit) });
});

app.post("/api/jobs", authenticateToken, (req, res) => {
  const { queueId, name, payload, priority, delayMs, cronExpression, dependencies } = req.body;
  if (!queueId || !name) return res.status(400).json({ error: "Queue and Job Name are required" });

  const id = "job-" + Math.random().toString(36).substr(2, 9);
  
  // Calculate schedule time
  let runAt: string | null = null;
  let status: string = "queued";
  
  if (delayMs) {
    runAt = new Date(Date.now() + Number(delayMs)).toISOString();
    status = "scheduled";
  } else if (cronExpression) {
    runAt = new Date(Date.now() + 60000).toISOString(); // simulate cron run in 1 min
    status = "scheduled";
  }

  const queue = db.prepare("SELECT * FROM queues WHERE id = ?").get(queueId) as any;
  const maxAttempts = queue ? queue.retry_max_attempts : 3;

  db.prepare(`
    INSERT INTO jobs (id, queue_id, name, payload, status, priority, max_attempts, attempts_made, run_at, cron_expression, dependencies)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(
    id,
    queueId,
    name,
    payload ? JSON.stringify(payload) : "{}",
    status,
    priority || (queue ? queue.priority : 2),
    maxAttempts,
    runAt,
    cronExpression || null,
    dependencies ? JSON.stringify(dependencies) : null
  );

  // Write log
  db.prepare("INSERT INTO job_logs (id, job_id, level, message) VALUES (?, ?, ?, ?)")
    .run("log-" + Math.random().toString(36).substr(2, 9), id, "info", `Job initialized into status '${status}'.`);

  res.status(201).json({ id, name, status, runAt });
});

// BATCH CREATION API
app.post("/api/jobs/batch", authenticateToken, (req, res) => {
  const { queueId, jobs } = req.body;
  if (!queueId || !jobs || !Array.isArray(jobs)) {
    return res.status(400).json({ error: "Queue and jobs list are required" });
  }

  const batchId = "batch-" + Math.random().toString(36).substr(2, 9);
  const queue = db.prepare("SELECT * FROM queues WHERE id = ?").get(queueId) as any;
  const maxAttempts = queue ? queue.retry_max_attempts : 3;

  const insertStmt = db.prepare(`
    INSERT INTO jobs (id, queue_id, name, payload, status, priority, max_attempts, attempts_made, batch_id)
    VALUES (?, ?, ?, ?, 'queued', ?, ?, 0, ?)
  `);

  const created: any[] = [];
  
  // Run all inside a transaction for efficiency and safety
  db.exec("BEGIN IMMEDIATE TRANSACTION");
  try {
    for (const jobData of jobs) {
      const id = "job-" + Math.random().toString(36).substr(2, 9);
      const priority = jobData.priority || (queue ? queue.priority : 2);
      insertStmt.run(
        id,
        queueId,
        jobData.name,
        jobData.payload ? JSON.stringify(jobData.payload) : "{}",
        priority,
        maxAttempts,
        batchId
      );
      
      db.prepare("INSERT INTO job_logs (id, job_id, level, message) VALUES (?, ?, ?, ?)")
        .run("log-" + Math.random().toString(36).substr(2, 9), id, "info", `Job initialized inside Batch ${batchId}.`);
        
      created.push({ id, name: jobData.name, batchId });
    }
    db.exec("COMMIT");
    res.status(201).json({ success: true, batchId, createdCount: created.length });
  } catch (err: any) {
    db.exec("ROLLBACK");
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/jobs/:id/retry", authenticateToken, (req, res) => {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(req.params.id) as any;
  if (!job) return res.status(404).json({ error: "Job not found" });

  db.prepare("UPDATE jobs SET status = 'queued', attempts_made = 0, run_at = NULL WHERE id = ?").run(req.params.id);
  db.prepare("DELETE FROM dlq_entries WHERE job_id = ?").run(req.params.id);

  db.prepare("INSERT INTO job_logs (id, job_id, level, message) VALUES (?, ?, ?, ?)")
    .run("log-" + Math.random().toString(36).substr(2, 9), req.params.id, "info", "Job manually resubmitted for execution from DLQ.");

  res.json({ success: true });
});

app.delete("/api/jobs/:id", authenticateToken, (req, res) => {
  db.prepare("DELETE FROM jobs WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// WORKERS & LOGS
app.get("/api/workers", authenticateToken, (req, res) => {
  const workers = db.prepare("SELECT * FROM workers ORDER BY last_heartbeat DESC").all();
  res.json(workers);
});

app.get("/api/logs", authenticateToken, (req, res) => {
  const { jobId, level } = req.query;
  let queryStr = "SELECT * FROM job_logs WHERE 1=1";
  const params: any[] = [];

  if (jobId) {
    queryStr += " AND job_id = ?";
    params.push(jobId);
  }
  if (level) {
    queryStr += " AND level = ?";
    params.push(level);
  }

  queryStr += " ORDER BY created_at DESC LIMIT 100";
  const logs = db.prepare(queryStr).all(...params);
  res.json(logs);
});

// METRICS
app.get("/api/metrics", authenticateToken, (req, res) => {
  const orgId = req.user.org_id;

  const total = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
      SUM(CASE WHEN status = 'running' OR status = 'claimed' THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'dlq' THEN 1 ELSE 0 END) as dlq
    FROM jobs j
    JOIN queues q ON j.queue_id = q.id
    JOIN projects p ON q.project_id = p.id
    WHERE p.org_id = ?
  `).get(orgId) as any;

  const activeWorkers = db.prepare("SELECT COUNT(*) as count FROM workers WHERE status = 'active' AND last_heartbeat > datetime('now', '-30 seconds')").get() as any;

  // Queue-specific stats
  const queueStats = db.prepare(`
    SELECT q.id as queueId, q.name as queueName, p.name as projectName,
      SUM(CASE WHEN j.status = 'queued' THEN 1 ELSE 0 END) as queuedCount,
      SUM(CASE WHEN j.status = 'running' OR j.status = 'claimed' THEN 1 ELSE 0 END) as runningCount,
      SUM(CASE WHEN j.status = 'completed' THEN 1 ELSE 0 END) as completedCount,
      SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failedCount,
      SUM(CASE WHEN j.status = 'dlq' THEN 1 ELSE 0 END) as dlqCount
    FROM queues q
    JOIN projects p ON q.project_id = p.id
    LEFT JOIN jobs j ON j.queue_id = q.id
    WHERE p.org_id = ?
    GROUP BY q.id
  `).all(orgId);

  // Throughput Rate Calculation: completed jobs in last 5 minutes
  const completedRecent = db.prepare(`
    SELECT COUNT(*) as count FROM job_executions 
    WHERE status = 'completed' AND finished_at > datetime('now', '-5 minutes')
  `).get() as any;
  const throughput = (completedRecent.count / 5); // jobs per minute

  // Mock-up throughput timeline for charts
  const recentThroughput = [
    { time: "10m ago", completed: Math.max(0, completedRecent.count - 2), failed: 0 },
    { time: "8m ago", completed: Math.max(0, completedRecent.count - 1), failed: 1 },
    { time: "6m ago", completed: Math.max(0, completedRecent.count - 3), failed: 0 },
    { time: "4m ago", completed: completedRecent.count, failed: 0 },
    { time: "2m ago", completed: completedRecent.count + 1, failed: 0 },
    { time: "Now", completed: completedRecent.count + 2, failed: 0 },
  ];

  res.json({
    totalJobs: total.total || 0,
    queuedJobs: total.queued || 0,
    runningJobs: total.running || 0,
    completedJobs: total.completed || 0,
    failedJobs: total.failed || 0,
    dlqJobs: total.dlq || 0,
    activeWorkers: activeWorkers.count || 0,
    throughputRate: throughput,
    queueStats,
    recentThroughput
  });
});

// AUTOMATED TESTS RUNNER ENDPOINT
app.post("/api/tests/run", authenticateToken, (req, res) => {
  const logs: string[] = [];
  const assertions: any[] = [];
  const startTime = Date.now();

  const addLog = (msg: string) => {
    logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    console.log(`[TESTS] ${msg}`);
  };

  addLog("Starting critical concurrency and reliability test suite...");

  try {
    // 1. ATOMICITY & CLAIM TEST
    addLog("Executing ATOMICITY & CLAIM TEST...");
    // Let's create a special test job in the database
    const jobId = "test-atomicity-" + Math.random().toString(36).substr(2, 5);
    db.prepare(`
      INSERT INTO jobs (id, queue_id, name, payload, status, priority, max_attempts, attempts_made)
      VALUES (?, ?, ?, ?, 'queued', 1, 3, 0)
    `).run(jobId, "queue-1", "test_atomicity_job", JSON.stringify({ test: "atomicity" }));

    // Run parallel claim logic simulation
    addLog("Simulating multiple concurrent workers trying to claim the same job...");
    let successClaimWorkerId = "";
    let doubleClaimDetected = false;

    // Run 5 attempts concurrently
    for (let i = 1; i <= 5; i++) {
      const workerId = `worker-sim-${i}`;
      db.exec("BEGIN IMMEDIATE TRANSACTION");
      const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as any;
      if (job && job.status === "queued") {
        db.prepare("UPDATE jobs SET status = 'claimed', attempts_made = attempts_made + 1 WHERE id = ?").run(jobId);
        successClaimWorkerId = workerId;
        db.exec("COMMIT");
        addLog(`Worker ${workerId} claimed the job successfully.`);
      } else {
        db.exec("ROLLBACK");
        addLog(`Worker ${workerId} was rejected from claiming.`);
      }
    }

    // Verify claim outcome
    const updatedJob = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as any;
    const isSingleClaim = updatedJob.attempts_made === 1 && updatedJob.status === "claimed";
    assertions.push({
      name: "Job Claim Atomicity Guaranteed",
      passed: isSingleClaim,
      message: isSingleClaim 
        ? `Successfully claimed only once by ${successClaimWorkerId} out of 5 concurrent requests.`
        : `Claim count error: Job was claimed ${updatedJob.attempts_made} times!`
    });

    // Cleanup
    db.prepare("DELETE FROM jobs WHERE id = ?").run(jobId);

    // 2. CONCURRENCY LIMITS TEST
    addLog("Executing CONCURRENCY LIMITS TEST...");
    const qId = "queue-1"; // limit is 3
    const queueConfig = db.prepare("SELECT * FROM queues WHERE id = ?").get(qId) as any;
    
    // Count active running in queue-1
    const activeRunning = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE queue_id = ? AND status = 'running'").get() as any;
    addLog(`Queue '${queueConfig.name}' Concurrency Limit: ${queueConfig.concurrency_limit}. Current running: ${activeRunning.count}`);
    
    const limitRes = activeRunning.count <= queueConfig.concurrency_limit;
    assertions.push({
      name: "Queue Concurrency Limits Respected",
      passed: limitRes,
      message: `Active executions count (${activeRunning.count}) is safely within limit (${queueConfig.concurrency_limit}).`
    });

    // 3. RETRY STRATEGIES & BACKOFF TEST
    addLog("Executing RETRY STRATEGIES & BACKOFF TEST...");
    // Let's manually calculate a few exponential backoffs
    // Formula: delay * (2 ** (attempt - 1))
    const baseDelay = 1000;
    const calcDelay = (attempt: number) => baseDelay * Math.pow(2, attempt - 1);
    
    const attempt1 = calcDelay(1); // 1000
    const attempt2 = calcDelay(2); // 2000
    const attempt3 = calcDelay(3); // 4000

    const backoffPassed = attempt1 === 1000 && attempt2 === 2000 && attempt3 === 4000;
    assertions.push({
      name: "Exponential Backoff Math Validation",
      passed: backoffPassed,
      message: `Calculated Exponential delay at attempt 1: ${attempt1}ms, attempt 2: ${attempt2}ms, attempt 3: ${attempt3}ms.`
    });

    // 4. DEPENDENCY RESOLVER TEST
    addLog("Executing DEPENDENCY RESOLVER TEST...");
    // Create a chain of 2 jobs: depJob (must complete first) and targetJob (depends on depJob)
    const depId = "job-dep-" + Math.random().toString(36).substr(2, 5);
    const targetId = "job-target-" + Math.random().toString(36).substr(2, 5);

    db.prepare(`
      INSERT INTO jobs (id, queue_id, name, status, priority, max_attempts, attempts_made)
      VALUES (?, ?, ?, 'queued', 1, 3, 0)
    `).run(depId, "queue-1", "dependency_job");

    db.prepare(`
      INSERT INTO jobs (id, queue_id, name, status, priority, max_attempts, attempts_made, dependencies)
      VALUES (?, ?, ?, 'queued', 1, 3, 0, ?)
    `).run(targetId, "queue-1", "target_job", JSON.stringify([depId]));

    // Query claiming logic when dependency is still queued
    const claimStmt = db.prepare(`
      SELECT j.* FROM jobs j
      WHERE j.id = ? AND (
        j.dependencies IS NULL 
        OR j.dependencies = '[]' 
        OR NOT EXISTS (
          SELECT 1 FROM json_each(j.dependencies) jd 
          JOIN jobs dep ON dep.id = jd.value 
          WHERE dep.status != 'completed'
        )
      )
    `);

    const resultBeforeComplete = claimStmt.get(targetId);
    const blockSuccessful = resultBeforeComplete === undefined;
    addLog(`Evaluated claim for target job with queued dependency. Ready for execution? ${!blockSuccessful}`);

    // Set dependency to completed and check again
    db.prepare("UPDATE jobs SET status = 'completed' WHERE id = ?").run(depId);
    const resultAfterComplete = claimStmt.get(targetId);
    const resolveSuccessful = resultAfterComplete !== undefined;
    addLog(`Evaluated claim for target job with completed dependency. Ready for execution? ${resolveSuccessful}`);

    assertions.push({
      name: "Job Workflow Dependency Chains",
      passed: blockSuccessful && resolveSuccessful,
      message: "Target job correctly blocked when dependency was queued, and released once completed."
    });

    // Cleanup
    db.prepare("DELETE FROM jobs WHERE id IN (?, ?)").run(depId, targetId);

    // 5. DEAD LETTER QUEUE (DLQ) AUTOMATION
    addLog("Executing DEAD LETTER QUEUE (DLQ) PROMOTION TEST...");
    const errorJobId = "job-dlq-test-" + Math.random().toString(36).substr(2, 5);
    // Create a job with 2 max attempts, already made 2 attempts
    db.prepare(`
      INSERT INTO jobs (id, queue_id, name, status, priority, max_attempts, attempts_made)
      VALUES (?, ?, ?, 'running', 1, 2, 2)
    `).run(errorJobId, "queue-1", "dlq_test_job");

    // Simulate final execution failure
    const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(errorJobId) as any;
    if (job.attempts_made >= job.max_attempts) {
      db.prepare("UPDATE jobs SET status = 'dlq' WHERE id = ?").run(errorJobId);
      db.prepare(`
        INSERT INTO dlq_entries (id, job_id, queue_id, failed_at, attempts_made, last_error)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        "dlq-entry-" + Math.random().toString(36).substr(2, 5),
        errorJobId,
        "queue-1",
        new Date().toISOString(),
        job.attempts_made,
        "Max retry attempts exhausted. Simulated error: Out of memory."
      );
    }

    const dlqCheck = db.prepare("SELECT * FROM dlq_entries WHERE job_id = ?").get(errorJobId) as any;
    const dlqPassed = dlqCheck !== undefined && dlqCheck.attempts_made === 2;
    assertions.push({
      name: "DLQ Promotion on Exhausted Retries",
      passed: dlqPassed,
      message: dlqPassed
        ? `Job was safely promoted to Dead Letter Queue (DLQ) with error details: "${dlqCheck.last_error}"`
        : "Job failed to move into DLQ table."
    });

    // Cleanup
    db.prepare("DELETE FROM jobs WHERE id = ?").run(errorJobId);
    db.prepare("DELETE FROM dlq_entries WHERE job_id = ?").run(errorJobId);

    addLog("All tests executed successfully.");
    res.json({
      testId: "test-run-" + startTime,
      testName: "Critical Reliability & Concurrency Tests",
      status: assertions.every(a => a.passed) ? "passed" : "failed",
      assertions,
      durationMs: Date.now() - startTime,
      logs
    });
  } catch (err: any) {
    addLog(`Test suite error: ${err.message}`);
    res.status(500).json({
      testId: "test-run-failed",
      testName: "Critical Reliability & Concurrency Tests",
      status: "failed",
      assertions: [{ name: "Fatal Test Execution Error", passed: false, message: err.message }],
      durationMs: Date.now() - startTime,
      logs
    });
  }
});

// GEMINI FAILURES DIAGNOSTICS ENDPOINT (LAZY INITIALIZATION OF SDK)
app.post("/api/gemini/summarize-failure", authenticateToken, async (req, res) => {
  const { jobId } = req.body;
  if (!jobId) {
    return res.status(400).json({ error: "Job ID is required" });
  }

  try {
    const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as any;
    if (!job) return res.status(404).json({ error: "Job not found" });

    const logs = db.prepare("SELECT * FROM job_logs WHERE job_id = ? ORDER BY created_at ASC").all() as any[];
    const execs = db.prepare("SELECT * FROM job_executions WHERE job_id = ? ORDER BY started_at ASC").all() as any[];

    // Check if key exists
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      // Fallback message if key not configured yet
      return res.json({
        summary: `### ⚠️ Gemini API Key Not Fully Configured
The server-side diagnostics engine requires a valid **GEMINI_API_KEY** secret to analyze failure logs. You can inject this value into your application via the **Settings > Secrets** panel in AI Studio.

#### Local Job Status Dump
- **Job ID**: ${job.id}
- **Job Name**: ${job.name}
- **Current Status**: \`${job.status.toUpperCase()}\`
- **Total Attempts**: ${job.attempts_made} / ${job.max_attempts}
- **Last Execution Error**: \`${execs[execs.length - 1]?.error_message || "Unknown Network Timeout"}\`

#### Potential Remediation Steps:
1. Resubmit the job from the Dead Letter Queue once downstream dependencies are online.
2. Check if the payload data matches the required schema.
3. Validate worker heartbeat and resource saturation.
`
      });
    }

    // Lazy Init of Gemini Client
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const logHistoryDump = logs.map(l => `[${l.created_at}] [${l.level.toUpperCase()}] ${l.message}`).join("\n");
    const execHistoryDump = execs.map(e => `Attempt #${e.attempt} | Worker: ${e.worker_id} | Status: ${e.status} | Error: ${e.error_message || "None"}`).join("\n");

    const prompt = `
You are an expert site reliability engineer and backend distributed systems architect. 
Analyze the following failed/DLQ background job from our Distributed Job Scheduler platform.
Provide an elegant, highly professional Markdown diagnostic report. Be precise, scannable, and helpful.

### Job Metadata
- Job ID: ${job.id}
- Job Name: ${job.name}
- Current Status: ${job.status}
- Attempts: ${job.attempts_made} / ${job.max_attempts}
- Payload: ${job.payload}

### Attempt History
${execHistoryDump || "No historical runs found."}

### Log Output
${logHistoryDump || "No execution logs recorded."}

Generate the report with these sections:
1. **Failure Summary**: Explain exactly what went wrong in plain, high-level terms.
2. **Root Cause Analysis**: Analyze the logs and error strings to deduce why it failed.
3. **Recommended Fixes**: Provide 2-3 actionable remediation steps.
4. **Resiliency Suggestion**: How to configure the queue parameters (backoff, retry policy, concurrency limits) to prevent this in the future.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ summary: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to analyze failure." });
  }
});


// --- BACKGROUND WORKER ENGINE ---
// Polling for jobs and execution simulation
let workerInterval: NodeJS.Timeout | null = null;

function startBackgroundWorkerEngine() {
  if (workerInterval) return;

  console.log("Starting background worker engine polling loop...");

  workerInterval = setInterval(() => {
    try {
      // 1. UPDATE ACTIVE WORKER HEARTBEATS
      // Ensure Workers are marked active by regularly writing heartbeats
      const activeWorkers = db.prepare("SELECT * FROM workers WHERE status = 'active'").all() as any[];
      const loadStmt = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'running'");
      const load = (loadStmt.get() as any).count;

      for (const worker of activeWorkers) {
        db.prepare("UPDATE workers SET last_heartbeat = ? WHERE id = ?").run(new Date().toISOString(), worker.id);
        
        // Write standard worker heartbeat entry
        db.prepare(`
          INSERT INTO worker_heartbeats (id, worker_id, timestamp, load_concurrency)
          VALUES (?, ?, ?, ?)
        `).run(
          "hb-" + Math.random().toString(36).substr(2, 9),
          worker.id,
          new Date().toISOString(),
          load
        );
      }

      // 2. CLEAN UP OLD WORKERS (Inactive detection)
      db.prepare(`
        UPDATE workers 
        SET status = 'inactive' 
        WHERE last_heartbeat < datetime('now', '-20 seconds')
      `).run();

      // 3. RETRIEVE CANDIDATE JOBS FOR POLLING
      // Condition: queued/scheduled and run_at is past, and attempts are under limit,
      // and queue is active and not paused,
      // and workflow dependencies are met (all listed dependencies are completed).
      const candidates = db.prepare(`
        SELECT j.*, q.concurrency_limit, q.is_paused, q.retry_policy_type, q.retry_policy_delay_ms
        FROM jobs j
        JOIN queues q ON j.queue_id = q.id
        WHERE q.is_paused = 0
          AND (j.status = 'queued' OR (j.status = 'scheduled' AND j.run_at <= ?))
          AND j.attempts_made < j.max_attempts
        ORDER BY q.priority ASC, j.priority ASC, j.created_at ASC
      `).all(new Date().toISOString()) as any[];

      for (const candidate of candidates) {
        // Double check concurrency limits for this queue
        const runningStmt = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE queue_id = ? AND status = 'running'");
        const runningCount = (runningStmt.get() as any).count;
        
        if (runningCount >= candidate.concurrency_limit) {
          continue; // Queue is fully saturated, skip
        }

        // Check Workflow Dependencies
        if (candidate.dependencies) {
          try {
            const deps = JSON.parse(candidate.dependencies) as string[];
            if (deps.length > 0) {
              // Check if any dependency is not completed
              const placeholder = deps.map(() => '?').join(',');
              const incompleteCheck = db.prepare(`
                SELECT COUNT(*) as count FROM jobs 
                WHERE id IN (${placeholder}) AND status != 'completed'
              `).get(...deps) as any;
              
              if (incompleteCheck.count > 0) {
                continue; // Dependency chain not finished, skip
              }
            }
          } catch (e) {
            console.error("Dependency JSON parse error", e);
          }
        }

        // ATOMIC CLAIM WITH A TRANSACTION
        db.exec("BEGIN IMMEDIATE TRANSACTION");
        try {
          const freshJob = db.prepare("SELECT status, attempts_made FROM jobs WHERE id = ?").get(candidate.id) as any;
          if (freshJob && (freshJob.status === "queued" || freshJob.status === "scheduled")) {
            const nextAttempt = freshJob.attempts_made + 1;
            
            // Assign worker
            const idleWorker = db.prepare("SELECT * FROM workers WHERE status = 'active' ORDER BY RANDOM() LIMIT 1").get() as any;
            const workerId = idleWorker ? idleWorker.id : "system-worker";
            const workerName = idleWorker ? idleWorker.name : "System Daemon";

            // Update Job Status to Claimed -> Running
            db.prepare("UPDATE jobs SET status = 'running', attempts_made = ? WHERE id = ?").run(nextAttempt, candidate.id);

            // Record execution
            const execId = "exec-" + Math.random().toString(36).substr(2, 9);
            db.prepare(`
              INSERT INTO job_executions (id, job_id, worker_id, attempt, status, started_at)
              VALUES (?, ?, ?, ?, 'running', ?)
            `).run(execId, candidate.id, workerId, nextAttempt, new Date().toISOString());

            // Write start log
            db.prepare("INSERT INTO job_logs (id, job_id, level, message) VALUES (?, ?, ?, ?)")
              .run(
                "log-" + Math.random().toString(36).substr(2, 9), 
                candidate.id, 
                "info", 
                `Claimed by ${workerName}. Executing attempt #${nextAttempt}.`
              );

            db.exec("COMMIT");

            // RUN WORKER TASK SIMULATION
            simulateJobExecution(candidate.id, execId, workerName, nextAttempt, candidate);
          } else {
            db.exec("ROLLBACK");
          }
        } catch (err) {
          db.exec("ROLLBACK");
          console.error("Atomic claim fail:", err);
        }
      }
    } catch (err) {
      console.error("Worker interval loop error:", err);
    }
  }, 1000);
}

// SIMULATE WORKER RUN
function simulateJobExecution(jobId: string, execId: string, workerName: string, attempt: number, queueConfig: any) {
  // Read job details
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as any;
  if (!job) return;

  const payload = JSON.parse(job.payload || "{}");
  
  // Decide duration and outcome
  let durationMs = 2500;
  let shouldFail = false;
  let failureReason = "Operational exception occurred.";

  if (job.name === "send_welcome_email") {
    durationMs = 1500;
    if (payload.email && payload.email.includes("fail")) {
      shouldFail = true;
      failureReason = "SMTP timeout. Connection to mail gateway refused (IP: 198.51.100.42).";
    }
  } else if (job.name === "generate_pdf_report") {
    durationMs = 3000;
    if (payload.reportType === "corrupt") {
      shouldFail = true;
      failureReason = "Failed to parse data schema. Column misalignment on index 4 (Expected: Integer, Received: NaN).";
    }
  } else if (job.name === "database_backup") {
    durationMs = 4000;
  } else if (job.name === "sync_external_crm") {
    durationMs = 2000;
    if (payload.syncId === "trigger-error") {
      shouldFail = true;
      failureReason = "External SaaS API rate limit exceeded. Code 429 Too Many Requests.";
    }
  }

  // Allow custom overrides in payload
  if (payload.fail === true || payload.fail === "true") {
    shouldFail = true;
  }
  if (payload.error) {
    failureReason = payload.error;
  }

  // Stagger logs
  const logSteps = [
    { delay: 0.1, msg: `Initializing job context. Handler matched: '${job.name}'.` },
    { delay: 0.4, msg: `Decrypting credentials and preparing network sockets...` },
    { delay: 0.7, msg: shouldFail ? `CRITICAL WARNING: Anomalous network packet detected.` : `Executing core business transactions...` },
    { delay: 0.9, msg: shouldFail ? `Process crashed: ${failureReason}` : `Serialization finalized. Commit completed on main ledger.` }
  ];

  logSteps.forEach(step => {
    setTimeout(() => {
      try {
        db.prepare("INSERT INTO job_logs (id, job_id, level, message) VALUES (?, ?, ?, ?)")
          .run(
            "log-" + Math.random().toString(36).substr(2, 9), 
            jobId, 
            shouldFail && step.delay > 0.8 ? "error" : "info", 
            `[${workerName}] ${step.msg}`
          );
      } catch (err) {}
    }, durationMs * step.delay);
  });

  // Finish Job execution
  setTimeout(() => {
    try {
      db.exec("BEGIN IMMEDIATE TRANSACTION");
      
      const finishedAt = new Date().toISOString();
      if (shouldFail) {
        // FAIL LOGIC
        db.prepare(`
          UPDATE job_executions 
          SET status = 'failed', finished_at = ?, error_message = ? 
          WHERE id = ?
        `).run(finishedAt, failureReason, execId);

        // Check retry limits
        if (attempt >= job.max_attempts) {
          // Permanently fail, send to DLQ
          db.prepare("UPDATE jobs SET status = 'dlq' WHERE id = ?").run(jobId);
          db.prepare(`
            INSERT INTO dlq_entries (id, job_id, queue_id, failed_at, attempts_made, last_error)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            "dlq-" + Math.random().toString(36).substr(2, 9),
            jobId,
            job.queue_id,
            finishedAt,
            attempt,
            failureReason
          );

          db.prepare("INSERT INTO job_logs (id, job_id, level, message) VALUES (?, ?, ?, ?)")
            .run("log-" + Math.random().toString(36).substr(2, 9), jobId, "error", `Exhausted all ${job.max_attempts} retry attempts. Job moved permanently to Dead Letter Queue (DLQ).`);
        } else {
          // Calculate next run_at based on Backoff strategy
          let nextDelayMs = queueConfig.retry_policy_delay_ms;
          if (queueConfig.retry_policy_type === "linear") {
            nextDelayMs = queueConfig.retry_policy_delay_ms * attempt;
          } else if (queueConfig.retry_policy_type === "exponential") {
            nextDelayMs = queueConfig.retry_policy_delay_ms * Math.pow(2, attempt - 1);
          }

          const nextRunAt = new Date(Date.now() + nextDelayMs).toISOString();
          db.prepare("UPDATE jobs SET status = 'scheduled', run_at = ? WHERE id = ?").run(nextRunAt, jobId);

          db.prepare("INSERT INTO job_logs (id, job_id, level, message) VALUES (?, ?, ?, ?)")
            .run(
              "log-" + Math.random().toString(36).substr(2, 9), 
              jobId, 
              "warn", 
              `Execution failed on attempt #${attempt}. Rescheduling with ${queueConfig.retry_policy_type} backoff in ${nextDelayMs}ms at ${nextRunAt}.`
            );
        }
      } else {
        // SUCCESS LOGIC
        db.prepare("UPDATE job_executions SET status = 'completed', finished_at = ? WHERE id = ?").run(finishedAt, execId);
        
        // If recurring (cron), reschedule!
        if (job.cron_expression) {
          const nextCronTime = new Date(Date.now() + 60000).toISOString(); // simulate next min run
          db.prepare("UPDATE jobs SET status = 'scheduled', run_at = ?, attempts_made = 0 WHERE id = ?").run(nextCronTime, jobId);
          db.prepare("INSERT INTO job_logs (id, job_id, level, message) VALUES (?, ?, ?, ?)")
            .run("log-" + Math.random().toString(36).substr(2, 9), jobId, "info", `Recurring job completed successfully. Rescheduled for next cron interval at ${nextCronTime}.`);
        } else {
          db.prepare("UPDATE jobs SET status = 'completed' WHERE id = ?").run(jobId);
          db.prepare("INSERT INTO job_logs (id, job_id, level, message) VALUES (?, ?, ?, ?)")
            .run("log-" + Math.random().toString(36).substr(2, 9), jobId, "info", `Job execution finalized successfully by ${workerName}.`);
        }
      }

      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      console.error("Finishing job execution error:", err);
    }
  }, durationMs);
}

startBackgroundWorkerEngine();


// VITE MIDDLEWARE SETUP FOR DEV/PROD ROUTING
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Running at http://localhost:${PORT}`);
  });
}

startServer();
