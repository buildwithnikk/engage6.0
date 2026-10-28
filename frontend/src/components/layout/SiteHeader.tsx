import Link from "next/link";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/schemes", label: "Schemes" },
  { href: "/#status", label: "System status" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-[var(--line)] bg-[var(--card)]">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-bold">Sahayak</span>
          <span className="text-xs text-[var(--muted)]">सहायक</span>
        </Link>
        <nav aria-label="Main">
          <ul className="flex gap-4 text-sm">
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
    </header>
  );
}
