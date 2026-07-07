"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { loadAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth";
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

  const session = await getSession();
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
  const session = await getSession();
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

  const session = await getSession();
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

  const session = await getSession();
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
