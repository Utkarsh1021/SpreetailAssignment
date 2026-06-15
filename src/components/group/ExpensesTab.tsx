"use client";

import { useEffect, useState } from "react";
import { formatINR } from "@/lib/utils";
import {
  Plus,
  Calendar,
  User,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  X,
  CreditCard,
  Users
} from "lucide-react";

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
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Group Expenses</h2>
          <p className="text-sm text-slate-500">Manage and track spending within your group</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 active:scale-95"
          style={{ minHeight: '44px' }}
        >
          <Plus className="h-4 w-4" />
          Add Expense
        </button>
      </div>

      {/* Add Expense Form */}
      {showForm && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
            <h3 className="font-semibold text-slate-800">New Expense</h3>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Description</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <CreditCard className="h-4 w-4" />
                </div>
                <input
                  placeholder="What was this for?"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Date</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Amount</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <span className="text-xs font-bold">₹</span>
                  </div>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2.5 pl-8 pr-4 text-sm font-medium focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                    step="0.01"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Paid By</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <select
                    value={form.paidByMemberId}
                    onChange={(e) => setForm({ ...form, paidByMemberId: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm appearance-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.displayName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Split Type</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Users className="h-4 w-4" />
                  </div>
                  <select
                    value={form.splitType}
                    onChange={(e) => setForm({ ...form, splitType: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm appearance-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                  >
                    <option value="equal">Equal split</option>
                    <option value="share">By shares</option>
                    <option value="percentage">By percentage</option>
                    <option value="unequal">Exact amounts</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-brand-700 active:scale-95"
                style={{ minHeight: '44px' }}
              >
                Save Expense
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Expenses List */}
      <div className="grid gap-4">
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center">
            <div className="rounded-full bg-slate-100 p-4 mb-3">
              <CreditCard className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-900">No expenses yet</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
              Start by adding the first expense to track your group&apos;s spending.
            </p>
          </div>
        ) : (
          expenses.map((exp) => (
            <div
              key={exp.id}
              className={`group relative rounded-2xl border transition-all duration-200 hover:shadow-md ${
                exp.status === "pending_review"
                  ? "border-amber-200 bg-amber-50/30"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className={`rounded-full p-3 ${
                      exp.status === "pending_review" ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-600"
                    }`}>
                      {exp.status === "pending_review" ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                        {exp.description}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {exp.date.slice(0, 10)}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Paid by {exp.paidBy?.displayName || "?"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900 tabular-nums">
                      {formatINR(Number(exp.amountInINR))}
                    </p>
                    {exp.currency !== "INR" && (
                      <p className="text-xs font-medium text-slate-400 tabular-nums">
                        {exp.amountOriginal} {exp.currency}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-wrap gap-2">
                    {exp.splits.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm"
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                        {s.member.displayName}: <span className="text-slate-900 tabular-nums">{formatINR(Number(s.shareAmount))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {exp.status === "pending_review" && (
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-700/10">
                    Pending Review
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
