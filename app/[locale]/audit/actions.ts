"use server";

import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { UNLOCK_COOKIE } from "@/lib/audit";
import { createLead } from "@/lib/data";
import { isValidEmail, isValidHandle, normalizeHandle } from "@/lib/validation";

export interface HandleFormState {
  error?: "invalid";
}

export async function startAudit(
  _prev: HandleFormState,
  formData: FormData,
): Promise<HandleFormState> {
  const handle = normalizeHandle(String(formData.get("handle") ?? ""));
  if (!isValidHandle(handle)) {
    return { error: "invalid" };
  }
  const locale = await getLocale();
  redirect({ href: `/audit/${handle}`, locale });
  return {}; // unreachable — redirect throws
}

export interface LeadFormState {
  status: "idle" | "success" | "invalid";
}

export async function captureLead(
  _prev: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const handle = normalizeHandle(String(formData.get("handle") ?? ""));
  const intent = formData.get("intent") === "notify" ? "notify" : "unlock";

  if (!isValidEmail(email)) {
    return { status: "invalid" };
  }

  const locale = await getLocale();
  await createLead({
    email,
    handle: handle || undefined,
    source: "audit",
    locale,
  });

  if (intent === "unlock") {
    // Unlock the full report for this browser; the result page re-renders
    // with all checks visible.
    const jar = await cookies();
    jar.set(UNLOCK_COOKIE, "1", {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
    });
  }

  return { status: "success" };
}
