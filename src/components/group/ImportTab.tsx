"use client";

import { useEffect, useState } from "react";

interface Anomaly {
  id: string;
  rowNumber: number;
  anomalyType: string;
  description: string;
  action: string;
  actionDetail: string | null;
  requiresApproval: boolean;
  approved: boolean | null;
}

interface ImportSession {
  id: string;
  filename: string;
  status: string;
  summary: string | {
    totalRows: number;
    imported: number;
    settlements: number;
    skipped: number;
    pendingApproval: number;
    anomalyCount: number;
  } | null;
  createdAt: string;
  anomalies: Anomaly[];
}

export function ImportTab({ groupId }: { groupId: string }) {
  const [sessions, setSessions] = useState<ImportSession[]>([]);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportSession | null>(null);

  function load() {
    fetch(`/api/groups/${groupId}/import`)
      .then((r) => r.json())
      .then(setSessions);
  }

  useEffect(() => {
    load();
  }, [groupId]);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/groups/${groupId}/import`, {
      method: "POST",
      body: formData,
    });
    const result = await res.json();
    setImporting(false);

    if (result.sessionId) {
      load();
      const sessionRes = await fetch(`/api/groups/${groupId}/import`);
      const all = await sessionRes.json();
      const session = all.find((s: ImportSession) => s.id === result.sessionId);
      setReport(session || null);
    }
  }

  async function handleApproval(anomalyId: string, approved: boolean) {
    await fetch("/api/import/approve", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anomalyId, approved }),
    });
    load();
  }

  const actionColor: Record<string, string> = {
    auto_fixed: "bg-blue-100 text-blue-800",
    converted: "bg-purple-100 text-purple-800",
    skipped: "bg-gray-100 text-gray-800",
    pending_approval: "bg-amber-100 text-amber-800",
    flagged: "bg-orange-100 text-orange-800",
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-2 text-lg font-semibold">Import CSV</h2>
        <p className="mb-4 text-sm text-gray-500">
          Upload <code className="rounded bg-gray-100 px-1">expenses_export.csv</code> as provided.
          Anomalies are detected and surfaced — nothing is silently guessed.
        </p>
        <label className="inline-block cursor-pointer rounded-md bg-brand-600 px-4 py-2 text-white hover:bg-brand-700">
          {importing ? "Importing..." : "Choose CSV file"}
          <input
            type="file"
            accept=".csv"
            onChange={handleImport}
            disabled={importing}
            className="hidden"
          />
        </label>
      </section>

      {(report || sessions[0]) && (
        <section className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Import report</h2>
          {(() => {
            const s = report || sessions[0];
            const summary = typeof s.summary === "string"
              ? JSON.parse(s.summary)
              : s.summary;
            return (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <Stat label="Total rows" value={summary?.totalRows ?? "—"} />
                  <Stat label="Imported" value={summary?.imported ?? "—"} />
                  <Stat label="Settlements" value={summary?.settlements ?? "—"} />
                  <Stat label="Skipped" value={summary?.skipped ?? "—"} />
                  <Stat label="Pending approval" value={summary?.pendingApproval ?? "—"} />
                </div>

                <h3 className="mb-2 font-medium">
                  Anomalies detected ({s.anomalies.length})
                </h3>
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {s.anomalies.map((a) => (
                    <div key={a.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-xs text-gray-500">
                            Row {a.rowNumber}
                          </span>
                          <span
                            className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
                              actionColor[a.action] || "bg-gray-100"
                            }`}
                          >
                            {a.anomalyType}
                          </span>
                          <p className="mt-1">{a.description}</p>
                          {a.actionDetail && (
                            <p className="mt-1 text-gray-600">→ {a.actionDetail}</p>
                          )}
                        </div>
                        {a.requiresApproval && a.approved === null && (
                          <div className="flex shrink-0 gap-1">
                            <button
                              onClick={() => handleApproval(a.id, true)}
                              className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleApproval(a.id, false)}
                              className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {a.approved === true && (
                          <span className="text-xs text-green-700">Approved</span>
                        )}
                        {a.approved === false && (
                          <span className="text-xs text-red-700">Rejected</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </section>
      )}

      {sessions.length > 1 && (
        <section>
          <h3 className="mb-2 font-medium">Previous imports</h3>
          <div className="space-y-1 text-sm text-gray-600">
            {sessions.slice(1).map((s) => (
              <p key={s.id}>
                {s.filename} — {new Date(s.createdAt).toLocaleString()} ({s.status})
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-gray-50 p-3 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
