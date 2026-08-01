"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { Button } from "@/components/ui";
import { saveOrgSettings, type ActionState } from "@/app/settings/actions";

const INITIAL: ActionState = { ok: false };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save size={15} /> {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

export function OrgSettingsForm({
  recipients,
  recipientsSource,
  scanStrict,
  scanStrictSource,
}: {
  recipients: string[];
  recipientsSource: string;
  scanStrict: boolean;
  scanStrictSource: string;
}) {
  const [state, action] = useActionState(saveOrgSettings, INITIAL);

  return (
    <form action={action} className="space-y-6">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="recipients" className="text-sm font-medium">
            Notification recipients
          </label>
          <SourceTag source={recipientsSource} />
        </div>
        <textarea
          id="recipients"
          name="recipients"
          rows={3}
          defaultValue={recipients.join("\n")}
          placeholder="accounts@revolio.in"
          className="w-full rounded-lg border bg-card px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          One email per line (or comma-separated). These receive workflow emails — approvals,
          flagged invoices, dispatch. Leave blank to fall back to the <code>NOTIFY_RECIPIENTS</code>{" "}
          env default.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Gmail scan strictness</span>
          <SourceTag source={scanStrictSource} />
        </div>
        <label className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5">
          <input
            type="checkbox"
            name="scanStrict"
            defaultChecked={scanStrict}
            className="mt-0.5 h-4 w-4 rounded border-input"
          />
          <span className="text-sm">
            Strict mode
            <span className="block text-xs text-muted-foreground">
              Ignore inbox mail that neither matches a shoot nor follows the Revolio invoice
              subject convention. Turn off to capture every candidate as an unmatched invoice for
              manual assignment (noisier).
            </span>
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <SaveButton />
        {state.error && <span className="text-sm text-danger">{state.error}</span>}
        {state.ok && state.message && <span className="text-sm text-success">{state.message}</span>}
      </div>
    </form>
  );
}

function SourceTag({ source }: { source: string }) {
  const label = source === "db" ? "custom" : source === "env" ? "from env" : "default";
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
      {label}
    </span>
  );
}
