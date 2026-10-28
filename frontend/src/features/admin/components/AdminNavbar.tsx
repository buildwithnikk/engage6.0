"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAdminAuth } from "../AdminAuthContext";

export function AdminNavbar() {
  const { user, logout } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/admin/login");
  };

  if (!user) return null;

  const roleColors = {
    admin: "bg-purple-100 text-purple-800 border-purple-200",
    reviewer: "bg-blue-100 text-blue-800 border-blue-200",
    editor: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };

  const navLinks = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/schemes", label: "Schemes" },
    { href: "/admin/sources", label: "Sources & Import" },
    { href: "/admin/schemes/new", label: "New Scheme" },
  ];

  if (user.role === "admin") {
    navLinks.push({ href: "/admin/audit", label: "Audit Log" });
  }

  return (
    <header className="border-b border-[var(--line)] bg-[var(--card)] px-4 py-3 shadow-sm sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link href="/admin" className="flex items-center space-x-2">
            <span className="text-lg font-bold tracking-tight text-indigo-600">Sahayak</span>
            <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              Admin
            </span>
          </Link>

          <nav className="hidden space-x-1 sm:flex" aria-label="Admin Navigation">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-[var(--muted)] hover:bg-slate-100 hover:text-[var(--text)]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <Link
            href="/schemes"
            target="_blank"
            className="hidden text-xs text-[var(--muted)] underline hover:text-[var(--text)] md:inline-block"
          >
            Public Portal ↗
          </Link>

          <div className="flex items-center space-x-2 text-sm">
            <span className="hidden font-medium text-[var(--text)] sm:inline">{user.email}</span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${roleColors[user.role]}`}
            >
              {user.role}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-md border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--text)] shadow-sm hover:bg-slate-50 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
