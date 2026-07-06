import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { CheckCard, LockedCheckCard } from "@/components/check-card";
import { LeadForm } from "@/components/lead-form";
import { ScoreDial } from "@/components/score-dial";
import { Link } from "@/i18n/navigation";
import { loadAudit, UNLOCK_COOKIE } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Check } from "@/lib/scoring";
import { isValidHandle, normalizeHandle } from "@/lib/validation";
import { captureLead } from "../actions";

const STATUS_PRIORITY: Record<Check["status"], number> = {
  fail: 0,
  warn: 1,
  pass: 2,
};

const VISIBLE_CHECKS = 2;

interface ResultPageProps {
  params: Promise<{ locale: string; handle: string }>;
}

function parseHandle(raw: string): string | null {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const handle = normalizeHandle(decoded);
  return isValidHandle(handle) ? handle : null;
}

/** Highest-impact checks first: fails before warns before passes, then weight. */
function prioritized(checks: Check[]): Check[] {
  return [...checks].sort(
    (a, b) =>
      STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] ||
      b.weight - a.weight,
  );
}

export async function generateMetadata({
  params,
}: ResultPageProps): Promise<Metadata> {
  const { locale, handle: rawHandle } = await params;
  const t = await getTranslations({ locale, namespace: "result" });
  const handle = parseHandle(rawHandle);
  if (!handle) return {};

  const audit = await loadAudit(handle);
  if (!audit) {
    return { title: t("notFoundTitle", { handle }) };
  }
  return {
    title: t("metaTitle", { handle, score: audit.result.score }),
    description: t("metaDescription", {
      handle,
      score: audit.result.score,
      grade: audit.result.grade,
    }),
  };
}

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export default async function AuditResultPage({ params }: ResultPageProps) {
  const { locale, handle: rawHandle } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("result");

  const handle = parseHandle(rawHandle);
  if (!handle) notFound();

  // Friendly rate limit: the score is bait, but not unlimited bait.
  const limit = Number(process.env.AUDIT_RATE_LIMIT_PER_HOUR) || 10;
  const { allowed } = await checkRateLimit(
    `audit:rl:${await clientIp()}`,
    limit,
    60 * 60,
  );
  if (!allowed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
        <h1 className="text-3xl font-bold">{t("rateLimitTitle")}</h1>
        <p className="text-ink/70 mt-4">{t("rateLimitSub", { limit })}</p>
        <Link
          href="/audit"
          className="bg-violet hover:bg-violet/90 mt-8 inline-block rounded-full px-6 py-3 text-sm font-semibold text-white"
        >
          {t("backToAudit")}
        </Link>
      </div>
    );
  }

  const audit = await loadAudit(handle);

  // Not in the index yet: capture the lead, promise the audit.
  if (!audit) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6">
        <h1 className="text-3xl font-bold">{t("notFoundTitle", { handle })}</h1>
        <p className="text-ink/70 mt-4">{t("notFoundSub")}</p>
        <div className="mt-8">
          <LeadForm
            action={captureLead}
            handle={handle}
            intent="notify"
            placeholder={t("emailPlaceholder")}
            cta={t("notifyCta")}
            successMessage={t("notifySuccess", { handle })}
            invalidMessage={t("invalidEmail")}
          />
        </div>
        <Link
          href="/audit"
          className="text-violet mt-10 inline-block text-sm font-medium hover:underline"
        >
          {t("auditAnother")} →
        </Link>
      </div>
    );
  }

  const { result } = audit;
  const ordered = prioritized(result.checks);
  const visible = ordered.slice(0, VISIBLE_CHECKS);
  const locked = ordered.slice(VISIBLE_CHECKS);
  const unlocked = (await cookies()).get(UNLOCK_COOKIE)?.value === "1";
  const hasProblems = visible.some((c) => c.status !== "pass");

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-ink/60 text-center text-sm font-medium">
        {t("auditedIntro", { handle })}
      </p>

      <div className="mt-8 flex justify-center">
        <ScoreDial
          score={result.score}
          grade={result.grade}
          scoreLabel={t("scoreLabel")}
          gradeLabel={t("gradeLabel")}
        />
      </div>
      <p className="text-ink/50 mt-4 text-center text-sm">{t("shareHint")}</p>

      <section className="mt-14">
        <h2 className="text-xl font-bold">
          {hasProblems ? t("fixesTitle") : t("passedTitle")}
        </h2>
        <div className="mt-4 space-y-4">
          {visible.map((check) => (
            <CheckCard
              key={check.id}
              check={check}
              statusLabel={t(`checkStatus.${check.status}`)}
            />
          ))}
        </div>
      </section>

      {locked.length > 0 && (
        <section className="mt-10" data-testid="locked-section">
          {unlocked ? (
            <div className="space-y-4">
              {locked.map((check) => (
                <CheckCard
                  key={check.id}
                  check={check}
                  statusLabel={t(`checkStatus.${check.status}`)}
                />
              ))}
            </div>
          ) : (
            <div className="relative">
              <div className="space-y-4">
                {locked.map((check) => (
                  <LockedCheckCard key={check.id} label={check.label} />
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white/40 via-white/80 to-white">
                <div className="border-ink/10 w-full max-w-md rounded-3xl border bg-white p-6 shadow-xl">
                  <h3 className="text-lg font-bold">
                    {t("lockedTitle", { count: locked.length })}
                  </h3>
                  <p className="text-ink/70 mt-2 text-sm">{t("lockedSub")}</p>
                  <div className="mt-4">
                    <LeadForm
                      action={captureLead}
                      handle={handle}
                      intent="unlock"
                      placeholder={t("emailPlaceholder")}
                      cta={t("unlockCta")}
                      successMessage={t("unlockSuccess")}
                      invalidMessage={t("invalidEmail")}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="mt-14 text-center">
        <Link
          href="/audit"
          className="text-violet text-sm font-medium hover:underline"
        >
          {t("auditAnother")} →
        </Link>
      </div>
    </div>
  );
}
