import { redirect } from "next/navigation";
import { auth } from "@/lib/nextauth";
import { getUserPlan } from "@/lib/data/billing";
import type { Plan } from "@/lib/plan";

/**
 * Session facade. Real auth: NextAuth (email magic link + Google) with
 * database sessions; the plan comes from getUserPlan() — the subscriptions
 * table is the single source of truth, mirrored from Stripe by the webhook.
 * Callers depend only on the Session shape, never on Auth.js types.
 */

export interface Session {
  userId: string;
  email: string;
  plan: Plan;
}

/** The signed-in user with their effective plan, or null. */
export async function getSession(): Promise<Session | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return {
    userId,
    email: session.user?.email ?? "",
    plan: await getUserPlan(userId),
  };
}

/** For pages/actions behind /app: redirects to /signin when signed out. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/signin");
  return session;
}
