"use client";

import { useEffect, useState } from "react";
import { formatINR } from "@/lib/utils";

interface Member {
  id: string;
  displayName: string;
}

interface Expense {
  id: string;
  description: string;
  date: string;
  amountInINR: string;
  currency: string;
  amountOriginal: string;
  splitType: string;
  status: string;
  paidBy: { displayName: string } | null;
  splits: { member: { displayName: string }; shareAmount: string }[];
}

export function ExpensesTab({
  groupId,
  members,
}: {
  groupId: string;
  members: Member[];
}) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    description: "",
    date: new Date().toISOString().slice(0, 10),
    paidByMemberId: members[0]?.id || "",
    amount: "",
    currency: "INR",
    splitType: "equal",
    memberIds: members.map((m) => m.id),
  });

  function load() {
    fetch(`/api/groups/${groupId}/expenses`)
      .then((r) => r.json())
      .then(setExpenses);
  }

  useEffect(() => {
    load();
  }, [groupId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/groups/${groupId}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: form.description,
        date: form.date,
        paidByMemberId: form.paidByMemberId,
        amount: parseFloat(form.amount),
        currency: form.currency,
        splitType: form.splitType,
        splits: form.memberIds.map((id) => ({ memberId: id })),
      }),
    });
    setShowForm(false);
    load();
  }

  return (
    <div>
      <div className="mb-4 flex justify-between">
        <h2 className="text-lg font-semibold">Expenses</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700"
        >
          Add expense
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 space-y-3 rounded-lg border bg-white p-4">
          <input
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-md border px-3 py-2"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="rounded-md border px-3 py-2"
            />
            <input
              type="number"
              placeholder="Amount"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="rounded-md border px-3 py-2"
              step="0.01"
              required
            />
          </div>
          <select
            value={form.paidByMemberId}
            onChange={(e) => setForm({ ...form, paidByMemberId: e.target.value })}
            className="w-full rounded-md border px-3 py-2"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                Paid by {m.displayName}
              </option>
            ))}
          </select>
          <select
            value={form.splitType}
            onChange={(e) => setForm({ ...form, splitType: e.target.value })}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="equal">Equal split</option>
            <option value="share">By shares</option>
            <option value="percentage">By percentage</option>
            <option value="unequal">Exact amounts</option>
          </select>
          <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-white">
            Save
          </button>
        </form>
      )}

      <div className="space-y-2">
        {expenses.map((exp) => (
          <div
            key={exp.id}
            className={`rounded-lg border bg-white p-4 ${
              exp.status === "pending_review" ? "border-amber-300 bg-amber-50" : ""
            }`}
          >
            <div className="flex justify-between">
              <div>
                <h3 className="font-medium">{exp.description}</h3>
                <p className="text-sm text-gray-500">
                  {exp.date.slice(0, 10)} · Paid by {exp.paidBy?.displayName || "?"}
                  {exp.status === "pending_review" && " · Pending approval"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatINR(Number(exp.amountInINR))}</p>
                {exp.currency !== "INR" && (
                  <p className="text-xs text-gray-500">
                    {exp.amountOriginal} {exp.currency}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
              {exp.splits.map((s, i) => (
                <span key={i} className="rounded bg-gray-100 px-2 py-0.5">
                  {s.member.displayName}: {formatINR(Number(s.shareAmount))}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
