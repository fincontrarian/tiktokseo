import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Data from prisma/seed.ts — run `npx prisma db seed` before this suite.

/** The plan lives in the DB now (subscription rows), so set it explicitly. */
async function setPlan(page: Page, plan: "free" | "pro") {
  await page.getByTestId(`plan-${plan}`).click();
  await expect(page.getByTestId("plan-badge")).toContainText(
    plan === "free" ? "Free" : "Pro",
  );
}

test.describe("keyword research — recency gating", () => {
  test("free plan: 3 delayed rows, banded growth, blurred rest, upgrade CTA, no export", async ({
    page,
  }) => {
    await page.goto("/app/keywords");
    await setPlan(page, "free");

    await expect(page.getByTestId("free-notice")).toBeVisible();
    await expect(page.getByTestId("keyword-row")).toHaveCount(3);
    // growth is shown as bands, not numbers
    expect(await page.getByTestId("growth-band").count()).toBeGreaterThan(0);
    const table = page.locator("table");
    await expect(table).not.toContainText(/%/);
    // locked placeholders + upgrade wall, and no export button
    expect(await page.getByTestId("locked-row").count()).toBeGreaterThan(0);
    await expect(page.getByTestId("upgrade-wall")).toBeVisible();
    // The wall CTA carries gate attribution into /pricing.
    await expect(page.getByTestId("upgrade-cta")).toHaveAttribute(
      "href",
      /\/pricing\?from=keywords-blur$/,
    );
    await expect(page.getByTestId("export-csv")).toHaveCount(0);
  });

  test("paid plan: fresh data, exact numbers, all rows, CSV export", async ({
    page,
  }) => {
    await page.goto("/app/keywords");
    await setPlan(page, "pro");

    await expect(page.getByTestId("keyword-row")).toHaveCount(10);
    await expect(page.getByTestId("locked-row")).toHaveCount(0);
    await expect(page.locator("table")).toContainText(/%/);

    const exportLink = page.getByTestId("export-csv");
    await expect(exportLink).toBeVisible();
    const href = await exportLink.getAttribute("href");
    const response = await page.request.get(href!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    expect(await response.text()).toContain("home workout");
  });

  test("autocomplete suggests keywords and filters the table", async ({
    page,
  }) => {
    await page.goto("/app/keywords");
    await page.getByPlaceholder("Search keywords…").fill("ho");
    const suggestion = page
      .getByTestId("suggestions")
      .getByRole("button", { name: "home workout" });
    await expect(suggestion).toBeVisible();
    await suggestion.click();

    await page.waitForURL(/q=home\+workout|q=home%20workout/);
    await expect(page.getByTestId("keyword-row")).toHaveCount(1);
    await expect(page.getByTestId("keyword-row")).toContainText("home workout");
  });

  test("selecting a keyword shows co-occurring hashtags", async ({ page }) => {
    await page.goto("/app/keywords");
    await page
      .getByTestId("keyword-row")
      .first()
      .getByRole("link", { name: "home workout" })
      .click();

    const panel = page.getByTestId("related-panel");
    await expect(panel).toContainText('Related to "home workout"');
    await expect(panel).toContainText("#quietcardio");
    await expect(panel).toContainText(/shared videos/);
  });

  test("locale filter switches markets (vi keywords)", async ({ page }) => {
    await page.goto("/app/keywords?kwl=vi");
    await setPlan(page, "pro");
    await page.goto("/app/keywords?kwl=vi");
    await expect(page.getByTestId("keyword-row").first()).toContainText(
      /bài tập tại nhà|giảm mỡ bụng/,
    );
  });

  test("add to tracking persists across reloads", async ({ page }) => {
    await page.goto("/app/keywords");
    const firstRow = page.getByTestId("keyword-row").first();

    // Idempotent across runs: track only if not already tracked.
    const trackButton = firstRow.getByTestId("track-button");
    if (await trackButton.isVisible().catch(() => false)) {
      await trackButton.click();
    }
    await expect(firstRow.getByTestId("tracked-badge")).toBeVisible();

    await page.reload();
    await expect(
      page.getByTestId("keyword-row").first().getByTestId("tracked-badge"),
    ).toBeVisible();
  });
});
