import { getTranslations } from "next-intl/server";
import { PlanSwitcher } from "@/components/keywords/plan-switcher";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import type { Plan } from "@/lib/plan";
import { setDevPlanAction } from "./keywords/actions";

/**
 * Authenticated app shell. Auth is a placeholder (see lib/auth.ts) until the
 * real session ships; the dev plan switcher simulates free/creator/pro.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("app");
  const session = await getSession();

  const planLabels: Record<Plan, string> = {
    free: t("planFree"),
    creator: t("planCreator"),
    pro: t("planPro"),
  };

  return (
    <div>
      <div className="border-ink/10 border-b bg-white">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-5 text-sm">
            <span className="text-ink/50 font-semibold">{t("title")}</span>
            <Link
              href="/app/dashboard"
              className="text-violet font-semibold hover:underline"
            >
              {t("navDashboard")}
            </Link>
            <Link
              href="/app/keywords"
              className="text-violet font-semibold hover:underline"
            >
              {t("navKeywords")}
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span
              data-testid="plan-badge"
              className="text-ink/50 text-xs font-medium"
            >
              {t("planLabel")}: {planLabels[session.plan]}
            </span>
            <PlanSwitcher
              action={setDevPlanAction}
              current={session.plan}
              label={t("devSwitcher")}
              planLabels={planLabels}
            />
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
