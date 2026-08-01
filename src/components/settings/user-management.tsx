"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { UserPlus, Trash2 } from "lucide-react";
import { Role, ROLE_LABEL } from "@/lib/enums";
import { Button, Badge } from "@/components/ui";
import { addUser, changeUserRole, removeUser, type ActionState } from "@/app/settings/actions";

type Row = {
  id: string;
  name: string;
  email: string;
  role: string;
  gmailConnected: boolean;
  projectCount: number;
};

const ROLES = Object.values(Role);
const INITIAL: ActionState = { ok: false };

function SubmitButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {children}
    </Button>
  );
}

function AddUserForm() {
  const [state, action] = useActionState(addUser, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input
          name="name"
          placeholder="Full name"
          aria-label="Full name"
          className="h-9 rounded-lg border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <input
          name="email"
          type="email"
          placeholder="email@revolio.in"
          aria-label="Email"
          className="h-9 rounded-lg border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex gap-2">
          <select
            name="role"
            defaultValue={Role.PRODUCER}
            aria-label="Role"
            className="h-9 rounded-lg border bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <SubmitButton>
            <UserPlus size={15} /> Add
          </SubmitButton>
        </div>
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && state.message && <p className="text-sm text-success">{state.message}</p>}
    </form>
  );
}

function RemoveButton({ userId, disabled }: { userId: string; disabled: boolean }) {
  const [state, action] = useActionState(removeUser, INITIAL);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Remove this user? This can't be undone.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        disabled={disabled}
        title={disabled ? "You can't remove your own account" : state.error ?? "Remove user"}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-40 disabled:pointer-events-none"
      >
        <Trash2 size={15} />
        <span className="sr-only">Remove {userId}</span>
      </button>
      {state.error && (
        <span className="pointer-events-none absolute right-4 z-10 mt-1 max-w-xs rounded-md bg-danger px-2 py-1 text-xs text-white shadow-lg">
          {state.error}
        </span>
      )}
    </form>
  );
}

export function UserManagement({ users, currentUserId }: { users: Row[]; currentUserId: string }) {
  return (
    <div className="space-y-5">
      <AddUserForm />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Gmail</th>
              <th className="px-4 py-2.5 text-right font-medium">Remove</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">
                      {u.name}
                      {isSelf && !/\(you\)/i.test(u.name) && (
                        <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <form action={changeUserRole}>
                      <input type="hidden" name="userId" value={u.id} />
                      <select
                        name="role"
                        defaultValue={u.role}
                        aria-label={`Role for ${u.name}`}
                        onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        className="h-8 rounded-lg border bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </form>
                  </td>
                  <td className="px-4 py-2.5">
                    {u.gmailConnected ? (
                      <Badge tone="success">Connected</Badge>
                    ) : (
                      <Badge tone="neutral">—</Badge>
                    )}
                  </td>
                  <td className="relative px-4 py-2.5 text-right">
                    <div className="flex justify-end">
                      <RemoveButton userId={u.id} disabled={isSelf} />
                    </div>
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
