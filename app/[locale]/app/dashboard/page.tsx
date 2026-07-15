import type { Metadata } from "next";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { AddProfileForm } from "@/components/dashboard/add-profile-form";
import { BillingCard } from "@/components/dashboard/billing-card";
import { EventForm } from "@/components/dashboard/event-form";
import { RerunAuditButton } from "@/components/dashboard/rerun-audit-button";
import { StatChart } from "@/components/dashboard/stat-chart";
import { UpgradeLink } from "@/components/upgrade-link";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/auth";
import {
  getActiveSubscription,
  getCreatorStatsSeries,
  getLatestAuditSnapshots,
  listProfileEvents,
  listTrackedProfiles,
} from "@/lib/data";
import type { DailyStatPoint } from "@/lib/data";
import { planConfig } from "@/lib/plan";
import { formatSearchVolume } from "@/lib/scoring";
import {
  addProfileEventAction,
  cancelSubscriptionAction,
  rerunAuditAction,
  trackProfileAction,
  untrackProfileAction,
} from "./actions";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
}: Pick<PageProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("metaTitle"), robots: { index: false } };
}

function metric(
  series: DailyStatPoint[],
  key: keyof Omit<DailyStatPoint, "date">,
) {
  return series.map((point) => ({ date: point.date, value: point[key] }));
}

export default async function DashboardPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tApp, tBilling, format, session, raw] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("app"),
    getTranslations("billing"),
    getFormatter(),
    requireSession(),
    searchParams,
  ]);

  const config = planConfig(session.plan);
  const [tracked, subscription] = await Promise.all([
    listTrackedProfiles(session.userId),
    getActiveSubscription(session.userId),
  ]);
  const atLimit = tracked.length >= config.trackedProfileLimit;
  const upgraded = raw.upgraded !== undefined;
  const canceled = raw.canceled !== undefined;

  const subscriptionStatusText = subscription
    ? subscription.status === "trialing" && subscription.trialEnd
      ? tBilling("statusTrialing", {
          date: format.dateTime(subscription.trialEnd, { dateStyle: "medium" }),
        })
      : subscription.status === "past_due"
        ? tBilling("statusPastDue")
        : subscription.currentPeriodEnd
          ? tBilling("statusActive", {
              date: format.dateTime(subscription.currentPeriodEnd, {
                dateStyle: "medium",
              }),
            })
          : ""
    : "";

  const requested = Array.isArray(raw.profile) ? raw.profile[0] : raw.profile;
  const selected =
    tracked.find((profile) => profile.handle === requested) ?? tracked[0];

  const [series, events, audits] = selected
    ? await Promise.all([
        getCreatorStatsSeries(selected.creatorId),
        listProfileEvents(session.userId, selected.creatorId),
        getLatestAuditSnapshots(selected.creatorId),
      ])
    : [[], [], []];

  const chartEvents = events.map((e) => ({ date: e.date, label: e.label }));
  const latestAudit = audits[0];
  const previousAudit = audits[1];
  const auditDelta =
    latestAudit && previousAudit
      ? latestAudit.score - previousAudit.score
      : null;
  const today = new Date().toISOString().slice(0, 10);

  const planLabels = {
    free: tApp("planFree"),
    creator: tApp("planCreator"),
    pro: tApp("planPro"),
  } as const;

  const addMessages = {
    invalid: t("addInvalid"),
    notFound: t("addNotFound"),
    limit: t("addLimit", { limit: config.trackedProfileLimit }),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p data-testid="tracked-count" className="text-ink/60 mt-2 text-sm">
            {t("profilesTracked", {
              count: tracked.length,
              limit: config.trackedProfileLimit,
              plan: planLabels[session.plan],
            })}
          </p>
        </div>
        {!atLimit && tracked.length > 0 ? (
          <AddProfileForm
            action={trackProfileAction}
            placeholder={t("addPlaceholder")}
            cta={t("addCta")}
            messages={addMessages}
          />
        ) : null}
        {atLimit ? (
          <p
            data-testid="limit-notice"
            className="text-ink/60 flex items-center gap-3 text-sm"
          >
            {t("limitNotice", { limit: config.trackedProfileLimit })}
            <UpgradeLink
              gate="profile-limit"
              path="/app/dashboard"
              userId={session.userId}
              testId="profile-limit-upgrade"
              className="bg-violet hover:bg-violet/90 rounded-full px-4 py-2 text-xs font-semibold text-white"
            >
              {t("upgradeCta")}
            </UpgradeLink>
          </p>
        ) : null}
      </div>

      {upgraded ? (
        <p
          data-testid="upgraded-banner"
          className="bg-lime text-ink mt-6 rounded-xl px-4 py-3 text-sm font-medium"
        >
          {t("upgradedBanner")}
        </p>
      ) : null}

      {canceled && !subscription ? (
        <p
          data-testid="billing-canceled"
          className="border-ink/10 text-ink/70 mt-6 rounded-xl border px-4 py-3 text-sm font-medium"
        >
          {tBilling("canceledNote")}
        </p>
      ) : null}

      {subscription ? (
        <BillingCard
          action={cancelSubscriptionAction}
          planLabel={planLabels[session.plan]}
          statusText={subscriptionStatusText}
          labels={{
            title: tBilling("title"),
            currentPlan: tBilling("currentPlan"),
            cancel: tBilling("cancel"),
          }}
        />
      ) : null}

      {config.competitorCompare ? (
        <section
          data-testid="competitor-compare-stub"
          className="border-ink/10 mt-6 rounded-2xl border border-dashed p-5"
        >
          <p className="text-ink/50 text-xs font-medium uppercase">
            {t("competitorTitle")}
          </p>
          <p className="text-ink/60 mt-1 text-sm">{t("competitorSoon")}</p>
        </section>
      ) : null}

      {tracked.length === 0 ? (
        <section
          data-testid="empty-state"
          className="bg-ink mt-8 rounded-3xl px-8 py-16 text-center text-white"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("emptyTitle")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">{t("emptySub")}</p>
          <div className="mt-8 flex justify-center">
            <AddProfileForm
              action={trackProfileAction}
              placeholder={t("addPlaceholder")}
              cta={t("addCta")}
              messages={addMessages}
            />
          </div>
        </section>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {tracked.map((profile) => (
              <div
                key={profile.id}
                data-testid="profile-chip"
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${
                  selected?.id === profile.id
                    ? "border-violet bg-violet/5 text-violet font-semibold"
                    : "border-ink/15 text-ink/70"
                }`}
              >
                <Link href={`/app/dashboard?profile=${profile.handle}`}>
                  @{profile.handle}
                </Link>
                <span className="text-ink/40 text-xs">
                  {formatSearchVolume(profile.followerCount)}
                </span>
                <form action={untrackProfileAction}>
                  <input
                    type="hidden"
                    name="creatorId"
                    value={profile.creatorId}
                  />
                  <button
                    type="submit"
                    aria-label={t("untrack")}
                    title={t("untrack")}
                    data-testid="untrack-button"
                    className="text-ink/40 hover:text-red-600"
                  >
                    ×
                  </button>
                </form>
              </div>
            ))}
          </div>

          {selected ? (
            <>
              {/* The wow moment: history predates the signup. */}
              <p
                data-testid="indexed-since"
                className="bg-lime text-ink mt-6 inline-block rounded-xl px-4 py-3 text-sm font-medium"
              >
                {t("indexedSince", {
                  handle: selected.handle,
                  date: format.dateTime(selected.firstSeenAt, {
                    dateStyle: "long",
                  }),
                })}
              </p>

              <section className="border-ink/10 mt-6 flex flex-wrap items-center justify-between gap-6 rounded-2xl border p-5">
                <div className="flex items-center gap-5">
                  <div>
                    <p className="text-ink/50 text-xs font-medium uppercase">
                      {t("auditTitle")}
                    </p>
                    {latestAudit ? (
                      <p className="mt-1 flex items-baseline gap-2">
                        <span
                          data-testid="audit-score"
                          className="text-4xl font-bold"
                        >
                          {latestAudit.score}
                        </span>
                        <span className="text-ink/50 text-sm">/100</span>
                        <span className="bg-lime text-ink rounded-full px-2 py-0.5 text-xs font-bold">
                          {latestAudit.grade}
                        </span>
                        {auditDelta !== null && (
                          <span
                            data-testid="audit-delta"
                            className={`text-sm font-semibold ${
                              auditDelta >= 0
                                ? "text-emerald-600"
                                : "text-red-600"
                            }`}
                          >
                            {auditDelta >= 0 ? "+" : ""}
                            {auditDelta} {t("auditDelta")}
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-ink/60 mt-1 text-sm">{t("noAudit")}</p>
                    )}
                    {latestAudit && (
                      <p className="text-ink/40 mt-1 text-xs">
                        {format.dateTime(latestAudit.createdAt, {
                          dateStyle: "medium",
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <RerunAuditButton
                  action={rerunAuditAction}
                  creatorId={selected.creatorId}
                  handle={selected.handle}
                  cta={t("rerunCta")}
                  messages={{
                    limited: t("rerunLimited", {
                      limit: config.auditRerunsPerDay,
                    }),
                    success: t("rerunSuccess"),
                    error: t("rerunError"),
                  }}
                />
              </section>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <StatChart
                  title={t("chartFollowers")}
                  data={metric(series, "followers")}
                  events={chartEvents}
                  format="count"
                />
                <StatChart
                  title={t("chartAvgViews")}
                  data={metric(series, "avgViews")}
                  events={chartEvents}
                  format="count"
                />
                <StatChart
                  title={t("chartER")}
                  data={metric(series, "engagementRate")}
                  events={chartEvents}
                  format="percent"
                />
                <StatChart
                  title={t("chartSaveRate")}
                  data={metric(series, "saveRate")}
                  events={chartEvents}
                  format="percent"
                />
              </div>

              <section className="mt-8">
                <h2 className="text-xl font-bold">{t("eventsTitle")}</h2>
                <p className="text-ink/60 mt-1 text-sm">{t("eventsSub")}</p>
                <div className="mt-4">
                  <EventForm
                    action={addProfileEventAction}
                    creatorId={selected.creatorId}
                    today={today}
                    labels={{
                      date: t("eventDate"),
                      label: t("eventLabel"),
                      labelPlaceholder: t("eventLabelPlaceholder"),
                      note: t("eventNote"),
                      cta: t("eventCta"),
                      invalid: t("eventInvalid"),
                      success: t("eventSuccess"),
                    }}
                  />
                </div>
                {events.length === 0 ? (
                  <p className="text-ink/50 mt-4 text-sm">{t("eventsEmpty")}</p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {[...events].reverse().map((event) => (
                      <li
                        key={event.id}
                        data-testid="event-item"
                        className="border-ink/10 flex flex-wrap items-baseline gap-3 rounded-xl border px-4 py-3 text-sm"
                      >
                        <span className="text-ink/50 tabular-nums">
                          {event.date}
                        </span>
                        <span className="font-semibold">{event.label}</span>
                        {event.note && (
                          <span className="text-ink/60">{event.note}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
