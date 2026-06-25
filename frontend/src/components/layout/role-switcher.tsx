"use client";

import { useUser } from "@/lib/user-context";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const ROLE_LABEL: Record<string, string> = {
  admin: "Content Admin",
  manager: "HR / Manager",
  employee: "Employee",
};

export function RoleSwitcher() {
  const { users, currentUser, setCurrentUser, loading } = useUser();

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }
  if (!currentUser) {
    return <div className="text-sm text-destructive">No users</div>;
  }

  return (
    <div className="flex items-center gap-3">
      <Badge variant="outline">{ROLE_LABEL[currentUser.role] ?? currentUser.role}</Badge>
      <Select
        value={String(currentUser.id)}
        onChange={(e) => {
          const next = users.find((u) => u.id === Number(e.target.value));
          if (next) setCurrentUser(next);
        }}
        className="w-[220px]"
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} — {ROLE_LABEL[u.role] ?? u.role}
          </option>
        ))}
      </Select>
    </div>
  );
}
