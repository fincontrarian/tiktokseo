import { prisma } from "@/lib/db";

/**
 * Gate-event logging: every upgrade gate records an impression when shown,
 * a pricing view when the user lands on /pricing?from=..., and a conversion
 * when the checkout it started completes. gate values are stable slugs
 * ("keywords-blur", "profile-limit", "stale-data", ...).
 */

export interface GateEventInput {
  userId?: string | null;
  gate: string;
  kind?: "impression" | "pricing-view" | "conversion";
  path: string;
  locale?: string;
}

export async function logGateEvent(input: GateEventInput): Promise<void> {
  try {
    await prisma.gateEvent.create({
      data: {
        userId: input.userId ?? null,
        gate: input.gate.slice(0, 64),
        kind: input.kind ?? "impression",
        path: input.path.slice(0, 256),
        locale: input.locale ?? "en",
      },
    });
  } catch {
    // Attribution must never break the page that logs it.
  }
}
