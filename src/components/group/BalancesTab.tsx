"use client";

import { useEffect, useState } from "react";
import { formatINR } from "@/lib/utils";

interface Member {
  id: string;
  displayName: string;
}

interface BalanceEntry {
  memberId: string;
  displayName: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

interface Suggestion {
  from: string;
  to: string;
  amount: number;
}

interface Contribution {
  expenseId: string;
  description: string;
  date: string;
  paidBy: string;
  yourShare: number;
  youPaid: number;
  netEffect: number;
}

export function BalancesTab({
  groupId,
  members,
}: {
  groupId: string;
  members: Member[];
}) {
  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [contributions, setContributions] = useState<Contribution[]>([]);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/balances`)
      .then((r) => r.json())
      .then((data) => {
        setBalances(data.balances || []);
        setSuggestions(data.suggestions || []);
      });
  }, [groupId]);

  useEffect(() => {
    if (!selectedMember) {
      setContributions([]);
      return;
    }
    fetch(`/api/groups/${groupId}/balances?memberId=${selectedMember}`)
      .then((r) => r.json())
      .then((data) => setContributions(data.contributions || []));
  }, [groupId, selectedMember]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-lg font-semibold">Who pays whom</h2>
        {suggestions.length === 0 ? (
          <p className="text-gray-500">All settled up!</p>
        ) : (
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border bg-white p-4"
              >
                <span>
                  <strong>{s.from}</strong> pays <strong>{s.to}</strong>
                </span>
                <span className="font-mono text-lg font-semibold text-brand-700">
                  {formatINR(s.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Net balances</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Member</th>
                <th className="px-4 py-2 text-right">Paid</th>
                <th className="px-4 py-2 text-right">Owed</th>
                <th className="px-4 py-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.memberId} className="border-t">
                  <td className="px-4 py-2 font-medium">{b.displayName}</td>
                  <td className="px-4 py-2 text-right">{formatINR(b.totalPaid)}</td>
                  <td className="px-4 py-2 text-right">{formatINR(b.totalOwed)}</td>
                  <td
                    className={`px-4 py-2 text-right font-semibold ${
                      b.netBalance >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {b.netBalance >= 0 ? "+" : ""}
                    {formatINR(b.netBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Expense breakdown</h2>
        <p className="mb-3 text-sm text-gray-500">
          Select a member to see exactly which expenses make up their balance.
        </p>
        <select
          value={selectedMember}
          onChange={(e) => setSelectedMember(e.target.value)}
          className="mb-4 rounded-md border px-3 py-2"
        >
          <option value="">Choose member...</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>

        {contributions.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Expense</th>
                  <th className="px-4 py-2 text-left">Paid by</th>
                  <th className="px-4 py-2 text-right">Your share</th>
                  <th className="px-4 py-2 text-right">You paid</th>
                  <th className="px-4 py-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {contributions.map((c) => (
                  <tr key={c.expenseId} className="border-t">
                    <td className="px-4 py-2">{c.date}</td>
                    <td className="px-4 py-2">{c.description}</td>
                    <td className="px-4 py-2">{c.paidBy}</td>
                    <td className="px-4 py-2 text-right">{formatINR(c.yourShare)}</td>
                    <td className="px-4 py-2 text-right">{formatINR(c.youPaid)}</td>
                    <td
                      className={`px-4 py-2 text-right font-medium ${
                        c.netEffect >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {c.netEffect >= 0 ? "+" : ""}
                      {formatINR(c.netEffect)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
