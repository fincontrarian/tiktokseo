import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Data from prisma/seed.ts. Tests are self-healing: they reset tracked
// profiles through the UI, since DB state persists between runs.

async function untrackAll(page: Page) {
  await page.goto("/app/dashboard");
  while ((await page.getByTestId("untrack-button").count()) > 0) {
    // The chip detaches the moment the action lands; a detached-mid-click
    // retry would wait forever, so bound the click and re-check the count.
    await page
      .getByTestId("untrack-button")
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(600);
  }
}

async function ensureTracked(page: Page, handle: string) {
  await page.goto(`/app/dashboard?profile=${handle}`);
  if ((await page.getByTestId("empty-state").count()) > 0) {
    await page.getByTestId("add-profile-input").fill(`@${handle}`);
    await page.getByTestId("add-profile-submit").click();
    await page.waitForURL(`**/app/dashboard?profile=${handle}`);
  }
}

/** The plan lives in the DB now (subscription rows), so set it explicitly. */
async function setPlan(page: Page, plan: "free" | "pro") {
  await page.getByTestId(`plan-${plan}`).click();
  await expect(page.getByTestId("plan-badge")).toContainText(
    plan === "free" ? "Free" : "Pro",
  );
}

test.describe("tracked-profile dashboard", () => {
  test("empty state → add profile → 12 months of history instantly (the wow moment)", async ({
    page,
  }) => {
    await untrackAll(page);
    await expect(page.getByTestId("empty-state")).toBeVisible();

    await page.getByTestId("add-profile-input").fill("@lanmoves");
    await page.getByTestId("add-profile-submit").click();
    await page.waitForURL("**/app/dashboard?profile=lanmoves");

    // History predates the signup: the caption names the first-seen date...
    const caption = page.getByTestId("indexed-since");
    await expect(caption).toBeVisible();
    await expect(caption).toContainText("@lanmoves");
    await expect(caption).toContainText(/2025/);

    // ...and all four charts render immediately with real series.
    await expect(page.getByTestId("stat-chart")).toHaveCount(4);
    expect(
      await page.locator("[data-testid=stat-chart] svg path").count(),
    ).toBeGreaterThan(0);

    // Latest audit card with score and delta vs previous run.
    await expect(page.getByTestId("audit-score")).toBeVisible();
    await expect(page.getByTestId("audit-delta")).toContainText(/[+-−]?\d+/);
  });

  test("unknown handle shows the not-in-index message", async ({ page }) => {
    await ensureTracked(page, "lanmoves");
    // Free plan is at its limit with one profile, so use the pro plan to
    // reach the add form. setPlan waits for the refreshed shell, so the
    // form below is the post-refresh one.
    await setPlan(page, "pro");
    await page.getByTestId("add-profile-input").fill("ghost.handle_404");
    await page.getByTestId("add-profile-submit").click();
    await expect(page.getByTestId("add-profile-error")).toContainText(
      /isn't in our index/i,
    );
  });

  test("logging a change lists it and annotates the charts", async ({
    page,
  }) => {
    await ensureTracked(page, "lanmoves");

    const label = "Bio keyword update";
    await page.getByTestId("event-label-input").fill(label);
    await page.getByTestId("event-submit").click();
    await expect(page.getByTestId("event-success")).toBeVisible();

    await expect(
      page.getByTestId("event-item").filter({ hasText: label }).first(),
    ).toBeVisible();

    // The event renders as a vertical annotation on the charts. Events
    // persist in the DB across runs, so duplicates may exist — .first().
    await expect(
      page
        .getByTestId("stat-chart")
        .first()
        .locator("svg text", { hasText: label })
        .first(),
    ).toBeVisible();
  });

  test("audit re-run is rate-limited to 1/day on the free plan", async ({
    page,
  }) => {
    await ensureTracked(page, "lanmoves");
    await setPlan(page, "free");

    // First click may succeed or already be limited (depending on earlier
    // runs today); a second click is deterministically limited on free.
    await page.getByTestId("rerun-audit").click();
    await expect(
      page.getByTestId("rerun-success").or(page.getByTestId("rerun-limited")),
    ).toBeVisible();
    await page.getByTestId("rerun-audit").click();
    await expect(page.getByTestId("rerun-limited")).toBeVisible();
    await expect(page.getByTestId("rerun-limited")).toContainText("1");
  });

  test("plan limits from planConfig: free caps at 1, pro allows 5", async ({
    page,
  }) => {
    await ensureTracked(page, "lanmoves");
    await setPlan(page, "free");

    // Free: at limit — upgrade notice (with gate attribution) instead of
    // the add form.
    await expect(page.getByTestId("limit-notice")).toBeVisible();
    await expect(page.getByTestId("profile-limit-upgrade")).toHaveAttribute(
      "href",
      /\/pricing\?from=profile-limit$/,
    );
    await expect(page.getByTestId("tracked-count")).toContainText("1 of 1");
    await expect(page.getByTestId("add-profile-input")).toHaveCount(0);

    // Pro: limit lifts, a second profile can be tracked.
    await setPlan(page, "pro");
    await expect(page.getByTestId("tracked-count")).toContainText("1 of 5");
    await page.getByTestId("add-profile-input").fill("quietcardio");
    await page.getByTestId("add-profile-submit").click();
    await page.waitForURL("**/app/dashboard?profile=quietcardio");
    await expect(page.getByTestId("profile-chip")).toHaveCount(2);

    // Clean up so other tests keep a known state.
    await page
      .getByTestId("profile-chip")
      .filter({ hasText: "quietcardio" })
      .getByTestId("untrack-button")
      .click();
    await expect(page.getByTestId("profile-chip")).toHaveCount(1);
    await setPlan(page, "free");
  });

  test("weekly digest cron composes and stores summaries", async ({
    page,
    request,
  }) => {
    await ensureTracked(page, "lanmoves");

    const response = await request.get("/api/cron/weekly-digest");
    expect(response.status()).toBe(200);
    const result = (await response.json()) as {
      usersProcessed: number;
      digestsWritten: number;
    };
    expect(result.digestsWritten).toBeGreaterThanOrEqual(1);
  });
});
