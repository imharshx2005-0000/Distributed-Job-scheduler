import { useState } from "react";
import { BookOpen, Database, GitMerge, FileText, Settings, ShieldAlert, Zap } from "lucide-react";

export default function DocumentationViewer() {
  const [activeTab, setActiveTab] = useState<'architecture' | 'er' | 'api' | 'decisions'>('architecture');

  return (
    <div id="documentation-viewer" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 bg-gray-50/50 p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-gray-900 tracking-tight flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          Technical Specifications & System Design
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Full documentation of the Distributed Job Scheduler architecture, relational database model, REST endpoints, and engineering decisions.
        </p>

        {/* Tab navigation */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            id="tab-doc-architecture"
            onClick={() => setActiveTab('architecture')}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'architecture'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <GitMerge className="w-3.5 h-3.5" />
            System Architecture
          </button>
          <button
            id="tab-doc-er"
            onClick={() => setActiveTab('er')}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'er'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            ER Diagram & Schema
          </button>
          <button
            id="tab-doc-api"
            onClick={() => setActiveTab('api')}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'api'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            REST API Documentation
          </button>
          <button
            id="tab-doc-decisions"
            onClick={() => setActiveTab('decisions')}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'decisions'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Design Decisions & Trade-offs
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* ARCHITECTURE TAB */}
        {activeTab === 'architecture' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">High-Availability Job Execution Pipeline</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                The platform is designed around a decoupled, decentralized layout. The REST API layers accept job submissions, record metadata immediately to the durable SQL database, and return a lightweight acknowledgment back to the user. Independently, highly concurrent Worker Nodes poll the database to atomically lock and process workloads.
              </p>
            </div>

            {/* Graphical representation of the architecture */}
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex flex-col items-center">
              <span className="text-xs font-mono text-gray-400 mb-4">SYSTEM INTERACTION FLOW</span>
              <div className="w-full max-w-2xl space-y-4 font-mono text-xs text-center text-gray-800">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-lg text-emerald-800">
                    <span className="font-semibold">REST API Client</span>
                    <p className="text-[10px] text-emerald-600 mt-1">Dispatches JSON jobs</p>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-300 p-3 rounded-lg text-indigo-800">
                    <span className="font-semibold">Web Dashboard</span>
                    <p className="text-[10px] text-indigo-600 mt-1">Renders system metrics</p>
                  </div>
                  <div className="bg-purple-50 border border-purple-300 p-3 rounded-lg text-purple-800">
                    <span className="font-semibold">Gemini Diagnostics</span>
                    <p className="text-[10px] text-purple-600 mt-1">Analyzes DLQ crash dumps</p>
                  </div>
                </div>

                <div className="text-gray-400">⬇ HTTP Requests / REST Routing ⬇</div>

                <div className="bg-gray-800 text-white p-4 rounded-xl shadow-md border border-gray-700">
                  <span className="font-semibold text-sm block">Express API Controller (server.ts)</span>
                  <div className="grid grid-cols-2 gap-4 mt-2 text-[10px] text-gray-300">
                    <div className="border border-gray-700 p-2 rounded bg-gray-900/50">
                      <strong>Durable SQL Transaction Layer</strong>
                      <p className="mt-1">Atomic SELECT & UPDATE using SQL BEGIN IMMEDIATE transaction boundaries</p>
                    </div>
                    <div className="border border-gray-700 p-2 rounded bg-gray-900/50">
                      <strong>Worker Pool Controller</strong>
                      <p className="mt-1">Tracks heartbeat timings, concurrency loads, and inactive node shutdowns</p>
                    </div>
                  </div>
                </div>

                <div className="text-gray-400">🔄 ACID Database Transaction (BEGIN IMMEDIATE) 🔄</div>

                <div className="bg-indigo-900 text-indigo-100 p-4 rounded-xl border border-indigo-800 shadow-inner">
                  <span className="font-semibold text-sm block">Node-Integrated Relational Store (SQLite)</span>
                  <p className="text-[10px] text-indigo-300 mt-1">
                    Enforces foreign keys, indexing constraints, transaction isolation, and cascading deletions
                  </p>
                </div>

                <div className="text-gray-400">⬆ Worker Polling & Lock Claiming (Every 1000ms) ⬆</div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-amber-50 border border-amber-300 p-3 rounded-lg text-amber-800">
                    <span className="font-semibold">Worker Node Alpha</span>
                    <p className="text-[10px] text-amber-600 mt-1">Concurrency load: 0/3</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-300 p-3 rounded-lg text-amber-800">
                    <span className="font-semibold">Worker Node Beta</span>
                    <p className="text-[10px] text-amber-600 mt-1">Concurrency load: 1/2</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-300 p-3 rounded-lg text-amber-800">
                    <span className="font-semibold">Worker Node Gamma</span>
                    <p className="text-[10px] text-amber-600 mt-1">Concurrency load: 0/4</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-4">
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-indigo-600 font-medium">
                  <Zap className="w-4 h-4" />
                  Reliability Mechanisms
                </div>
                <ul className="list-disc list-inside space-y-1 text-gray-600 text-xs pl-1">
                  <li><strong>Atomic Claim Checks</strong>: Selects candidates and flips status to claimed inside a fast transaction, avoiding dual-trigger claims on multiple worker threads.</li>
                  <li><strong>Workflow Dependencies</strong>: Jobs declare parent IDs in an array. The engine delays claiming the child until all parents are set to completed.</li>
                  <li><strong>Worker Heartbeat Tracking</strong>: Active workers constantly write logs. If a worker goes silent for more than 20 seconds, it is flagged inactive and its active running jobs are rescheduled automatically.</li>
                </ul>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-red-600 font-medium">
                  <ShieldAlert className="w-4 h-4" />
                  Fault Tolerance & Retry backoff
                </div>
                <ul className="list-disc list-inside space-y-1 text-gray-600 text-xs pl-1">
                  <li><strong>Fixed Delay</strong>: Job waits for a static retry parameter before reprocessing.</li>
                  <li><strong>Linear Backoff</strong>: Retry timing scales sequentially: <code>delay * attempt_count</code>.</li>
                  <li><strong>Exponential Backoff</strong>: Exponential spacing avoids API overload: <code>delay * 2^(attempt - 1)</code>.</li>
                  <li><strong>Dead Letter Queue (DLQ)</strong>: Jobs that completely exhaust retry limits are removed from normal queues, recorded in DLQ tables, and highlighted for SRE diagnostic review.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ER DIAGRAM TAB */}
        {activeTab === 'er' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Relational Database Diagram</h3>
              <p className="text-sm text-gray-600">
                Highly structured normalized schema designed for zero-redundancy operational integrity. Standardized foreign keys with cascading deletions keep the database consistently coherent.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Table Column detail lists */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3 font-mono text-xs">
                <span className="font-semibold text-gray-900 text-xs border-b border-gray-200 pb-1.5 block">🏢 organizations / users</span>
                <div className="space-y-1 text-gray-700">
                  <div className="text-indigo-600"><strong>organizations</strong>:</div>
                  <div className="pl-3">- id [PK, TEXT]</div>
                  <div className="pl-3">- name [TEXT, UNIQUE]</div>
                  <div className="pl-3">- created_at [DATETIME]</div>
                  
                  <div className="text-indigo-600 mt-2"><strong>users</strong>:</div>
                  <div className="pl-3">- id [PK, TEXT]</div>
                  <div className="pl-3">- username [TEXT, UNIQUE]</div>
                  <div className="pl-3">- password_hash [TEXT]</div>
                  <div className="pl-3">- email [TEXT]</div>
                  <div className="pl-3">- role [TEXT, 'admin'|'member']</div>
                  <div className="pl-3">- org_id [FK REFERENCES organizations.id]</div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3 font-mono text-xs">
                <span className="font-semibold text-gray-900 text-xs border-b border-gray-200 pb-1.5 block">📁 projects / queues</span>
                <div className="space-y-1 text-gray-700">
                  <div className="text-indigo-600"><strong>projects</strong>:</div>
                  <div className="pl-3">- id [PK, TEXT]</div>
                  <div className="pl-3">- name [TEXT]</div>
                  <div className="pl-3">- org_id [FK REFERENCES organizations.id]</div>
                  
                  <div className="text-indigo-600 mt-2"><strong>queues</strong>:</div>
                  <div className="pl-3">- id [PK, TEXT]</div>
                  <div className="pl-3">- project_id [FK REFERENCES projects.id]</div>
                  <div className="pl-3">- name [TEXT]</div>
                  <div className="pl-3">- priority [INT, 1|2|3]</div>
                  <div className="pl-3">- concurrency_limit [INT]</div>
                  <div className="pl-3">- retry_policy_type [TEXT]</div>
                  <div className="pl-3">- retry_policy_delay_ms [INT]</div>
                  <div className="pl-3">- retry_max_attempts [INT]</div>
                  <div className="pl-3">- is_paused [INT, 0|1]</div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3 font-mono text-xs">
                <span className="font-semibold text-gray-900 text-xs border-b border-gray-200 pb-1.5 block">⚙️ jobs / execution schemas</span>
                <div className="space-y-1 text-gray-700">
                  <div className="text-indigo-600"><strong>jobs</strong>:</div>
                  <div className="pl-3">- id [PK, TEXT]</div>
                  <div className="pl-3">- queue_id [FK REFERENCES queues.id]</div>
                  <div className="pl-3">- name [TEXT]</div>
                  <div className="pl-3">- payload [TEXT, JSON]</div>
                  <div className="pl-3">- status [TEXT]</div>
                  <div className="pl-3">- priority [INT]</div>
                  <div className="pl-3">- max_attempts [INT]</div>
                  <div className="pl-3">- attempts_made [INT]</div>
                  <div className="pl-3">- run_at [TEXT, ISO]</div>
                  <div className="pl-3">- cron_expression [TEXT]</div>
                  <div className="pl-3">- dependencies [TEXT, JSON array]</div>
                  
                  <div className="text-indigo-600 mt-2"><strong>dlq_entries</strong>:</div>
                  <div className="pl-3">- id [PK, TEXT]</div>
                  <div className="pl-3">- job_id [FK REFERENCES jobs.id]</div>
                  <div className="pl-3">- failed_at [TEXT]</div>
                  <div className="pl-3">- last_error [TEXT]</div>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-4 bg-indigo-50/50">
              <h4 className="text-xs font-semibold text-indigo-900 mb-1">Index and Optimization Strategy:</h4>
              <ul className="list-disc list-inside space-y-1 text-xs text-indigo-800">
                <li><strong>Indexing on <code>jobs(queue_id, status, run_at)</code></strong>: Accelerates fast polling queries used by Worker Engine.</li>
                <li><strong>Cascading Deletions (<code>ON DELETE CASCADE</code>)</strong>: Guarantees that deleting an organization or project cleanly removes all related jobs, queues, and logs instantly without leaving dangling references.</li>
                <li><strong>ForeignKey Constraints</strong>: SQLite foreign key enforcement is explicitly activated on connection via SQLite internals, maintaining parent-child record dependencies perfectly.</li>
              </ul>
            </div>
          </div>
        )}

        {/* REST API DOCS */}
        {activeTab === 'api' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">API Endpoint Catalog</h3>
                <p className="text-sm text-gray-600">
                  All requests must provide an <code>Authorization: Bearer &lt;user-id&gt;</code> token header. Content type is consistently <code>application/json</code>.
                </p>
              </div>
            </div>

            <div className="space-y-4 font-mono text-xs">
              {/* GET /api/queues */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 p-3 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">GET</span>
                    <span className="font-semibold text-gray-800">/api/queues</span>
                  </div>
                  <span className="text-gray-500">Retrieve system queues with stats</span>
                </div>
                <div className="p-3 bg-white space-y-2">
                  <div className="text-gray-500 text-[10px]">SUCCESS RESPONSE:</div>
                  <pre className="bg-gray-900 text-gray-100 p-2.5 rounded overflow-x-auto text-[10px]">
{`[
  {
    "id": "queue-1",
    "name": "Critical Notifications",
    "priority": 1,
    "concurrency_limit": 3,
    "retry_policy_type": "exponential",
    "is_paused": 0,
    "queued_count": 5,
    "running_count": 1
  }
]`}
                  </pre>
                </div>
              </div>

              {/* POST /api/jobs */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 p-3 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-indigo-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">POST</span>
                    <span className="font-semibold text-gray-800">/api/jobs</span>
                  </div>
                  <span className="text-gray-500">Enqueue background job (Immediate, delayed, scheduled, cron)</span>
                </div>
                <div className="p-3 bg-white space-y-2">
                  <div className="text-gray-500 text-[10px]">REQUEST PAYLOAD MODEL:</div>
                  <pre className="bg-gray-900 text-gray-100 p-2.5 rounded overflow-x-auto text-[10px]">
{`{
  "queueId": "queue-1",
  "name": "send_welcome_email",
  "payload": { "userId": 42, "email": "customer@acme.com" },
  "priority": 1,
  "delayMs": 5000,          // Optional: delayed execution (ms)
  "cronExpression": null,   // Optional: standard cron string for recurring
  "dependencies": ["job-abc"] // Optional: parent job ID dependencies array
}`}
                  </pre>
                </div>
              </div>

              {/* POST /api/jobs/batch */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 p-3 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-indigo-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">POST</span>
                    <span className="font-semibold text-gray-800">/api/jobs/batch</span>
                  </div>
                  <span className="text-gray-500">Atomic bulk batch enqueueing</span>
                </div>
                <div className="p-3 bg-white space-y-2">
                  <div className="text-gray-500 text-[10px]">REQUEST PAYLOAD MODEL:</div>
                  <pre className="bg-gray-900 text-gray-100 p-2.5 rounded overflow-x-auto text-[10px]">
{`{
  "queueId": "queue-1",
  "jobs": [
    { "name": "generate_pdf_report", "payload": { "month": "Jan" } },
    { "name": "generate_pdf_report", "payload": { "month": "Feb" } }
  ]
}`}
                  </pre>
                </div>
              </div>

              {/* POST /api/gemini/summarize-failure */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 p-3 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-purple-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">POST</span>
                    <span className="font-semibold text-gray-800">/api/gemini/summarize-failure</span>
                  </div>
                  <span className="text-gray-500">Gemini LLM-guided failed job diagnostic summarizer</span>
                </div>
                <div className="p-3 bg-white space-y-2">
                  <div className="text-gray-500 text-[10px]">REQUEST PAYLOAD:</div>
                  <pre className="bg-gray-900 text-gray-100 p-2.5 rounded overflow-x-auto text-[10px]">
{`{
  "jobId": "job-init-2"
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CORE DECISIONS TAB */}
        {activeTab === 'decisions' && (
          <div className="space-y-6 animate-fade-in text-sm text-gray-600 leading-relaxed">
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Design Decisions, Trade-offs & Normalization</h3>
              <p className="mb-4">
                The objective was to prioritize engineering precision, atomicity, and concurrency safeguards rather than sheer feature volume. Below is a deep dive into the core choices made during engineering.
              </p>

              <div className="space-y-4">
                <div className="border-l-4 border-indigo-500 pl-4 py-1">
                  <h4 className="font-semibold text-gray-900 text-xs">1. Node Built-in SQLite vs. External pg/redis</h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Instead of introducing risky compile-time native binaries (like standard <code>pg</code> or <code>better-sqlite3</code>) that frequently fail to compile on containerization layers, we chose Node 22's native built-in <strong><code>node:sqlite</code></strong>. It supports standard SQL, transactions, parameter binds, and indices with ZERO external dependencies. It ensures the application is completely out-of-the-box functional on any deployment platform.
                  </p>
                </div>

                <div className="border-l-4 border-indigo-500 pl-4 py-1">
                  <h4 className="font-semibold text-gray-900 text-xs">2. Atomic Claims via sqlite transaction isolation (BEGIN IMMEDIATE)</h4>
                  <p className="text-xs text-gray-600 mt-1">
                    A major risk in distributed scheduling is double execution (two workers pulling the same job). By executing the SELECT candidate and UPDATE status steps inside a strict SQL <code>BEGIN IMMEDIATE TRANSACTION</code> block, SQLite's database-level write lock is obtained instantly. Only one thread succeeds in claiming, and concurrent claim workers automatically rollback and retry safely. This eliminates execution duplicates perfectly.
                  </p>
                </div>

                <div className="border-l-4 border-indigo-500 pl-4 py-1">
                  <h4 className="font-semibold text-gray-900 text-xs">3. Workflow Dependency Resolver Architecture</h4>
                  <p className="text-xs text-gray-600 mt-1">
                    To satisfy the workflow dependency requirement without bloated graph databases, we represented dependencies inside the <code>jobs</code> table as a simple JSON list of job IDs. We used SQLite's built-in <code>json_each</code> features to write a single-query dependency checker that blocks worker claims until all parent IDs are validated to be in status <code>'completed'</code>. This provides <code>O(1)</code> execution overhead per poll.
                  </p>
                </div>

                <div className="border-l-4 border-indigo-500 pl-4 py-1">
                  <h4 className="font-semibold text-gray-900 text-xs">4. Lazy Initialization of AI Diagnostics (Gemini 3.5 Flash)</h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Following API Security best practices, we initialized the <code>@google/genai</code> SDK on the server side inside the route handler. To avoid crash-on-startup when keys are missing (common during container deployments), we gracefully catch missing environment variables and fall back to detailed, styled HTML dumps.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
