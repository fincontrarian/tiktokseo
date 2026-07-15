import { expect, test } from "@playwright/test";

/**
 * The money path, end to end with a FRESH user each run:
 * signup (magic link) → free limits enforced → upgrade through Stripe test
 * mode (checkout → signed webhook → subscriptions table → getUserPlan) →
 * fresh data unlocked → cancel → limits restored.
 */

// Fresh identity per run; no shared storage state.
test.use({ storageState: { cookies: [], origins: [] } });

const EMAIL = `journey-${Date.now()}@example.com`;

test.describe("billing journey", () => {
  test("signup → free limits → upgrade → fresh data → cancel → limits restored", async ({
    page,
    request,
  }) => {
    // --- 1. Signup via magic link ---------------------------------------
    await page.goto("/signin");
    await page.getByTestId("signin-email").fill(EMAIL);
    await page.getByTestId("signin-submit").click();
    await expect(page.getByTestId("magic-link-sent")).toBeVisible();

    const linkResponse = await request.get(
      `/api/dev/magic-link?email=${encodeURIComponent(EMAIL)}`,
    );
    const { url } = (await linkResponse.json()) as { url: string };
    await page.goto(url);
    await page.goto("/app/dashboard");
    await expect(page.getByTestId("session-email")).toContainText(EMAIL);
    await expect(page.getByTestId("plan-badge")).toContainText("Free");

    // --- 2. Free limits enforced ----------------------------------------
    // One tracked profile, then the limit gate with attribution.
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await page.getByTestId("add-profile-input").fill("@lanmoves");
    await page.getByTestId("add-profile-submit").click();
    await page.waitForURL("**/app/dashboard?profile=lanmoves");
    await expect(page.getByTestId("limit-notice")).toBeVisible();
    await expect(page.getByTestId("profile-limit-upgrade")).toHaveAttribute(
      "href",
      /\/pricing\?from=profile-limit$/,
    );

    // Keywords: 30-day-old data, top-3 rows, blurred rest — each gate links
    // to /pricing with its own from param.
    await page.goto("/app/keywords");
    await expect(page.getByTestId("free-notice")).toBeVisible();
    await expect(page.getByTestId("keyword-row")).toHaveCount(3);
    await expect(page.getByTestId("upgrade-wall")).toBeVisible();
    await expect(page.getByTestId("stale-data-upgrade")).toHaveAttribute(
      "href",
      /\/pricing\?from=stale-data$/,
    );
    await expect(page.getByTestId("export-csv")).toHaveCount(0);

    // --- 3. Upgrade via Stripe test mode --------------------------------
    // Through the blurred-rows gate, so the conversion attributes to it.
    await page.getByTestId("upgrade-cta").click();
    await page.waitForURL(/\/pricing\?from=keywords-blur/);

    // Tier table from planConfig: $12 / $29, annual −20%.
    await expect(page.getByTestId("price-creator")).toHaveText("$12");
    await expect(page.getByTestId("price-pro")).toHaveText("$29");
    await page.getByTestId("interval-year").click();
    await expect(page.getByTestId("price-creator")).toHaveText("$9.60");
    await page.getByTestId("interval-month").click();

    // Free CTA routes to the audit funnel, not checkout.
    await expect(page.getByTestId("free-tier-cta")).toHaveAttribute(
      "href",
      /\/audit$/,
    );

    // Checkout: session created against stripe-mock, completion simulated
    // by the signed checkout.session.completed webhook.
    await page.getByTestId("checkout-creator").click();
    await page.waitForURL("**/app/dashboard?upgraded=1");
    await expect(page.getByTestId("upgraded-banner")).toBeVisible();
    await expect(page.getByTestId("plan-badge")).toContainText("Creator");
    await expect(page.getByTestId("billing-card")).toBeVisible();
    await expect(page.getByTestId("billing-plan")).toContainText("Creator");

    // --- 4. Fresh data unlocked ------------------------------------------
    await page.goto("/app/keywords");
    await expect(page.getByTestId("free-notice")).toHaveCount(0);
    await expect(page.getByTestId("upgrade-wall")).toHaveCount(0);
    expect(await page.getByTestId("keyword-row").count()).toBeGreaterThan(3);
    // Exact growth numbers now, not bands.
    await expect(page.locator("table")).toContainText(/%/);
    // CSV export stays pro-only: the creator tier sees the upsell gate.
    await expect(page.getByTestId("export-csv")).toHaveCount(0);
    await expect(page.getByTestId("export-upsell")).toHaveAttribute(
      "href",
      /\/pricing\?from=csv-export$/,
    );

    // --- 5. Cancel → limits restored --------------------------------------
    await page.goto("/app/dashboard");
    await page.getByTestId("cancel-subscription").click();
    // The action cancels in Stripe, mirrors the row, and redirects to a
    // server-rendered confirmation.
    await page.waitForURL("**/app/dashboard?canceled=1");
    await expect(page.getByTestId("billing-canceled")).toBeVisible();
    await expect(page.getByTestId("plan-badge")).toContainText("Free");
    await page.goto("/app/keywords");
    await expect(page.getByTestId("free-notice")).toBeVisible();
    await expect(page.getByTestId("keyword-row")).toHaveCount(3);
    await expect(page.getByTestId("upgrade-wall")).toBeVisible();
  });

  test("checkout without a session redirects to sign-in", async ({ page }) => {
    const response = await page.request.post("/api/billing/checkout", {
      form: { plan: "pro", interval: "month" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    expect(response.headers()["location"]).toContain("/signin");
  });

  test("pro upgrade unlocks CSV export and the competitor stub", async ({
    page,
    request,
  }) => {
    const email = `journey-pro-${Date.now()}@example.com`;
    await page.goto("/signin");
    await page.getByTestId("signin-email").fill(email);
    await page.getByTestId("signin-submit").click();
    await expect(page.getByTestId("magic-link-sent")).toBeVisible();
    const { url } = (await (
      await request.get(
        `/api/dev/magic-link?email=${encodeURIComponent(email)}`,
      )
    ).json()) as { url: string };
    await page.goto(url);

    await page.goto("/pricing");
    await page.getByTestId("checkout-pro").click();
    await page.waitForURL("**/app/dashboard?upgraded=1");
    await expect(page.getByTestId("plan-badge")).toContainText("Pro");
    await expect(page.getByTestId("competitor-compare-stub")).toBeVisible();

    await page.goto("/app/keywords");
    await expect(page.getByTestId("export-csv")).toBeVisible();
  });
});
