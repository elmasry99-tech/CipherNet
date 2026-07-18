"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { APP_NAV, ROLE_LABELS } from "@/lib/constants";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { BrandMark } from "./BrandMark";

export function AppScaffold({
  role,
  title,
  subtitle,
  pathname,
  onLogout,
  actions,
  children,
}) {
  const router = useRouter();
  const navItems = APP_NAV[role] || [];

  return (
    <main className="min-h-screen px-6 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[22px] border border-[var(--border-dark)] bg-[rgba(11,24,43,0.82)] shadow-[0_28px_90px_rgba(2,6,23,0.38)] backdrop-blur sm:rounded-[26px]">
        <div className="border-b border-[var(--border-dark)] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark />
              <div className="min-w-0">
                <p className="truncate text-[18px] font-medium text-white sm:text-[20px]">{title}</p>
                <p className="truncate text-sm text-slate-300">{subtitle || ROLE_LABELS[role]}</p>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              {actions}
              <button
                type="button"
                onClick={() => {
                  onLogout?.();
                  router.replace(ROUTES.home);
                }}
                className="inline-flex items-center gap-2 rounded-[14px] border border-[var(--border-dark)] bg-white/5 px-4 py-2 text-sm text-slate-100"
              >
                <LogOut className="h-4 w-4" />
                Log Out
              </button>
            </div>
          </div>
        </div>

        <div className="border-b border-[var(--border-dark)] px-4 py-3 lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-[14px] px-4 py-2 text-sm font-medium transition",
                  pathname === item.href
                    ? "bg-[rgba(60,195,214,0.14)] text-[var(--accent)]"
                    : "border border-[var(--border-dark)] bg-white/5 text-slate-200",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[260px_1fr]">
          <aside className="hidden overflow-y-auto border-r border-[var(--border-dark)] p-4 lg:block">
            <div className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-[14px] px-4 py-3 text-sm font-medium transition",
                    pathname === item.href
                      ? "bg-[linear-gradient(135deg,#17314d,#1f4266)] text-white shadow-[0_10px_24px_rgba(23,49,77,0.28)]"
                      : "text-slate-300 hover:bg-white/6",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </aside>

          <div className="overflow-y-auto bg-[var(--surface-light)] p-4 sm:p-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
