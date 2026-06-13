"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { ExpensesTab } from "@/components/group/ExpensesTab";
import { BalancesTab } from "@/components/group/BalancesTab";
import { ImportTab } from "@/components/group/ImportTab";
import { SettlementsTab } from "@/components/group/SettlementsTab";
import { MembersTab } from "@/components/group/MembersTab";

type Tab = "expenses" | "balances" | "import" | "settlements" | "members";

interface Group {
  id: string;
  name: string;
  description: string | null;
  members: { id: string; displayName: string; joinedAt: string; leftAt: string | null }[];
}

export default function GroupPage() {
  const params = useParams();
  const groupId = params.id as string;
  const [group, setGroup] = useState<Group | null>(null);
  const [tab, setTab] = useState<Tab>("balances");

  useEffect(() => {
    fetch(`/api/groups/${groupId}`)
      .then((r) => r.json())
      .then(setGroup);
  }, [groupId]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "balances", label: "Balances" },
    { key: "expenses", label: "Expenses" },
    { key: "import", label: "Import" },
    { key: "settlements", label: "Settlements" },
    { key: "members", label: "Members" },
  ];

  if (!group) {
    return (
      <>
        <Navbar />
        <div className="p-8 text-center text-gray-500">Loading...</div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-1 text-2xl font-bold">{group.name}</h1>
        {group.description && (
          <p className="mb-4 text-gray-500">{group.description}</p>
        )}

        <div className="mb-6 flex gap-1 border-b">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium ${
                tab === t.key
                  ? "border-b-2 border-brand-600 text-brand-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "balances" && <BalancesTab groupId={groupId} members={group.members} />}
        {tab === "expenses" && <ExpensesTab groupId={groupId} members={group.members} />}
        {tab === "import" && <ImportTab groupId={groupId} />}
        {tab === "settlements" && <SettlementsTab groupId={groupId} members={group.members} />}
        {tab === "members" && <MembersTab groupId={groupId} members={group.members} />}
      </main>
    </>
  );
}
