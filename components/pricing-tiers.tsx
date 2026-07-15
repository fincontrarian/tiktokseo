"use client";

import { useLocale } from "next-intl";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";

export interface TierFeature {
  text: string;
  emphasized?: boolean;
}

export interface TierProps {
  id: "free" | "creator" | "pro";
  name: string;
  description: string;
  monthlyCents: number | null;
  annualCents: number | null;
  features: TierFeature[];
  cta: string;
  popular?: boolean;
}

interface PricingTiersProps {
  tiers: TierProps[];
  labels: {
    monthly: string;
    annual: string;
    annualSave: string;
    perMonth: string;
    billedAnnually: string;
    trialNote: string;
    mostPopular: string;
    freePrice: string;
  };
}

function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
  }).format(dollars);
}

/**
 * Reads ?from= (inside Suspense so the page stays static), reports it to the
 * parent for the checkout forms, and fires the pricing-view beacon.
 */
function FromBeacon({
  locale,
  onFrom,
}: {
  locale: string;
  onFrom: (from: string) => void;
}) {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  useEffect(() => {
    if (!from) return;
    onFrom(from);
    void fetch("/api/events/gate-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, locale }),
      keepalive: true,
    }).catch(() => {});
  }, [from, locale, onFrom]);
  return null;
}

function CheckoutButton({
  tier,
  interval,
  from,
  className,
}: {
  tier: TierProps;
  interval: "month" | "year";
  from: string;
  className: string;
}) {
  return (
    <form action="/api/billing/checkout" method="POST">
      <input type="hidden" name="plan" value={tier.id} />
      <input type="hidden" name="interval" value={interval} />
      {from ? <input type="hidden" name="from" value={from} /> : null}
      <button
        type="submit"
        data-testid={`checkout-${tier.id}`}
        className={className}
      >
        {tier.cta}
      </button>
    </form>
  );
}

export function PricingTiers({ tiers, labels }: PricingTiersProps) {
  const locale = useLocale();
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [from, setFrom] = useState("");

  return (
    <div>
      <Suspense fallback={null}>
        <FromBeacon locale={locale} onFrom={setFrom} />
      </Suspense>

      <div className="mt-8 flex items-center gap-2">
        <div className="border-ink/15 inline-flex rounded-full border p-1 text-sm font-semibold">
          <button
            type="button"
            data-testid="interval-month"
            onClick={() => setInterval("month")}
            className={`rounded-full px-4 py-1.5 transition ${
              interval === "month" ? "bg-ink text-white" : "text-ink/60"
            }`}
          >
            {labels.monthly}
          </button>
          <button
            type="button"
            data-testid="interval-year"
            onClick={() => setInterval("year")}
            className={`rounded-full px-4 py-1.5 transition ${
              interval === "year" ? "bg-ink text-white" : "text-ink/60"
            }`}
          >
            {labels.annual}
          </button>
        </div>
        <span className="bg-lime text-ink rounded-full px-3 py-1 text-xs font-bold">
          {labels.annualSave}
        </span>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {tiers.map((tier) => {
          const isPaid = tier.monthlyCents !== null;
          const shownMonthly =
            tier.monthlyCents === null
              ? null
              : interval === "year" && tier.annualCents !== null
                ? Math.round(tier.annualCents / 12)
                : tier.monthlyCents;
          return (
            <div
              key={tier.id}
              data-testid={`tier-${tier.id}`}
              className={`relative rounded-3xl border p-6 ${
                tier.popular
                  ? "border-violet shadow-violet/10 shadow-lg"
                  : "border-ink/10"
              }`}
            >
              {tier.popular ? (
                <span className="bg-violet absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-bold text-white">
                  {labels.mostPopular}
                </span>
              ) : null}
              <h2 className="text-lg font-bold">{tier.name}</h2>
              <p className="text-ink/60 mt-1 min-h-10 text-sm">
                {tier.description}
              </p>
              <p className="mt-4 flex items-baseline gap-1">
                <span
                  data-testid={`price-${tier.id}`}
                  className="text-4xl font-bold tracking-tight"
                >
                  {shownMonthly === null
                    ? labels.freePrice
                    : formatUsd(shownMonthly)}
                </span>
                <span className="text-ink/50 text-sm">{labels.perMonth}</span>
              </p>
              {isPaid && interval === "year" && tier.annualCents !== null ? (
                <p
                  className="text-ink/50 mt-1 text-xs"
                  data-testid="billed-annually"
                >
                  {labels.billedAnnually.replace(
                    "{price}",
                    formatUsd(tier.annualCents),
                  )}
                </p>
              ) : null}
              <ul className="mt-5 space-y-2 text-sm">
                {tier.features.map((feature) => (
                  <li key={feature.text} className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-violet font-bold">
                      ✓
                    </span>
                    <span
                      className={
                        feature.emphasized ? "font-semibold" : "text-ink/70"
                      }
                    >
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {isPaid ? (
                  <>
                    <CheckoutButton
                      tier={tier}
                      interval={interval}
                      from={from}
                      className={`w-full rounded-full px-5 py-3 text-sm font-semibold transition ${
                        tier.popular
                          ? "bg-violet hover:bg-violet/90 text-white"
                          : "bg-ink hover:bg-ink/85 text-white"
                      }`}
                    />
                    <p className="text-ink/50 mt-2 text-center text-xs">
                      {labels.trialNote}
                    </p>
                  </>
                ) : (
                  <Link
                    href="/audit"
                    data-testid="free-tier-cta"
                    className="border-ink/20 hover:border-violet hover:text-violet block w-full rounded-full border px-5 py-3 text-center text-sm font-semibold transition"
                  >
                    {tier.cta}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
