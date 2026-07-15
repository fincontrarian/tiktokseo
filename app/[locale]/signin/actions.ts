"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { signIn, signOut } from "@/lib/nextauth";
import { isValidEmail } from "@/lib/validation";

/** Only allow same-site redirect targets from form input. */
function safeCallbackUrl(raw: FormDataEntryValue | null): string {
  const value = String(raw ?? "");
  return value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/app/dashboard";
}

export async function signInWithEmail(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const locale = await getLocale();
  if (!isValidEmail(email)) {
    redirect({ href: "/signin?error=email", locale });
  }
  // Throws a redirect to the verify-request page (/signin?sent=1).
  await signIn("email", {
    email,
    redirectTo: safeCallbackUrl(formData.get("callbackUrl")),
  });
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  await signIn("google", {
    redirectTo: safeCallbackUrl(formData.get("callbackUrl")),
  });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
