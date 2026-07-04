import { useState } from "react";
import { ShieldCheck, Play, RefreshCw, Terminal, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { TestResult } from "../types";

export default function TestHub() {
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const handleRunTests = async () => {
    setIsRunningTests(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/tests/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token") || ""}`
        }
      });
      const data = await response.json();
      setTestResult(data);
    } catch (e: any) {
      setTestResult({
        testId: "test-run-error",
        testName: "Critical Reliability & Concurrency Tests",
        status: "failed",
        assertions: [{ name: "API Request Execution", passed: false, message: e.message }],
        durationMs: 0,
        logs: ["Fatal error triggering backend test suite: " + e.message]
      });
    } finally {
      setIsRunningTests(false);
    }
  };

  return (
    <div id="test-hub" className="space-y-6">
      {/* Header card info */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-gray-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            Reliability & Concurrency Stress Testing
          </h2>
          <p className="text-sm text-gray-500">
            Execute real-time backend stress tests to assert atomicity locks, queue concurrency boundaries, dependency chains, and DLQ routing.
          </p>
        </div>

        <button
          id="btn-run-stress-tests"
          onClick={handleRunTests}
          disabled={isRunningTests}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-colors self-start sm:self-center shrink-0"
        >
          {isRunningTests ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Executing Assertions...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Critical Tests
            </>
          )}
        </button>
      </div>

      {/* Tests execution result dashboard */}
      {testResult && (
        <div id="test-results-panel" className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* Left panel: Test assertions list */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-50 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Test Assertions Verification</h3>
                <p className="text-xs text-gray-400 mt-0.5">Formal correctness assertions executed directly on the live database engine.</p>
              </div>

              <span className={`px-2.5 py-1 text-[10px] font-bold rounded uppercase ${
                testResult.status === 'passed' 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {testResult.status.toUpperCase()}
              </span>
            </div>

            {/* List of assertions */}
            <div className="space-y-3">
              {testResult.assertions.map((assertion, idx) => (
                <div key={idx} className="p-3 border border-gray-100 rounded-xl flex items-start gap-3 text-xs leading-relaxed">
                  {assertion.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <strong className="text-gray-900 block font-semibold">{assertion.name}</strong>
                    <p className="text-gray-500 text-xs">{assertion.message || "Assertion parameter validated successfully."}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Test duration footer */}
            <div className="text-[10px] font-mono text-gray-400 pt-1 flex justify-between">
              <span>Test Session ID: {testResult.testId}</span>
              <span>Total duration: <strong>{testResult.durationMs}ms</strong></span>
            </div>
          </div>

          {/* Right panel: Terminal logs */}
          <div className="lg:col-span-5 bg-gray-950 text-gray-300 rounded-2xl p-5 border border-gray-800 shadow-xl font-mono text-xs flex flex-col justify-between">
            <div className="space-y-3">
              <span className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5" />
                Live Correctness trace log
              </span>

              <div className="overflow-y-auto max-h-[350px] space-y-1 text-[11px] leading-relaxed select-text">
                {testResult.logs.map((log, index) => (
                  <div key={index} className="text-gray-300">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder empty state */}
      {!testResult && !isRunningTests && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm flex flex-col items-center justify-center space-y-3 text-gray-500">
          <AlertCircle className="w-10 h-10 text-gray-400" />
          <div className="max-w-md space-y-1">
            <h3 className="font-bold text-gray-900 text-sm">No stress tests executed in this session</h3>
            <p className="text-xs text-gray-400">
              Click the button above to launch an automated suite that evaluates SQLite database transaction atomicity, queue priority compliance, backoff timers, and DLQ promotion logs.
            </p>
          </div>
        </div>
      )}

      {/* Active running state spinner */}
      {isRunningTests && !testResult && (
        <div className="bg-white rounded-2xl border border-gray-100 p-20 text-center shadow-sm flex flex-col items-center justify-center space-y-3 text-gray-500">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className="text-sm font-semibold text-gray-700">Executing ConcurrencyStressTest.ts</span>
          <span className="text-xs text-gray-400">Enforcing database claim race conditions and measuring throughput throttling...</span>
        </div>
      )}
    </div>
  );
}
