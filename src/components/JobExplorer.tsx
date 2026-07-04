import React, { useState } from "react";
import { 
  Plus, Search, RefreshCw, Filter, Play, Trash2, Calendar, Clock, Sparkles, AlertTriangle, 
  ChevronRight, ClipboardList, Layers, ArrowRight, HelpCircle, FileText
} from "lucide-react";
import { Job, Queue, JobLog } from "../types";

interface JobExplorerProps {
  jobs: Job[];
  queues: Queue[];
  onRefresh: () => void;
  isRefreshing: boolean;
  onEnqueueJob: (data: any) => void;
  onEnqueueBatch: (data: any) => void;
  onRetryJob: (id: string) => void;
  onDeleteJob: (id: string) => void;
  totalJobsCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onAskGemini: (jobId: string) => Promise<string>;
}

export default function JobExplorer({
  jobs,
  queues,
  onRefresh,
  isRefreshing,
  onEnqueueJob,
  onEnqueueBatch,
  onDeleteJob,
  onRetryJob,
  totalJobsCount,
  currentPage,
  onPageChange,
  onAskGemini
}: JobExplorerProps) {
  // Modal & form switches
  const [isAddingJob, setIsAddingJob] = useState(false);
  const [isAddingBatch, setIsAddingBatch] = useState(false);
  const [selectedJobForLogs, setSelectedJobForLogs] = useState<Job | null>(null);
  const [jobLogs, setJobLogs] = useState<JobLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Gemini modal states
  const [showGeminiModal, setShowGeminiModal] = useState(false);
  const [geminiReport, setGeminiReport] = useState("");
  const [isGeneratingDiagnostics, setIsGeneratingDiagnostics] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [queueFilter, setQueueFilter] = useState("");

  // Create Job States
  const [jobName, setJobName] = useState("send_welcome_email");
  const [queueId, setQueueId] = useState("");
  const [jobPayload, setJobPayload] = useState('{"userId": 105, "email": "johndoe@gmail.com"}');
  const [jobPriority, setJobPriority] = useState(2);
  const [jobDelay, setJobDelay] = useState(0);
  const [jobCron, setJobCron] = useState("");
  const [jobDependencyId, setJobDependencyId] = useState("");
  const [triggerFail, setTriggerFail] = useState(false);

  // Create Batch States
  const [batchQueueId, setBatchQueueId] = useState("");
  const [batchSize, setBatchSize] = useState(5);
  const [batchJobName, setBatchJobName] = useState("generate_pdf_report");

  const handleFetchLogs = async (job: Job) => {
    setSelectedJobForLogs(job);
    setIsLoadingLogs(true);
    try {
      const response = await fetch(`/api/logs?jobId=${job.id}`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token") || ""}` }
      });
      const data = await response.json();
      setJobLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleTriggerGemini = async (job: Job) => {
    setShowGeminiModal(true);
    setGeminiReport("");
    setIsGeneratingDiagnostics(true);
    try {
      const report = await onAskGemini(job.id);
      setGeminiReport(report);
    } catch (e: any) {
      setGeminiReport(`### Error Running Diagnostics\n\nFailed to invoke Gemini API: ${e.message}`);
    } finally {
      setIsGeneratingDiagnostics(false);
    }
  };

  const handleCreateJobSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueId || !jobName) return;

    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(jobPayload);
    } catch (err) {
      alert("Invalid JSON format in payload field.");
      return;
    }

    if (triggerFail) {
      parsedPayload = { ...parsedPayload, fail: true };
    }

    const dependencies = jobDependencyId ? [jobDependencyId] : [];

    onEnqueueJob({
      queueId,
      name: jobName,
      payload: parsedPayload,
      priority: jobPriority,
      delayMs: jobDelay > 0 ? jobDelay * 1000 : undefined,
      cronExpression: jobCron || undefined,
      dependencies
    });

    setIsAddingJob(false);
  };

  const handleCreateBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchQueueId || !batchJobName) return;

    // Create array of jobs
    const batchJobs = Array.from({ length: batchSize }).map((_, idx) => ({
      name: batchJobName,
      payload: { index: idx + 1, batchRun: true, scope: "auto-batch" }
    }));

    onEnqueueBatch({
      queueId: batchQueueId,
      jobs: batchJobs
    });

    setIsAddingBatch(false);
  };

  return (
    <div id="job-explorer" className="space-y-6">
      {/* Search & Header card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 tracking-tight flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-600" />
              Background Jobs Ledger
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Create, schedule, trace and diagnose asynchronous processes. Filter by queue or runtime state.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              id="btn-trigger-add-job"
              onClick={() => { setIsAddingJob(!isAddingJob); setIsAddingBatch(false); }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Enqueue Job
            </button>
            <button
              id="btn-trigger-add-batch"
              onClick={() => { setIsAddingBatch(!isAddingBatch); setIsAddingJob(false); }}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-semibold"
            >
              <Layers className="w-4 h-4" />
              Enqueue Bulk Batch
            </button>
            <button
              id="btn-sync-jobs"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="px-3 py-2 border border-gray-200 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-1.5 text-xs font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Sync
            </button>
          </div>
        </div>

        {/* Filters bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
          {/* Search Input */}
          <div className="flex items-center gap-2 border border-gray-300 rounded-xl px-3 bg-white">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              id="input-filter-search"
              type="text"
              placeholder="Filter by Job name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs py-2 bg-transparent focus:outline-none"
            />
          </div>

          {/* Status Select */}
          <div className="flex items-center gap-2 border border-gray-300 rounded-xl px-3 bg-white">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              id="select-filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs py-2 bg-transparent focus:outline-none"
            >
              <option value="">Filter by Status (All)</option>
              <option value="queued">Queued (Waiting)</option>
              <option value="scheduled">Scheduled (Delayed / Cron)</option>
              <option value="running">Executing (Active)</option>
              <option value="completed">Completed (Successful)</option>
              <option value="dlq">Quarantined (DLQ)</option>
            </select>
          </div>

          {/* Queue Select */}
          <div className="flex items-center gap-2 border border-gray-300 rounded-xl px-3 bg-white">
            <Layers className="w-4 h-4 text-gray-400" />
            <select
              id="select-filter-queue"
              value={queueFilter}
              onChange={(e) => setQueueFilter(e.target.value)}
              className="w-full text-xs py-2 bg-transparent focus:outline-none"
            >
              <option value="">Filter by Queue (All)</option>
              {queues.map(q => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
          </div>

          {/* Trigger manual filtering refresh action */}
          <button
            id="btn-apply-filter-sync"
            onClick={onRefresh}
            className="bg-gray-950 text-white font-semibold text-xs py-2 rounded-xl hover:bg-gray-800 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* SINGLE JOB CREATE FORM */}
      {isAddingJob && (
        <form id="form-add-job" onSubmit={handleCreateJobSubmit} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 animate-fade-in">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5 border-b border-gray-100 pb-2">
            <Plus className="w-4 h-4 text-indigo-600" />
            Configure & Dispatch Single Background Job
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Queue selection */}
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-gray-700">Target Queue</label>
              <select
                id="select-create-job-queue"
                value={queueId}
                onChange={(e) => setQueueId(e.target.value)}
                required
                className="p-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="">Select Target Queue...</option>
                {queues.map(q => (
                  <option key={q.id} value={q.id}>{q.name}</option>
                ))}
              </select>
            </div>

            {/* Job Handler Match selection */}
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-gray-700">Handler / Job Type</label>
              <select
                id="select-create-job-name"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                required
                className="p-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="send_welcome_email">📧 send_welcome_email (Fast)</option>
                <option value="generate_pdf_report">📊 generate_pdf_report (Medium)</option>
                <option value="database_backup">💾 database_backup (Long / Heavy)</option>
                <option value="sync_external_crm">🔄 sync_external_crm (API Network)</option>
              </select>
            </div>

            {/* Queue Job priority override */}
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-gray-700">Job Priority Override</label>
              <select
                id="select-create-job-priority"
                value={jobPriority}
                onChange={(e) => setJobPriority(Number(e.target.value))}
                className="p-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value={1}>1 - High priority (Process before standard)</option>
                <option value={2}>2 - Medium priority (Standard)</option>
                <option value={3}>3 - Low priority (Batch processing)</option>
              </select>
            </div>

            {/* Time scheduling sliders / delays */}
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-gray-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                Execution Delay (Seconds)
              </label>
              <input
                id="input-create-job-delay"
                type="number"
                min={0}
                placeholder="0 for immediate"
                value={jobDelay}
                onChange={(e) => setJobDelay(Number(e.target.value))}
                className="p-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>

            {/* Recurring Cron Expression */}
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-gray-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                Recurring Cron Pattern (Optional)
              </label>
              <input
                id="input-create-job-cron"
                type="text"
                placeholder="e.g. */5 * * * * for every 5 mins"
                value={jobCron}
                onChange={(e) => setJobCron(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>

            {/* Dependency Job selection */}
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-gray-700">Workflow Dependency Parent ID (Optional)</label>
              <select
                id="select-create-job-dependency"
                value={jobDependencyId}
                onChange={(e) => setJobDependencyId(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="">None (No prerequisites)</option>
                {jobs.slice(0, 15).map(j => (
                  <option key={j.id} value={j.id}>{j.name} (id: {j.id.substr(0, 8)})</option>
                ))}
              </select>
            </div>

            {/* Parameters JSON Payload payload */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="font-semibold text-gray-700">JSON Payload Parameters</label>
              <textarea
                id="textarea-create-job-payload"
                rows={2}
                value={jobPayload}
                onChange={(e) => setJobPayload(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg bg-white font-mono text-[11px]"
              />
            </div>

            {/* Simulate crash trigger */}
            <div className="flex items-center gap-2 md:col-span-1 pt-4">
              <input
                id="checkbox-create-job-fail"
                type="checkbox"
                checked={triggerFail}
                onChange={(e) => setTriggerFail(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
              />
              <label className="font-semibold text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Simulate Runtime Exception (Forces Failures)
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              id="btn-submit-create-job"
              type="submit"
              className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-xs font-semibold shadow-sm"
            >
              Dispatch to Queue Pipeline
            </button>
          </div>
        </form>
      )}

      {/* BATCH BUNCH CREATE FORM */}
      {isAddingBatch && (
        <form id="form-add-batch" onSubmit={handleCreateBatchSubmit} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 animate-fade-in">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5 border-b border-gray-100 pb-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            Configure & Enqueue Bulk Job Batch
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-gray-700">Target Queue</label>
              <select
                id="select-create-batch-queue"
                value={batchQueueId}
                onChange={(e) => setBatchQueueId(e.target.value)}
                required
                className="p-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="">Select Target Queue...</option>
                {queues.map(q => (
                  <option key={q.id} value={q.id}>{q.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-semibold text-gray-700">Handler / Job Type</label>
              <select
                id="select-create-batch-name"
                value={batchJobName}
                onChange={(e) => setBatchJobName(e.target.value)}
                required
                className="p-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="generate_pdf_report">📊 generate_pdf_report (Medium)</option>
                <option value="send_welcome_email">📧 send_welcome_email (Fast)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-semibold text-gray-700">Batch Size (Number of parallel jobs)</label>
              <input
                id="input-create-batch-size"
                type="number"
                min={2}
                max={20}
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="p-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              id="btn-submit-create-batch"
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-xs font-semibold shadow-sm"
            >
              Dispatch Batch Group (Atomic Transaction)
            </button>
          </div>
        </form>
      )}

      {/* JOBS TABLE & LOGS SPLIT VIEW */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Jobs list table */}
        <div className="xl:col-span-8 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-[10px] font-semibold text-gray-400 uppercase tracking-wider font-mono">
                  <th className="p-4">Job Info</th>
                  <th className="p-4">Queue / Priority</th>
                  <th className="p-4">Execution Status</th>
                  <th className="p-4">Retries</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs text-gray-700">
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-8 text-gray-400 font-medium">
                      No jobs found matching criteria.
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => {
                    const statusColors: Record<string, string> = {
                      queued: "bg-amber-50 text-amber-800 border-amber-200",
                      scheduled: "bg-blue-50 text-blue-800 border-blue-200",
                      running: "bg-purple-50 text-purple-800 border-purple-200 animate-pulse",
                      completed: "bg-emerald-50 text-emerald-800 border-emerald-200",
                      dlq: "bg-red-50 text-red-800 border-red-200"
                    };

                    const displayStatus = job.status === "claimed" ? "running" : job.status;

                    return (
                      <tr 
                        key={job.id} 
                        id={`job-row-${job.id}`}
                        onClick={() => handleFetchLogs(job)}
                        className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${selectedJobForLogs?.id === job.id ? 'bg-indigo-50/20' : ''}`}
                      >
                        {/* Job Info */}
                        <td className="p-4 space-y-1">
                          <div className="font-semibold text-gray-900">{job.name}</div>
                          <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5">
                            ID: <span className="text-gray-500 font-bold">{job.id}</span>
                          </div>
                          {job.cronExpression && (
                            <div className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> Cron: {job.cronExpression}
                            </div>
                          )}
                          {job.dependencies && job.dependencies !== "[]" && (
                            <div className="text-[9px] text-purple-600 font-medium">
                              ⛓ Depends on: {JSON.parse(job.dependencies).join(", ").substr(0, 15)}...
                            </div>
                          )}
                        </td>

                        {/* Queue */}
                        <td className="p-4 space-y-1">
                          <div className="text-gray-800 font-medium">{job.queue_name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            Priority: {job.priority === 1 ? "1 (High)" : job.priority === 2 ? "2 (Med)" : "3 (Low)"}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${statusColors[displayStatus] || 'bg-gray-100'}`}>
                            {displayStatus.toUpperCase()}
                          </span>
                          {job.runAt && (job.status === "scheduled") && (
                            <div className="text-[9px] text-gray-400 font-mono mt-1 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(job.runAt).toLocaleTimeString()}
                            </div>
                          )}
                        </td>

                        {/* Retries */}
                        <td className="p-4 font-mono text-xs">
                          <div className="text-gray-800">
                            {job.attemptsMade} / {job.maxAttempts}
                          </div>
                          <div className="text-[9px] text-gray-400">attempts</div>
                        </td>

                        {/* Action buttons */}
                        <td className="p-4 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                          {job.status === "dlq" && (
                            <button
                              id={`btn-retry-job-${job.id}`}
                              onClick={() => onRetryJob(job.id)}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded text-[10px] font-bold uppercase transition-colors"
                              title="Resubmit job from DLQ"
                            >
                              Retry
                            </button>
                          )}
                          <button
                            id={`btn-delete-job-${job.id}`}
                            onClick={() => onDeleteJob(job.id)}
                            className="p-1 hover:bg-red-50 border border-gray-200 rounded text-gray-400 hover:text-red-500 transition-colors inline-flex"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Simple Pagination Footer */}
          <div className="p-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500 font-mono">
            <span>Total: <strong>{totalJobsCount}</strong> items</span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="px-2 py-1 border border-gray-200 rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Prev
              </button>
              <span>Page {currentPage}</span>
              <button
                disabled={currentPage * 10 >= totalJobsCount}
                onClick={() => onPageChange(currentPage + 1)}
                className="px-2 py-1 border border-gray-200 rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Logs terminal side panel */}
        <div className="xl:col-span-4 bg-gray-950 text-gray-300 rounded-2xl p-5 border border-gray-800 shadow-xl font-mono text-xs flex flex-col justify-between min-h-[400px]">
          {selectedJobForLogs ? (
            <div className="space-y-4 flex flex-col h-full justify-between">
              {/* Header */}
              <div className="border-b border-gray-800 pb-3 flex items-start justify-between">
                <div className="space-y-1">
                  <div className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase">TRACE CONTEXT</div>
                  <div className="text-white font-bold">{selectedJobForLogs.name}</div>
                  <div className="text-[10px] text-gray-400">ID: {selectedJobForLogs.id}</div>
                </div>

                {/* Gemini AI Diagnostic Button */}
                {(selectedJobForLogs.status === "dlq" || selectedJobForLogs.status === "failed") && (
                  <button
                    id={`btn-gemini-diagnostics-${selectedJobForLogs.id}`}
                    onClick={() => handleTriggerGemini(selectedJobForLogs)}
                    className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow transition-colors shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Gemini Diagnostics
                  </button>
                )}
              </div>

              {/* Scrollable logs terminal */}
              <div className="flex-1 overflow-y-auto max-h-[300px] space-y-1.5 pr-2 custom-scrollbar">
                {isLoadingLogs ? (
                  <div className="text-center py-12 text-gray-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-gray-400" />
                    Streaming trace logs...
                  </div>
                ) : jobLogs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No runtime execution logs recorded for this job.
                  </div>
                ) : (
                  jobLogs.map((log) => {
                    const levelColors: Record<string, string> = {
                      info: "text-gray-400",
                      warn: "text-amber-400",
                      error: "text-red-400 font-bold"
                    };

                    return (
                      <div key={log.id} className="text-[11px] leading-relaxed break-words">
                        <span className="text-gray-600">[{new Date(log.createdAt).toLocaleTimeString()}]</span>{" "}
                        <span className={levelColors[log.level]}>{`[${log.level.toUpperCase()}]`}</span>{" "}
                        <span className="text-gray-100">{log.message}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-600 py-12">
              <ClipboardList className="w-10 h-10 mb-2 text-gray-800" />
              <span>Select any background job row in the ledger to view execution logs, runtime metrics, and LLM-guided diagnostics.</span>
            </div>
          )}
        </div>
      </div>

      {/* GEMINI DIAGNOSTICS DETAILED MODAL */}
      {showGeminiModal && (
        <div id="gemini-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-300 animate-pulse" />
                <div>
                  <h3 className="font-bold text-sm sm:text-base">Gemini Intelligent Failure Analysis</h3>
                  <p className="text-[10px] text-purple-200 mt-0.5">SRE diagnostics & remediation recommendations</p>
                </div>
              </div>
              <button
                id="btn-close-gemini-modal"
                onClick={() => setShowGeminiModal(false)}
                className="text-white hover:text-purple-200 font-bold text-sm px-2.5 py-1 rounded hover:bg-white/10"
              >
                Close
              </button>
            </div>

            {/* Markdown Body */}
            <div className="p-6 overflow-y-auto space-y-4 max-h-[60vh] text-gray-700 leading-relaxed text-sm">
              {isGeneratingDiagnostics ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3 text-gray-500 font-mono text-xs">
                  <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
                  <span>Invoking Gemini 3.5 Flash server-side agent...</span>
                  <span className="text-[10px] text-gray-400">Structuring trace dumps, parsing exceptions, and assembling remediation...</span>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-xs sm:text-sm whitespace-pre-wrap font-sans text-gray-800">
                  {/* Since react-markdown might not be installed, we render whitespace-pre-wrap carefully formatted string */}
                  <div className="space-y-4">
                    {geminiReport.split("\n\n").map((para, i) => {
                      if (para.startsWith("###") || para.startsWith("##")) {
                        return <h4 key={i} className="text-sm font-bold text-indigo-900 border-b border-gray-100 pb-1 pt-2">{para.replace(/###|##/g, "")}</h4>;
                      }
                      if (para.startsWith("-") || para.startsWith("1.")) {
                        return (
                          <div key={i} className="pl-4 border-l-2 border-indigo-200 italic text-gray-600 font-mono text-xs bg-gray-50/50 p-2 rounded">
                            {para}
                          </div>
                        );
                      }
                      return <p key={i}>{para}</p>;
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 bg-gray-50/50 p-4 flex justify-end gap-2">
              <button
                id="btn-close-gemini-modal-footer"
                onClick={() => setShowGeminiModal(false)}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 text-xs font-semibold shadow"
              >
                Acknowledge Analysis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
