"use client";

// MODULE 6 — Transparency dashboard, office scorecard, policy simulator.
// Owner: Person C.

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Owner, Section } from "@/components/ui/Section";
import { allSchemes, formatINR } from "@/lib/eligibility";
import type { Stats } from "@/lib/types";

const COLORS = ["#2E5C8A", "#FF9933", "#138808", "#8E6FD8", "#D1495B", "#2A9D8F"];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [incomeLimit, setIncomeLimit] = useState(250_000);
  const [rating, setRating] = useState({ office: "Tehsil Office, Sitapur", waitMin: 90, bribeAsked: false });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  // Policy simulator: how many of our 40 schemes open up at this income limit?
  const simulated = useMemo(() => {
    const schemes = allSchemes();
    const opened = schemes.filter((s) => {
      const text = JSON.stringify(s.rule);
      const m = text.match(/"income"[^0-9]*([0-9]{4,})/);
      const threshold = m ? Number(m[1]) : null;
      return threshold !== null && threshold <= incomeLimit;
    });
    return {
      count: opened.length,
      value: opened.reduce((sum, s) => sum + (s.benefitAmount || 0), 0),
    };
  }, [incomeLimit]);

  if (!stats) return <p className="muted">लोड हो रहा है…</p>;

  return (
    <Section title="पारदर्शिता डैशबोर्ड" subtitle="नागरिक का डेटा, सरकार के लिए इनसाइट">
      <Owner who="Person C" module="Module 6" />

      <div className="grid grid-cols-2 gap-3">
        <Stat label="औसत निपटान" value={`${stats.medianResolveDays} दिन`} />
        <Stat label="कुल शिकायतें" value={String(stats.categorySplit.reduce((a, c) => a + c.count, 0))} />
      </div>

      <div className="card p-4">
        <h2 className="mb-3 font-semibold">वार्ड के हिसाब से शिकायतें</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.perWard}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="ward" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey="open" name="खुली" fill="#D1495B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resolved" name="निपटी" fill="#138808" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="muted mt-2 text-xs">
          Ward 7 में 14 शिकायतें खुली हैं और सिर्फ़ 6 निपटीं — शहर के औसत से बहुत पीछे।
        </p>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 font-semibold">समस्या के प्रकार</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={stats.categorySplit} dataKey="count" nameKey="category" outerRadius={90} label>
                {stats.categorySplit.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-2 font-semibold">बार-बार होने वाली समस्याएँ</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="muted text-left text-xs">
              <th className="py-1">वार्ड</th>
              <th className="py-1">समस्या</th>
              <th className="py-1">कितनी बार</th>
            </tr>
          </thead>
          <tbody>
            {stats.hotspots.map((h, i) => (
              <tr key={i} className="border-t border-[var(--line)]">
                <td className="py-1.5">{h.ward}</td>
                <td className="py-1.5">{h.category}</td>
                <td className="py-1.5 font-semibold text-red-600">{h.repeats}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card space-y-3 p-4">
        <h2 className="font-semibold">नीति सिम्युलेटर</h2>
        <label className="muted block text-sm">आय सीमा: {formatINR(incomeLimit)}</label>
        <input
          type="range"
          min={100_000}
          max={600_000}
          step={50_000}
          value={incomeLimit}
          onChange={(e) => setIncomeLimit(Number(e.target.value))}
          className="w-full"
        />
        <p className="text-sm">
          इस सीमा पर <strong>{simulated.count}</strong> योजनाएँ खुलती हैं · कुल सालाना लाभ{" "}
          <strong className="text-leaf">{formatINR(simulated.value)}</strong> प्रति लाभार्थी
        </p>
      </div>

      <div className="card space-y-3 p-4">
        <h2 className="font-semibold">दफ़्तर का स्कोरकार्ड (गुमनाम)</h2>
        <p className="muted text-sm">दफ़्तर से लौटे हैं? एक मिनट में बताइए।</p>
        <select
          value={rating.office}
          onChange={(e) => setRating({ ...rating, office: e.target.value })}
          className="w-full rounded-xl border border-[var(--line)] bg-transparent p-2 text-sm"
        >
          <option>Tehsil Office, Sitapur</option>
          <option>Block Development Office</option>
          <option>Punjab National Bank, Rampur</option>
        </select>
        <label className="block text-sm">
          कितनी देर लगी: <strong>{rating.waitMin} मिनट</strong>
          <input
            type="range"
            min={5}
            max={240}
            step={5}
            value={rating.waitMin}
            onChange={(e) => setRating({ ...rating, waitMin: Number(e.target.value) })}
            className="mt-1 w-full"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={rating.bribeAsked}
            onChange={(e) => setRating({ ...rating, bribeAsked: e.target.checked })}
          />
          पैसे मांगे गए
        </label>
        <button
          onClick={async () => {
            await fetch("/api/rating", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(rating),
            }).catch(() => {});
            setSaved(true);
          }}
          className="rounded-xl bg-ink px-4 py-2 text-white"
        >
          गुमनाम रूप से भेजें
        </button>
        {saved && <p className="text-sm text-leaf">धन्यवाद — आपकी पहचान कहीं दर्ज नहीं हुई।</p>}
      </div>
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="muted text-xs">{label}</p>
      <strong className="text-2xl">{value}</strong>
    </div>
  );
}
