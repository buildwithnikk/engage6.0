export function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <p className="muted text-sm">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function Owner({ who, module }: { who: string; module: string }) {
  return (
    <p className="muted text-xs">
      Owner: <strong>{who}</strong> · {module} · see Sahayak_Hackathon_Plan.xlsx
    </p>
  );
}
