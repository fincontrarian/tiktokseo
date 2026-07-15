import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { logGateEvent } from "@/lib/data";

/**
 * Upgrade CTA for a gated surface. Rendering it IS the gate impression —
 * it's logged to the events table — and the href carries ?from=<gate> so
 * /pricing and the checkout metadata can attribute which gate converts.
 */
export async function UpgradeLink({
  gate,
  path,
  userId,
  className,
  testId = "upgrade-link",
  children,
}: {
  /** Stable slug: "keywords-blur", "profile-limit", "stale-data", ... */
  gate: string;
  /** The page showing the gate (for the events table). */
  path: string;
  userId?: string | null;
  className?: string;
  testId?: string;
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  await logGateEvent({ userId, gate, path, locale });
  return (
    <Link
      href={`/pricing?from=${encodeURIComponent(gate)}`}
      data-testid={testId}
      className={className}
    >
      {children}
    </Link>
  );
}
