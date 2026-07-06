import type { Check } from "@/lib/scoring";

const STATUS_STYLES: Record<Check["status"], string> = {
  pass: "bg-lime text-ink",
  warn: "bg-amber-100 text-amber-900",
  fail: "bg-red-100 text-red-700",
};

interface CheckCardProps {
  check: Check;
  statusLabel: string;
}

export function CheckCard({ check, statusLabel }: CheckCardProps) {
  return (
    <div
      data-testid="check-card"
      className="border-ink/10 rounded-2xl border p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{check.label}</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[check.status]}`}
        >
          {statusLabel}
        </span>
      </div>
      <p className="text-ink/70 mt-2 text-sm leading-relaxed">{check.detail}</p>
      <p
        data-testid="fix-hint"
        className="bg-violet/5 text-violet mt-3 rounded-xl px-4 py-3 text-sm leading-relaxed font-medium"
      >
        {check.fixHint}
      </p>
    </div>
  );
}

/**
 * A locked check: real label, placeholder body. The actual detail and fix
 * hint are never sent to the client until the report is unlocked.
 */
export function LockedCheckCard({ label }: { label: string }) {
  return (
    <div
      data-testid="locked-check-card"
      aria-hidden="true"
      className="border-ink/10 rounded-2xl border p-5 select-none"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{label}</h3>
        <span className="bg-ink/10 h-5 w-16 rounded-full blur-[2px]" />
      </div>
      <div className="mt-3 space-y-2 blur-[3px]">
        <div className="bg-ink/15 h-3 w-11/12 rounded" />
        <div className="bg-ink/10 h-3 w-4/5 rounded" />
        <div className="bg-violet/10 mt-4 h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}
