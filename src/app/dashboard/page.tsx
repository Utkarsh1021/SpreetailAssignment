"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";

interface Group {
  id: string;
  name: string;
  description: string | null;
  _count: { members: number; expenses: number };
}

export default function DashboardPage() {
  const { status } = useSession();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/groups")
        .then((r) => r.json())
        .then(setGroups)
        .finally(() => setLoading(false));
    }
  }, [status]);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: "Flatmates shared expenses",
        members: [
          { displayName: "Aisha", joinedAt: "2026-02-01" },
          { displayName: "Rohan", joinedAt: "2026-02-01" },
          { displayName: "Priya", joinedAt: "2026-02-01" },
          { displayName: "Meera", joinedAt: "2026-02-01", leftAt: "2026-03-31" },
          { displayName: "Dev", joinedAt: "2026-02-08", leftAt: "2026-03-14" },
          { displayName: "Sam", joinedAt: "2026-04-08" },
        ],
      }),
    });
    const group = await res.json();
    router.push(`/groups/${group.id}`);
  }

  if (status === "loading" || loading) {
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
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Your groups</h1>

        <form onSubmit={createGroup} className="mb-8 flex gap-2">
          <input
            type="text"
            placeholder="New group name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-md border px-3 py-2"
            required
          />
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
          >
            Create group
          </button>
        </form>

        {groups.length === 0 ? (
          <p className="text-gray-500">
            No groups yet. Create one to get started, then import your CSV.
          </p>
        ) : (
          <div className="grid gap-4">
            {groups.map((g) => (
              <Link
                key={g.id}
                href={`/groups/${g.id}`}
                className="block rounded-xl border bg-white p-4 hover:border-brand-500"
              >
                <h2 className="font-semibold">{g.name}</h2>
                <p className="text-sm text-gray-500">
                  {g._count.members} members · {g._count.expenses} expenses
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
