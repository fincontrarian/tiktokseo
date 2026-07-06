import { prisma } from "@/lib/db";

export interface NewLead {
  email: string;
  handle?: string;
  source: string;
  locale: string;
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
