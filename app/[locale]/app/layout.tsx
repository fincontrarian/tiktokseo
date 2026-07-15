import { getTranslations } from "next-intl/server";
import { PlanSwitcher } from "@/components/keywords/plan-switcher";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/auth";
import type { Plan } from "@/lib/plan";
import { signOutAction } from "../signin/actions";
import { devToolsEnabled, setDevPlanAction } from "./actions";

/** Authenticated app shell: session required, signed-out users hit /signin. */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [t, tAuth, session, devTools] = await Promise.all([
    getTranslations("app"),
    getTranslations("auth"),
    requireSession(),
    devToolsEnabled(),
  ]);

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
            {devTools ? (
              <PlanSwitcher
                action={setDevPlanAction}
                current={session.plan}
                label={t("devSwitcher")}
                planLabels={planLabels}
              />
            ) : null}
            <span
              data-testid="session-email"
              className="text-ink/40 hidden text-xs sm:inline"
              title={session.email}
            >
              {session.email}
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                data-testid="signout-button"
                className="text-ink/50 hover:text-ink text-xs font-medium underline"
              >
                {tAuth("signOut")}
              </button>
            </form>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
