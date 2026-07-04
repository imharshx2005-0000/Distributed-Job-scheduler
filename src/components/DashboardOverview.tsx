import { Activity, Server, LayoutGrid, CheckCircle2, AlertOctagon, RefreshCw, Layers } from "lucide-react";
import { SystemMetrics, Queue } from "../types";

interface DashboardOverviewProps {
  metrics: SystemMetrics | null;
  queues: Queue[];
  onRefresh: () => void;
  isRefreshing: boolean;
}

export default function DashboardOverview({ metrics, queues, onRefresh, isRefreshing }: DashboardOverviewProps) {
  if (!metrics) {
    return (
      <div id="dashboard-loading" className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="text-sm font-medium text-gray-600 mt-3">Fetching live metrics...</span>
      </div>
    );
  }

  // Calculate sum counts for the top cards
  const activeWorkersCount = metrics.activeWorkers;
  const throughputPerMin = metrics.throughputRate;

  return (
    <div id="dashboard-overview" className="space-y-6">
      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Total jobs */}
        <div id="metric-total-jobs" className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Total Workload</span>
            <LayoutGrid className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold text-gray-900">{metrics.totalJobs}</span>
            <span className="text-[10px] text-gray-400">runs</span>
          </div>
        </div>

        {/* Queued */}
        <div id="metric-queued-jobs" className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-amber-500">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Queued</span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold text-gray-900">{metrics.queuedJobs}</span>
            <span className="text-[10px] text-amber-500">waiting</span>
          </div>
        </div>

        {/* Running */}
        <div id="metric-running-jobs" className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-indigo-500">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Executing</span>
            <Activity className="w-4 h-4 text-indigo-500 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold text-gray-900">{metrics.runningJobs}</span>
            <span className="text-[10px] text-indigo-500">active</span>
          </div>
        </div>

        {/* Completed */}
        <div id="metric-completed-jobs" className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-emerald-500">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Success</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold text-gray-900">{metrics.completedJobs}</span>
            <span className="text-[10px] text-emerald-500">completed</span>
          </div>
        </div>

        {/* Failed / DLQ */}
        <div id="metric-failed-jobs" className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-red-500">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">DLQ Entries</span>
            <AlertOctagon className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold text-gray-900">{metrics.dlqJobs}</span>
            <span className="text-[10px] text-red-500">quarantine</span>
          </div>
        </div>

        {/* Workers */}
        <div id="metric-active-workers" className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-blue-500">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Workers Online</span>
            <Server className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold text-gray-900">{activeWorkersCount}</span>
            <span className="text-[10px] text-blue-500">nodes</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Throughput Timeline & Queue Health */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Analytics Graph Card */}
        <div id="metrics-chart-card" className="lg:col-span-8 bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900 tracking-tight">Throughput Rate Analytics</h3>
              <p className="text-xs text-gray-400 mt-0.5">Real-time workload processing statistics per minute.</p>
            </div>
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 hover:bg-gray-50 border border-gray-200 rounded-lg text-gray-500 transition-colors flex items-center gap-1 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>
          </div>

          {/* Simple Visual Grid Bar Chart representing Throughput Timeline */}
          <div className="h-48 flex items-end gap-2 pt-6 pb-2 border-b border-gray-100 relative">
            {/* Grid line indicator lines */}
            <div className="absolute inset-x-0 top-6 border-t border-gray-50 text-[9px] text-gray-400 font-mono flex justify-between pr-2"><span>High throughput</span></div>
            <div className="absolute inset-x-0 top-24 border-t border-gray-50 text-[9px] text-gray-400 font-mono flex justify-between pr-2"><span>Medium load</span></div>
            <div className="absolute inset-x-0 bottom-2 border-t border-gray-50 text-[9px] text-gray-400 font-mono flex justify-between pr-2"><span>Idle system</span></div>

            {metrics.recentThroughput.map((point, index) => {
              const maxVal = Math.max(...metrics.recentThroughput.map(p => p.completed + p.failed), 5);
              const heightCompleted = `${((point.completed) / maxVal) * 100}%`;
              const heightFailed = `${((point.failed) / maxVal) * 100}%`;

              return (
                <div key={index} className="flex-1 flex flex-col items-center h-full justify-end relative group z-10">
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 bg-gray-900 text-white text-[10px] rounded p-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow flex flex-col gap-0.5 whitespace-nowrap">
                    <span className="font-semibold text-indigo-300">{point.time}</span>
                    <span className="text-emerald-400">Success: {point.completed} jobs</span>
                    <span className="text-red-400">Failed: {point.failed} jobs</span>
                  </div>

                  {/* Dual Bar stack */}
                  <div className="w-6 sm:w-8 flex flex-col justify-end rounded-t overflow-hidden hover:opacity-95 transition-opacity h-full">
                    {/* Failed Stack segment */}
                    <div style={{ height: heightFailed }} className="w-full bg-red-400 transition-all duration-500" />
                    {/* Success Stack segment */}
                    <div style={{ height: heightCompleted }} className="w-full bg-indigo-500 transition-all duration-500" />
                  </div>
                  
                  {/* Timeline label */}
                  <span className="text-[10px] text-gray-400 font-medium font-mono mt-2">{point.time}</span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 text-xs font-medium text-gray-500 pt-2">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-500" /> Successful executions</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400" /> Failed attempts</span>
            <span className="ml-auto font-mono text-[10px] text-gray-400">Rate: <strong>{throughputPerMin.toFixed(2)}</strong> runs/min</span>
          </div>
        </div>

        {/* Queues Status List */}
        <div id="queues-health-card" className="lg:col-span-4 bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900 tracking-tight">Active Queues Status</h3>
            <p className="text-xs text-gray-400 mt-0.5">Priorities & processing limits per active queue.</p>
          </div>

          <div className="space-y-4">
            {metrics.queueStats.map((q, idx) => {
              const queueInfo = queues.find(item => item.id === q.queueId);
              const isPaused = queueInfo?.isPaused === true;

              return (
                <div key={idx} id={`queue-status-row-${q.queueId}`} className="p-3 border border-gray-100 rounded-xl space-y-2 hover:border-gray-200 transition-colors">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-gray-800">{q.queueName}</span>
                      <span className="text-[10px] text-gray-400">{q.projectName}</span>
                    </div>
                    {isPaused ? (
                      <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">Paused</span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">Polling</span>
                    )}
                  </div>

                  {/* Priority & Concurrency badges */}
                  <div className="flex gap-2 text-[10px] font-mono">
                    <span className="text-gray-500">Priority: <strong>{queueInfo?.priority === 1 ? "1 (High)" : queueInfo?.priority === 2 ? "2 (Med)" : "3 (Low)"}</strong></span>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-500">Limit: <strong>{queueInfo?.concurrencyLimit}</strong> workers</span>
                  </div>

                  {/* Tiny progress status stack to represent distribution of jobs */}
                  <div className="h-1.5 w-full bg-gray-100 rounded-full flex overflow-hidden">
                    {/* completed bar segment */}
                    {q.completedCount > 0 && (
                      <div 
                        style={{ width: `${(q.completedCount / (q.queuedCount + q.runningCount + q.completedCount + q.failedCount + q.dlqCount || 1)) * 100}%` }} 
                        className="bg-emerald-400" 
                      />
                    )}
                    {/* running bar segment */}
                    {q.runningCount > 0 && (
                      <div 
                        style={{ width: `${(q.runningCount / (q.queuedCount + q.runningCount + q.completedCount + q.failedCount + q.dlqCount || 1)) * 100}%` }} 
                        className="bg-indigo-500" 
                      />
                    )}
                    {/* queued bar segment */}
                    {q.queuedCount > 0 && (
                      <div 
                        style={{ width: `${(q.queuedCount / (q.queuedCount + q.runningCount + q.completedCount + q.failedCount + q.dlqCount || 1)) * 100}%` }} 
                        className="bg-amber-400" 
                      />
                    )}
                    {/* failed bar segment */}
                    {(q.failedCount > 0 || q.dlqCount > 0) && (
                      <div 
                        style={{ width: `${((q.failedCount + q.dlqCount) / (q.queuedCount + q.runningCount + q.completedCount + q.failedCount + q.dlqCount || 1)) * 100}%` }} 
                        className="bg-red-400" 
                      />
                    )}
                  </div>

                  {/* Stats numbers footer */}
                  <div className="flex justify-between text-[9px] text-gray-500 font-medium">
                    <span className="text-amber-600">Queued: {q.queuedCount}</span>
                    <span className="text-indigo-600">Active: {q.runningCount}</span>
                    <span className="text-emerald-600">Success: {q.completedCount}</span>
                    <span className="text-red-600">Failed/DLQ: {q.failedCount + q.dlqCount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
