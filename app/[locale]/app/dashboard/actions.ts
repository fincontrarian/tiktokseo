"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { loadAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { stripeClient } from "@/lib/billing/stripe";
import {
  getActiveSubscription,
  markSubscriptionCanceled,
} from "@/lib/data/billing";
import {
  addProfileEvent,
  addTrackedProfile,
  findCreatorIdByHandle,
  listTrackedProfiles,
  removeTrackedProfile,
  saveAuditSnapshot,
} from "@/lib/data";
import { planConfig } from "@/lib/plan";
import { checkRateLimit } from "@/lib/rate-limit";
import { isValidHandle, normalizeHandle } from "@/lib/validation";

export interface TrackProfileState {
  status: "idle" | "invalid" | "notFound" | "limit";
}

export async function trackProfileAction(
  _prev: TrackProfileState,
  formData: FormData,
): Promise<TrackProfileState> {
  const handle = normalizeHandle(String(formData.get("handle") ?? ""));
  if (!isValidHandle(handle)) return { status: "invalid" };

  const session = await requireSession();
  const config = planConfig(session.plan);
  const locale = await getLocale();

  const creatorId = await findCreatorIdByHandle(handle);
  if (!creatorId) return { status: "notFound" };

  const tracked = await listTrackedProfiles(session.userId);
  const alreadyTracked = tracked.some((p) => p.creatorId === creatorId);
  if (!alreadyTracked && tracked.length >= config.trackedProfileLimit) {
    return { status: "limit" };
  }

  await addTrackedProfile(session.userId, creatorId);
  revalidatePath("/", "layout");
  redirect({ href: `/app/dashboard?profile=${handle}`, locale });
  return { status: "idle" }; // unreachable — redirect throws
}

export async function untrackProfileAction(formData: FormData): Promise<void> {
  const creatorId = String(formData.get("creatorId") ?? "");
  if (!creatorId) return;
  const session = await requireSession();
  await removeTrackedProfile(session.userId, creatorId);
  revalidatePath("/", "layout");
}

export interface EventFormState {
  status: "idle" | "success" | "invalid";
}

export async function addProfileEventAction(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const creatorId = String(formData.get("creatorId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const dateRaw = String(formData.get("date") ?? "");
  const date = new Date(`${dateRaw}T00:00:00Z`);

  if (
    !creatorId ||
    label.length === 0 ||
    label.length > 80 ||
    note.length > 500 ||
    Number.isNaN(date.getTime())
  ) {
    return { status: "invalid" };
  }

  const session = await requireSession();
  await addProfileEvent({
    userId: session.userId,
    creatorId,
    date,
    label,
    note: note || undefined,
  });
  revalidatePath("/", "layout");
  return { status: "success" };
}

export interface CancelSubscriptionState {
  status: "idle" | "error";
}

export async function cancelSubscriptionAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prev: CancelSubscriptionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<CancelSubscriptionState> {
  const session = await requireSession();
  const subscription = await getActiveSubscription(session.userId);
  if (!subscription) return { status: "error" };

  // Dev-simulator rows never existed in Stripe; everything else is canceled
  // there first. The webhook will confirm, but we mirror immediately so the
  // UI (and limits) update without waiting on delivery.
  if (!subscription.stripeSubscriptionId.startsWith("dev_")) {
    await stripeClient().subscriptions.cancel(
      subscription.stripeSubscriptionId,
    );
  }
  await markSubscriptionCanceled(subscription.stripeSubscriptionId);
  revalidatePath("/", "layout");
  // The card renders only while a subscription is live, so the confirmation
  // has to be server-rendered on the refreshed page.
  const locale = await getLocale();
  redirect({ href: "/app/dashboard?canceled=1", locale });
  return { status: "idle" }; // unreachable — redirect throws
}

export interface RerunAuditState {
  status: "idle" | "success" | "limited" | "error";
}

export async function rerunAuditAction(
  _prev: RerunAuditState,
  formData: FormData,
): Promise<RerunAuditState> {
  const creatorId = String(formData.get("creatorId") ?? "");
  const handle = normalizeHandle(String(formData.get("handle") ?? ""));
  if (!creatorId || !isValidHandle(handle)) return { status: "error" };

  const session = await requireSession();
  const config = planConfig(session.plan);

  // Per-profile daily re-run limit from the plan config (free: 1/day).
  const day = new Date().toISOString().slice(0, 10);
  const { allowed } = await checkRateLimit(
    `audit:rerun:${session.userId}:${creatorId}:${day}`,
    config.auditRerunsPerDay,
    24 * 60 * 60,
  );
  if (!allowed) return { status: "limited" };

  const audit = await loadAudit(handle);
  if (!audit) return { status: "error" };

  await saveAuditSnapshot(creatorId, audit.result.score, audit.result.grade);
  revalidatePath("/", "layout");
  return { status: "success" };
}
