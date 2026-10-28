import Link from "next/link";
import { PreferencesHeaderControl } from "@/features/preferences/PreferencesHeaderControl";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/schemes", label: "Schemes" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-[var(--line)] bg-[var(--card)]">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-bold">Sahayak</span>
          <span className="text-xs text-[var(--muted)]">सहायक</span>
        </Link>

        <div className="flex items-center gap-4">
          <PreferencesHeaderControl />
          <nav aria-label="Main">
            <ul className="flex gap-3 text-sm">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-[var(--muted)] hover:text-[var(--text)]">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
