import { Server, Activity, Clock, ShieldCheck, Cpu } from "lucide-react";
import { Worker } from "../types";

interface WorkersMonitorProps {
  workers: Worker[];
  isRefreshing: boolean;
}

export default function WorkersMonitor({ workers }: WorkersMonitorProps) {
  return (
    <div id="workers-monitor" className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 tracking-tight flex items-center gap-2">
            <Server className="w-5 h-5 text-indigo-600" />
            Worker Cluster & Node Heartbeats
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Trace active processes, resources, heartbeats, and cluster saturation across active Worker instances.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          Active Workers: {workers.filter(w => w.status === 'active').length} Nodes
        </div>
      </div>

      {/* Grid of workers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {workers.map((worker) => {
          const isActive = worker.status === "active";
          const lastSeenDate = new Date(worker.lastHeartbeat);

          return (
            <div 
              key={worker.id} 
              id={`worker-card-${worker.id}`}
              className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4 hover:border-gray-200 transition-colors"
            >
              {/* Node title & status dot */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                  <span className="font-bold text-gray-900 text-sm">{worker.name}</span>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                  isActive 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 animate-pulse' 
                    : 'bg-gray-100 text-gray-400 border-gray-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                  {worker.status}
                </span>
              </div>

              {/* Node load diagnostics bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-gray-500">
                  <span className="flex items-center gap-1 text-[10px]"><Cpu className="w-3.5 h-3.5 text-gray-400" /> Active Load Saturation</span>
                  <span className="text-[10px]">{isActive ? "28%" : "0%"}</span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    style={{ width: isActive ? "28%" : "0%" }} 
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
                  />
                </div>
              </div>

              {/* Timing metrics footer */}
              <div className="border-t border-gray-50 pt-3 flex flex-col gap-1.5 text-xs font-mono text-gray-500">
                <div className="flex items-center justify-between">
                  <span className="text-[10px]">Heartbeat Frequency:</span>
                  <span className="text-gray-800 font-semibold">{isActive ? "1000ms" : "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]">Node Unique ID:</span>
                  <span className="text-gray-800 font-semibold">{worker.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] flex items-center gap-1"><Clock className="w-3 h-3 text-gray-400" /> Last Signal received:</span>
                  <span className="text-gray-800 font-semibold">{lastSeenDate.toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
