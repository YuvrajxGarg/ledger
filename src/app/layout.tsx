import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Film } from "lucide-react";
import "./globals.css";
import { getCurrentUser, getAllUsers, getCurrentUserRecord } from "@/lib/auth";
import { isGmailConnected } from "@/lib/google";
import { ROLE_LABEL, type Role } from "@/lib/enums";
import { SidebarNav } from "@/components/sidebar-nav";
import { RoleSwitcher } from "@/components/role-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Revolio · Accounting Automation",
  description: "Post-shoot expense management for Revolio Media.",
};

const noFlashTheme = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [user, users, record] = await Promise.all([
    getCurrentUser(),
    getAllUsers(),
    getCurrentUserRecord(),
  ]);
  const role = (user?.role ?? "PRODUCER") as Role;
  const gmailConnected = record ? isGmailConnected(record) : false;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
      </head>
      <body className="min-h-full">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
            <div className="flex items-center gap-2.5 px-5 py-5">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-sidebar-accent text-black">
                <Film size={18} />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold">Revolio</p>
                <p className="text-[11px] text-sidebar-muted">Accounting Automation</p>
              </div>
            </div>

            <div className="mt-2 flex-1 overflow-y-auto">
              <SidebarNav role={role} />
            </div>

            <div className="border-t border-sidebar-border p-3">
              <p className="mb-1.5 px-1 text-[11px] uppercase tracking-wide text-sidebar-muted">
                Viewing as · mock login
              </p>
              {user && <RoleSwitcher users={users as never} currentId={user.id} />}
              <div className="mt-2 flex items-center justify-between px-1">
                <div className="min-w-0">
                  <p className="truncate text-xs text-sidebar-muted">{user?.email}</p>
                  <p className="text-[11px] text-sidebar-muted">
                    {role ? ROLE_LABEL[role] : ""}
                  </p>
                </div>
                <ThemeToggle />
              </div>

              {/* Real Google auth (coexists with the mock role switcher during dev). */}
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-sidebar-border px-1 pt-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-sidebar-muted">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${gmailConnected ? "bg-emerald-400" : "bg-sidebar-muted"}`}
                  />
                  {gmailConnected ? "Gmail connected" : "Gmail not connected"}
                </span>
                {gmailConnected ? (
                  <a href="/api/auth/logout" className="text-[11px] text-sidebar-muted hover:underline">
                    Sign out
                  </a>
                ) : (
                  <a href="/api/auth/google" className="text-[11px] text-sidebar-accent hover:underline">
                    Sign in
                  </a>
                )}
              </div>
            </div>
          </aside>

          {/* Content */}
          <main className="min-w-0 flex-1">
            <div className="mx-auto max-w-6xl px-6 py-8 md:px-10">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
