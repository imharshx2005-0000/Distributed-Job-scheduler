import React, { useState } from "react";
import { ListCollapse, Plus, Play, Pause, Settings, RefreshCw, Layers, Check, AlertCircle } from "lucide-react";
import { Queue, Project } from "../types";

interface QueueConfiguratorProps {
  queues: Queue[];
  projects: Project[];
  onRefresh: () => void;
  isRefreshing: boolean;
  onPauseQueue: (id: string) => void;
  onResumeQueue: (id: string) => void;
  onUpdateQueueConfig: (id: string, config: Partial<Queue>) => void;
  onCreateQueue: (data: Partial<Queue>) => void;
}

export default function QueueConfigurator({
  queues,
  projects,
  onRefresh,
  isRefreshing,
  onPauseQueue,
  onResumeQueue,
  onUpdateQueueConfig,
  onCreateQueue
}: QueueConfiguratorProps) {
  const [isAddingQueue, setIsAddingQueue] = useState(false);
  const [editingQueueId, setEditingQueueId] = useState<string | null>(null);

  // Form states for adding queue
  const [newQueueName, setNewQueueName] = useState("");
  const [newQueueProjectId, setNewQueueProjectId] = useState("");
  const [newQueuePriority, setNewQueuePriority] = useState(2);
  const [newQueueLimit, setNewQueueLimit] = useState(5);
  const [newQueueRetryType, setNewQueueRetryType] = useState<'fixed' | 'linear' | 'exponential'>('exponential');
  const [newQueueRetryDelay, setNewQueueRetryDelay] = useState(1000);
  const [newQueueMaxAttempts, setNewQueueMaxAttempts] = useState(3);

  // Form states for editing queue
  const [editPriority, setEditPriority] = useState(2);
  const [editLimit, setEditLimit] = useState(5);
  const [editRetryType, setEditRetryType] = useState<'fixed' | 'linear' | 'exponential'>('exponential');
  const [editRetryDelay, setEditRetryDelay] = useState(1000);
  const [editMaxAttempts, setEditMaxAttempts] = useState(3);

  const handleStartEdit = (q: Queue) => {
    setEditingQueueId(q.id);
    setEditPriority(q.priority);
    setEditLimit(q.concurrencyLimit);
    setEditRetryType(q.retryPolicyType);
    setEditRetryDelay(q.retryPolicyDelayMs);
    setEditMaxAttempts(q.retryMaxAttempts);
  };

  const handleSaveEdit = (qId: string) => {
    onUpdateQueueConfig(qId, {
      priority: editPriority,
      concurrencyLimit: editLimit,
      retryPolicyType: editRetryType,
      retryPolicyDelayMs: editRetryDelay,
      retryMaxAttempts: editMaxAttempts
    });
    setEditingQueueId(null);
  };

  const handleSubmitNewQueue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueueName || !newQueueProjectId) return;

    onCreateQueue({
      name: newQueueName,
      projectId: newQueueProjectId,
      priority: newQueuePriority,
      concurrencyLimit: newQueueLimit,
      retryPolicyType: newQueueRetryType,
      retryPolicyDelayMs: newQueueRetryDelay,
      retryMaxAttempts: newQueueMaxAttempts
    });

    // Reset Form
    setIsAddingQueue(false);
    setNewQueueName("");
    setNewQueueProjectId("");
  };

  return (
    <div id="queue-configurator" className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 tracking-tight flex items-center gap-2">
            <ListCollapse className="w-5 h-5 text-indigo-600" />
            Queue Configurator & Backoff Policies
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Maintain priority, throttling concurrency limits, and backoff retry algorithms per job queue.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            id="btn-sync-queues"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-3 py-2 border border-gray-200 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Sync
          </button>
          <button
            id="btn-add-queue"
            onClick={() => setIsAddingQueue(!isAddingQueue)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-1.5 text-xs font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Queue
          </button>
        </div>
      </div>

      {/* CREATE QUEUE DRAWER/FORM */}
      {isAddingQueue && (
        <form id="form-create-queue" onSubmit={handleSubmitNewQueue} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              Configure New Operational Queue
            </h3>
            <button
              type="button"
              onClick={() => setIsAddingQueue(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Project selection */}
            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-gray-700">Project Owner</label>
              <select
                id="select-new-queue-project"
                value={newQueueProjectId}
                onChange={(e) => setNewQueueProjectId(e.target.value)}
                required
                className="p-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="">Select a Project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Queue Name */}
            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-gray-700">Queue Name</label>
              <input
                id="input-new-queue-name"
                type="text"
                placeholder="e.g. video-rendering-silo"
                value={newQueueName}
                onChange={(e) => setNewQueueName(e.target.value)}
                required
                className="p-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>

            {/* Queue Priority */}
            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-gray-700">Queue Priority</label>
              <select
                id="select-new-queue-priority"
                value={newQueuePriority}
                onChange={(e) => setNewQueuePriority(Number(e.target.value))}
                className="p-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value={1}>1 - High priority (Core logs / Alarms)</option>
                <option value={2}>2 - Medium priority (Standard operations)</option>
                <option value={3}>3 - Low priority (Analytical batches)</option>
              </select>
            </div>

            {/* Concurrency limit */}
            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-gray-700">Concurrency Limit (Max Parallel threads)</label>
              <input
                id="input-new-queue-concurrency"
                type="number"
                min={1}
                max={20}
                value={newQueueLimit}
                onChange={(e) => setNewQueueLimit(Number(e.target.value))}
                className="p-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>

            {/* Retry Policy */}
            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-gray-700">Retry Backoff Strategy</label>
              <select
                id="select-new-queue-retry"
                value={newQueueRetryType}
                onChange={(e) => setNewQueueRetryType(e.target.value as any)}
                className="p-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="fixed">Fixed Delay (Static pacing)</option>
                <option value="linear">Linear Backoff (Progressive load mitigation)</option>
                <option value="exponential">Exponential Backoff (Recommended - avoid thundering herd)</option>
              </select>
            </div>

            {/* Retry Delay & Limit */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-gray-700">Delay (ms)</label>
                <input
                  id="input-new-queue-delay"
                  type="number"
                  min={100}
                  step={100}
                  value={newQueueRetryDelay}
                  onChange={(e) => setNewQueueRetryDelay(Number(e.target.value))}
                  className="p-2 border border-gray-300 rounded-lg bg-white"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-gray-700">Max Attempts</label>
                <input
                  id="input-new-queue-max-attempts"
                  type="number"
                  min={1}
                  max={10}
                  value={newQueueMaxAttempts}
                  onChange={(e) => setNewQueueMaxAttempts(Number(e.target.value))}
                  className="p-2 border border-gray-300 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              id="btn-submit-create-queue"
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-xs font-semibold shadow-sm"
            >
              Provisional Queue Configuration
            </button>
          </div>
        </form>
      )}

      {/* QUEUE CARDS LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {queues.map((q) => {
          const isEditing = editingQueueId === q.id;

          return (
            <div key={q.id} id={`queue-card-${q.id}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    {q.name}
                  </h3>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold mt-0.5 tracking-wider font-mono">
                    ID: {q.id}
                  </span>
                </div>

                <div className="flex gap-1.5">
                  {/* Pause / Resume action toggle */}
                  {q.isPaused ? (
                    <button
                      onClick={() => onResumeQueue(q.id)}
                      className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 uppercase"
                    >
                      <Play className="w-3 h-3" />
                      Resume
                    </button>
                  ) : (
                    <button
                      onClick={() => onPauseQueue(q.id)}
                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 uppercase"
                    >
                      <Pause className="w-3 h-3" />
                      Pause
                    </button>
                  )}

                  {!isEditing && (
                    <button
                      onClick={() => handleStartEdit(q)}
                      className="p-1.5 hover:bg-gray-50 border border-gray-200 rounded-lg text-gray-500 transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Status Warning if Queue is Paused */}
              {q.isPaused === true && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-800">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <strong>Queue is currently Paused.</strong> Background worker polling is suspended for this channel. Active running workloads will finish, but no new workloads will be claimed.
                  </div>
                </div>
              )}

              {/* EDIT FORM FIELDS (if active editing) */}
              {isEditing ? (
                <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-gray-700">Queue Priority</label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(Number(e.target.value))}
                      className="p-1.5 border border-gray-300 rounded bg-white text-[11px]"
                    >
                      <option value={1}>1 - High</option>
                      <option value={2}>2 - Medium</option>
                      <option value={3}>3 - Low</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-gray-700">Concurrency Throttling</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={editLimit}
                      onChange={(e) => setEditLimit(Number(e.target.value))}
                      className="p-1.5 border border-gray-300 rounded bg-white text-[11px]"
                    />
                  </div>

                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="font-semibold text-gray-700">Backoff Strategy</label>
                    <select
                      value={editRetryType}
                      onChange={(e) => setEditRetryType(e.target.value as any)}
                      className="p-1.5 border border-gray-300 rounded bg-white text-[11px]"
                    >
                      <option value="fixed">Fixed Delay</option>
                      <option value="linear">Linear Backoff</option>
                      <option value="exponential">Exponential Backoff</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-gray-700">Delay Interval (ms)</label>
                    <input
                      type="number"
                      min={100}
                      step={100}
                      value={editRetryDelay}
                      onChange={(e) => setEditRetryDelay(Number(e.target.value))}
                      className="p-1.5 border border-gray-300 rounded bg-white text-[11px]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-gray-700">Max Attempts</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={editMaxAttempts}
                      onChange={(e) => setEditMaxAttempts(Number(e.target.value))}
                      className="p-1.5 border border-gray-300 rounded bg-white text-[11px]"
                    />
                  </div>

                  <div className="col-span-2 flex justify-end gap-1.5 pt-2 border-t border-gray-200 mt-1">
                    <button
                      onClick={() => setEditingQueueId(null)}
                      className="px-2.5 py-1.5 bg-white border border-gray-200 rounded text-gray-600 hover:bg-gray-100 font-medium text-[10px]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveEdit(q.id)}
                      className="px-2.5 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold text-[10px] flex items-center gap-1 shadow-sm"
                    >
                      <Check className="w-3 h-3" />
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                /* READ-ONLY STATS VIEW */
                <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                  <div className="space-y-1">
                    <div className="text-gray-400 text-[10px]">THROTTLING & SHAPING</div>
                    <div className="text-gray-700">Priority: <strong className="text-gray-900">{q.priority === 1 ? "1 (High)" : q.priority === 2 ? "2 (Medium)" : "3 (Low)"}</strong></div>
                    <div className="text-gray-700">Concurrency: <strong className="text-gray-900">{q.concurrencyLimit} threads</strong></div>
                  </div>

                  <div className="space-y-1 border-l border-gray-200 pl-4">
                    <div className="text-gray-400 text-[10px]">RETRY ALGORITHM</div>
                    <div className="text-gray-700">Backoff: <strong className="text-gray-900 capitalize">{q.retryPolicyType}</strong></div>
                    <div className="text-gray-700">Base Delay: <strong className="text-gray-900">{q.retryPolicyDelayMs}ms</strong></div>
                    <div className="text-gray-700">Max retries: <strong className="text-gray-900">{q.retryMaxAttempts} attempts</strong></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
