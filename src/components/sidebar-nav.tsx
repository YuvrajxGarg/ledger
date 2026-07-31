"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ReceiptText,
  Wallet,
  Users,
  Send,
  CreditCard,
  Scale,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/enums";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  roles?: Role[]; // undefined = everyone
};

const items: Item[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/closing-sheets", label: "Closing Sheets", icon: FileText },
  { href: "/reimbursements", label: "Reimbursements", icon: Wallet },
  { href: "/vendors", label: "Vendors", icon: Users },
  { href: "/dispatch", label: "Dispatch", icon: Send, roles: ["SENIOR_PRODUCER", "ADMIN"] },
  { href: "/accounts", label: "Accounts", icon: CreditCard, roles: ["ACCOUNTS", "ADMIN"] },
  { href: "/ledger", label: "Ledger", icon: Scale, roles: ["SENIOR_PRODUCER", "ACCOUNTS", "ADMIN"] },
  { href: "/invoices", label: "Invoices", icon: ReceiptText },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["ADMIN"] },
];

export function SidebarNav({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {items
        .filter((i) => !i.roles || i.roles.includes(role))
        .map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-white/10 text-sidebar-foreground font-medium"
                  : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground",
              )}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
