import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { googleEnabled } from "@/lib/nextauth";
import { signInWithEmail, signInWithGoogle } from "./actions";

// Session-aware (signed-in users bounce to the app) — never prerender.
export const dynamic = "force-dynamic";

interface SignInPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    sent?: string;
    error?: string;
    callbackUrl?: string;
  }>;
}

export async function generateMetadata({
  params,
}: SignInPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function SignInPage({
  params,
  searchParams,
}: SignInPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [{ sent, error, callbackUrl }, session, t] = await Promise.all([
    searchParams,
    getSession(),
    getTranslations("auth"),
  ]);

  if (session) {
    redirect(callbackUrl?.startsWith("/") ? callbackUrl : "/app/dashboard");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="text-ink/70 mt-3">{t("sub")}</p>

      {sent ? (
        <div
          data-testid="magic-link-sent"
          className="border-lime bg-lime/10 mt-8 rounded-xl border p-5 text-sm"
        >
          <p className="font-semibold">{t("sentTitle")}</p>
          <p className="text-ink/70 mt-1">{t("sentBody")}</p>
        </div>
      ) : (
        <>
          <form action={signInWithEmail} className="mt-8 space-y-3">
            <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
            <label className="block text-sm font-medium" htmlFor="email">
              {t("emailLabel")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              data-testid="signin-email"
              className="border-ink/20 focus:border-violet w-full rounded-lg border px-4 py-3 text-sm outline-none"
            />
            {error === "email" ? (
              <p data-testid="signin-error" className="text-sm text-red-600">
                {t("invalidEmail")}
              </p>
            ) : null}
            {error && error !== "email" ? (
              <p data-testid="signin-error" className="text-sm text-red-600">
                {t("authError")}
              </p>
            ) : null}
            <button
              type="submit"
              data-testid="signin-submit"
              className="bg-violet hover:bg-violet/90 w-full rounded-lg px-4 py-3 text-sm font-semibold text-white"
            >
              {t("sendLink")}
            </button>
          </form>

          {googleEnabled ? (
            <>
              <div className="text-ink/40 my-6 flex items-center gap-3 text-xs">
                <span className="bg-ink/10 h-px flex-1" />
                {t("or")}
                <span className="bg-ink/10 h-px flex-1" />
              </div>
              <form action={signInWithGoogle}>
                <input
                  type="hidden"
                  name="callbackUrl"
                  value={callbackUrl ?? ""}
                />
                <button
                  type="submit"
                  data-testid="signin-google"
                  className="border-ink/20 hover:bg-ink/5 w-full rounded-lg border px-4 py-3 text-sm font-semibold"
                >
                  {t("google")}
                </button>
              </form>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
