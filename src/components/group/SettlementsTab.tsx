"use client";

import { useEffect, useState } from "react";
import { formatINR } from "@/lib/utils";

interface Member {
  id: string;
  displayName: string;
}

interface Settlement {
  id: string;
  amount: string;
  date: string;
  notes: string | null;
  fromMember: { displayName: string };
  toMember: { displayName: string };
}

export function SettlementsTab({
  groupId,
  members,
}: {
  groupId: string;
  members: Member[];
}) {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    fromMemberId: members[0]?.id || "",
    toMemberId: members[1]?.id || "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  function load() {
    fetch(`/api/groups/${groupId}/settlements`)
      .then((r) => r.json())
      .then(setSettlements);
  }

  useEffect(() => {
    load();
  }, [groupId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/groups/${groupId}/settlements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount: parseFloat(form.amount),
      }),
    });
    setShowForm(false);
    load();
  }

  return (
    <div>
      <div className="mb-4 flex justify-between">
        <h2 className="text-lg font-semibold">Settlements</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700"
        >
          Record payment
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 space-y-3 rounded-lg border bg-white p-4">
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.fromMemberId}
              onChange={(e) => setForm({ ...form, fromMemberId: e.target.value })}
              className="rounded-md border px-3 py-2"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  From: {m.displayName}
                </option>
              ))}
            </select>
            <select
              value={form.toMemberId}
              onChange={(e) => setForm({ ...form, toMemberId: e.target.value })}
              className="rounded-md border px-3 py-2"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  To: {m.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              placeholder="Amount"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="rounded-md border px-3 py-2"
              step="0.01"
              required
            />
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="rounded-md border px-3 py-2"
            />
          </div>
          <input
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full rounded-md border px-3 py-2"
          />
          <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-white">
            Record
          </button>
        </form>
      )}

      <div className="space-y-2">
        {settlements.map((s) => (
          <div key={s.id} className="rounded-lg border bg-white p-4">
            <div className="flex justify-between">
              <div>
                <p className="font-medium">
                  {s.fromMember.displayName} → {s.toMember.displayName}
                </p>
                <p className="text-sm text-gray-500">
                  {s.date.slice(0, 10)}
                  {s.notes && ` · ${s.notes}`}
                </p>
              </div>
              <p className="font-semibold text-brand-700">
                {formatINR(Number(s.amount))}
              </p>
            </div>
          </div>
        ))}
        {settlements.length === 0 && (
          <p className="text-gray-500">No settlements recorded yet.</p>
        )}
      </div>
    </div>
  );
}
