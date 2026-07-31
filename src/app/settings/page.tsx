import { ComingSoon } from "@/components/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      title="Settings"
      description="Admin configuration."
      phase="Phase 1–2"
      points={[
        "User management and roles",
        "Invoice format & validation rules configuration",
        "Google OAuth / Gmail connection (needs Google Cloud credentials)",
        "Notification recipients and email transport",
      ]}
    />
  );
}
