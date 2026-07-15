import { prisma } from "@/lib/db";

export interface NewLead {
  email: string;
  handle?: string;
  source: string;
  locale: string;
}

/**
 * First login with an email we captured as a lead: mark every matching lead
 * converted. Called from the auth createUser event; idempotent.
 */
export async function convertLeadsForUser(
  userId: string,
  email: string,
): Promise<number> {
  const result = await prisma.lead.updateMany({
    where: { email: email.toLowerCase(), convertedUserId: null },
    data: { convertedUserId: userId, convertedAt: new Date() },
  });
  return result.count;
}

/** Record a marketing lead. Idempotent per (email, source). */
export async function createLead(lead: NewLead): Promise<void> {
  await prisma.lead.upsert({
    where: { email_source: { email: lead.email, source: lead.source } },
    create: {
      email: lead.email,
      handle: lead.handle ?? null,
      source: lead.source,
      locale: lead.locale,
    },
    update: {
      handle: lead.handle ?? null,
      locale: lead.locale,
    },
  });
}
