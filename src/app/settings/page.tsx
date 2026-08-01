import { Mail, ScanLine, Bot, ShieldCheck, Users as UsersIcon } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { isGmailConnected, googleConfigured } from "@/lib/google";
import { getEffectiveSettings } from "@/lib/settings";
import { PageHeader, Card, CardHeader, CardTitle, CardBody, Badge, EmptyState } from "@/components/ui";
import { UserManagement } from "@/components/settings/user-management";
import { OrgSettingsForm } from "@/components/settings/org-settings-form";

export default async function SettingsPage() {
  const me = await requireUser();

  if (!can(me.role, "configure")) {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" description="Admin configuration." />
        <EmptyState
          title="Admins only"
          description="Settings are restricted to admin users. Switch to an admin account to manage users and configuration."
        />
      </div>
    );
  }

  const [users, settings] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { projects: true } } },
    }),
    getEffectiveSettings(),
  ]);

  const userRows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    gmailConnected: isGmailConnected(u),
    projectCount: u._count.projects,
  }));

  const smtpConfigured = !!(process.env.SMTP_URL || process.env.SMTP_HOST);
  const aiProvider = process.env.AI_PROVIDER ?? "mock";
  const aiModel = process.env.MUAPI_MODEL ?? null;
  const oauthReady = googleConfigured();
  const anyGmail = userRows.some((u) => u.gmailConnected);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage users, notifications, and integrations." />

      <Card>
        <CardHeader className="flex items-center gap-2">
          <UsersIcon size={16} className="text-muted-foreground" />
          <CardTitle>User management</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="mb-4 text-sm text-muted-foreground">
            Add teammates, set their role, or remove access. Roles gate what each person can do —
            approvals, dispatch, accounts, and this page.
          </p>
          <UserManagement users={userRows} currentUserId={me.id} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <Mail size={16} className="text-muted-foreground" />
          <CardTitle>Notifications &amp; automation</CardTitle>
        </CardHeader>
        <CardBody>
          <OrgSettingsForm
            recipients={settings.notifyRecipients.value}
            recipientsSource={settings.notifyRecipients.source}
            scanStrict={settings.gmailScanStrict.value}
            scanStrictSource={settings.gmailScanStrict.source}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-muted-foreground" />
          <CardTitle>Connections &amp; system</CardTitle>
        </CardHeader>
        <CardBody className="space-y-1">
          <p className="mb-3 text-sm text-muted-foreground">
            Read-only status of the integrations this app depends on. These are configured via
            environment variables on the server.
          </p>
          <StatusRow
            icon={<ShieldCheck size={15} />}
            label="Google OAuth"
            hint="GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET"
            ok={oauthReady}
            okLabel="Configured"
            offLabel="Not configured"
          />
          <StatusRow
            icon={<ScanLine size={15} />}
            label="Gmail scanning"
            hint={anyGmail ? "At least one inbox connected" : "No inbox connected yet"}
            ok={anyGmail}
            okLabel="Active"
            offLabel="Inactive"
          />
          <StatusRow
            icon={<Mail size={15} />}
            label="Email delivery (SMTP)"
            hint={smtpConfigured ? "SMTP_HOST / SMTP_URL set" : "Falls back to console preview"}
            ok={smtpConfigured}
            okLabel="Live"
            offLabel="Dev (console)"
            neutralWhenOff
          />
          <StatusRow
            icon={<Bot size={15} />}
            label="AI provider"
            hint={aiModel ? `Model: ${aiModel}` : "Deterministic regex fallback"}
            ok={aiProvider !== "mock"}
            okLabel={aiProvider}
            offLabel="mock"
            neutralWhenOff
          />
        </CardBody>
      </Card>
    </div>
  );
}

function StatusRow({
  icon,
  label,
  hint,
  ok,
  okLabel,
  offLabel,
  neutralWhenOff = false,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  ok: boolean;
  okLabel: string;
  offLabel: string;
  neutralWhenOff?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-2.5 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">{icon}</span>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      <Badge tone={ok ? "success" : neutralWhenOff ? "neutral" : "warning"}>
        {ok ? okLabel : offLabel}
      </Badge>
    </div>
  );
}
