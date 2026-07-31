"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { switchUser } from "@/app/actions";
import { ROLE_LABEL, type Role } from "@/lib/enums";

type U = { id: string; name: string; role: Role };

export function RoleSwitcher({ users, currentId }: { users: U[]; currentId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <label className="group relative flex cursor-pointer items-center">
      <select
        value={currentId}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          start(async () => {
            await switchUser(id);
            router.refresh();
          });
        }}
        className="w-full cursor-pointer appearance-none rounded-lg border border-sidebar-border bg-white/5 px-3 py-2 pr-8 text-sm text-sidebar-foreground outline-none focus:ring-2 focus:ring-sidebar-accent/50"
      >
        {users.map((u) => (
          <option key={u.id} value={u.id} className="bg-sidebar text-sidebar-foreground">
            {u.name} · {ROLE_LABEL[u.role]}
          </option>
        ))}
      </select>
      <ChevronsUpDown
        size={14}
        className="pointer-events-none absolute right-2.5 text-sidebar-muted"
      />
    </label>
  );
}
