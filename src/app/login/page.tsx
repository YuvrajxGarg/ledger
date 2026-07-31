import { Film } from "lucide-react";
import { Card, CardBody } from "@/components/ui";

const ERRORS: Record<string, string> = {
  config: "Google sign-in isn't configured yet. Add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.",
  nocode: "Google didn't return an authorization code. Please try again.",
  exchange: "Couldn't complete sign-in with Google. Please try again.",
  noemail: "Your Google account didn't share an email address.",
  access_denied: "Access was denied on the Google consent screen.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? (ERRORS[error] ?? "Sign-in failed. Please try again.") : null;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center">
      <div className="mb-6 flex items-center gap-2.5">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Film size={20} />
        </div>
        <div>
          <p className="text-base font-semibold">Revolio</p>
          <p className="text-xs text-muted-foreground">Accounting Automation</p>
        </div>
      </div>

      <Card className="w-full">
        <CardBody className="pt-5">
          <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your Google account to sign in and let Revolio scan your inbox for shoot invoices.
          </p>

          {message && (
            <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{message}</p>
          )}

          {/* Full-page navigation to the API route (not a client-side Link). */}
          <a
            href="/api/auth/google"
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border bg-card text-sm font-medium transition-colors hover:bg-muted"
          >
            <GoogleGlyph />
            Sign in with Google
          </a>

          <p className="mt-4 text-xs text-muted-foreground">
            Grants read-only access to your Gmail so invoices can be auto-matched to closing sheets.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
