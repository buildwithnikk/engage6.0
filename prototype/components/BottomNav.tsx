"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, IndianRupee, ScanLine, FileText, Megaphone, Bus, BarChart3, Settings } from "lucide-react";
import { useLang } from "./LangProvider";

const TABS = [
  { href: "/", key: "home", Icon: Home },
  { href: "/schemes", key: "schemes", Icon: IndianRupee },
  { href: "/scan", key: "scan", Icon: ScanLine },
  { href: "/form", key: "form", Icon: FileText },
  { href: "/complaint", key: "complaint", Icon: Megaphone },
  { href: "/transport", key: "transport", Icon: Bus },
  { href: "/dashboard", key: "dashboard", Icon: BarChart3 },
  { href: "/settings", key: "settings", Icon: Settings },
];

export default function BottomNav() {
  const path = usePathname();
  const { t } = useLang();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--line)] bg-[var(--card)]">
      <ul className="mx-auto grid max-w-3xl grid-cols-8">
        {TABS.map(({ href, key, Icon }) => {
          const active = path === href;
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${active ? "text-brand" : "muted"}`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-brand" : ""}`} />
                <span className="truncate">{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
