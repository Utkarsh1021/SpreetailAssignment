"use client";

interface Member {
  id: string;
  displayName: string;
  joinedAt: string;
  leftAt: string | null;
}

export function MembersTab({
  groupId,
  members,
}: {
  groupId: string;
  members: Member[];
}) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Group members</h2>
      <p className="mb-4 text-sm text-gray-500">
        Membership dates control who is included in expense splits. Sam (joined mid-April)
        won&apos;t be charged for March electricity; Meera (left end of March) is excluded
        from post-departure splits.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Joined</th>
              <th className="px-4 py-2 text-left">Left</th>
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const now = new Date();
              const joined = new Date(m.joinedAt);
              const left = m.leftAt ? new Date(m.leftAt) : null;
              const active = joined <= now && (!left || left >= now);

              return (
                <tr key={m.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{m.displayName}</td>
                  <td className="px-4 py-2">{joined.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-2">
                    {left ? left.toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
