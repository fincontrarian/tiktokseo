import { expect, test } from "@playwright/test";

// Seeded data: lanmoves/quietlifter pass creator quality; #homeworkout has
// 68 videos (passes), #fyp has 7 (fails); "fitness" is the only niche.

test.describe("programmatic SEO pages", () => {
  test("creator report: stats, chart, top videos, audit CTA, JSON-LD", async ({
    page,
  }) => {
    await page.goto("/creators/lanmoves");

    await expect(page).toHaveTitle(
      /Lan \| Home Workout Coach \(@lanmoves\) TikTok Statistics & Analytics/,
    );
    await expect(page.getByTestId("niche-rank-badge")).toContainText(
      /#\d of \d in fitness/,
    );
    // follower chart rendered (recharts svg)
    await expect(
      page.locator("[data-testid=stat-chart] svg path").first(),
    ).toBeVisible();
    await expect(page.getByTestId("top-video")).toHaveCount(5);

    // The acquisition loop: prominent CTA into the free audit.
    const cta = page.getByTestId("audit-cta");
    await expect(cta).toContainText("Get the full SEO audit for @lanmoves");
    await expect(cta).toHaveAttribute("href", /\/audit\/lanmoves$/);

    // JSON-LD: ProfilePage with InteractionStatistic.
    const jsonLd = await page
      .locator('script[type="application/ld+json"]')
      .first()
      .textContent();
    const data = JSON.parse(jsonLd!);
    expect(data["@type"]).toBe("ProfilePage");
    expect(data.mainEntity.alternateName).toBe("@lanmoves");
    expect(data.mainEntity.interactionStatistic.length).toBeGreaterThan(0);
  });

  test("internal linking mesh: sideways and up, no orphans", async ({
    page,
  }) => {
    await page.goto("/creators/lanmoves");
    // up: niche hub
    await expect(page.getByTestId("niche-hub-link")).toHaveAttribute(
      "href",
      /\/niches\/fitness$/,
    );
    // sideways: similar creators
    expect(await page.getByTestId("similar-creator").count()).toBeGreaterThan(
      0,
    );
    // follow a similar-creator link → another live creator page
    await page.getByTestId("similar-creator").first().click();
    await expect(page).toHaveURL(/\/creators\/[a-z0-9_.]+$/);
    await expect(page.getByTestId("audit-cta")).toBeVisible();
  });

  test("quality thresholds 404 thin pages", async ({ request }) => {
    // #fyp exists but has only 7 videos — below the 50-video threshold.
    expect((await request.get("/hashtags/fyp")).status()).toBe(404);
    expect((await request.get("/creators/no.such.handle")).status()).toBe(404);
    expect((await request.get("/niches/cooking")).status()).toBe(404);
  });

  test("hashtag page: volume, growth chart, related tags, top creators", async ({
    page,
  }) => {
    await page.goto("/hashtags/homeworkout");
    await expect(page.getByTestId("hashtag-volume")).toContainText(
      /\d+ videos in our index/,
    );
    await expect(
      page.locator("[data-testid=stat-chart] svg path").first(),
    ).toBeVisible();
    expect(await page.getByTestId("related-tag-link").count()).toBeGreaterThan(
      0,
    );
    expect(await page.getByTestId("top-creator").count()).toBeGreaterThan(0);
    await expect(page.getByTestId("niche-hub-link")).toHaveAttribute(
      "href",
      /\/niches\/fitness$/,
    );
  });

  test("niche hub ranks by engagement rate, not followers", async ({
    page,
  }) => {
    await page.goto("/niches/fitness");
    const rows = page.getByTestId("niche-row");
    expect(await rows.count()).toBeGreaterThanOrEqual(3);
    // quietlifter (6.2k followers) outranks quietcardio (128k) on ER.
    await expect(rows.first()).toContainText("@quietlifter");
    await expect(page.getByTestId("niche-medians")).toContainText("%");
    // underrated: high save rate, <10k followers
    await expect(page.getByTestId("underrated-card")).toContainText(
      "@quietlifter",
    );
  });

  test("localized public pages render (vi)", async ({ page }) => {
    await page.goto("/vi/creators/lanmoves");
    await expect(page.getByTestId("audit-cta")).toContainText(
      /Nhận kiểm tra SEO/,
    );
  });

  test("robots.txt welcomes AI crawlers and points at the sitemap", async ({
    request,
  }) => {
    const robots = await (await request.get("/robots.txt")).text();
    for (const bot of [
      "GPTBot",
      "ClaudeBot",
      "PerplexityBot",
      "Google-Extended",
    ]) {
      expect(robots).toContain(bot);
    }
    expect(robots).toContain("/sitemap.xml");
    expect(robots).not.toContain("Disallow: /");
  });

  test("llms.txt describes the site and top tools", async ({ request }) => {
    const llms = await (await request.get("/llms.txt")).text();
    expect(llms).toContain("# Findable");
    expect(llms).toContain("75 million TikTok videos");
    expect(llms).toContain("/audit");
    expect(llms).toMatch(/not affiliated with,\s+endorsed by, or sponsored/);
  });

  test("sitemap cron builds gzipped children behind an index", async ({
    request,
  }) => {
    const run = await request.get("/api/cron/sitemaps?limit=1000");
    expect(run.status()).toBe(200);
    const result = (await run.json()) as { totalUrls: number };
    expect(result.totalUrls).toBeGreaterThan(0);

    const index = await (await request.get("/sitemap.xml")).text();
    expect(index).toContain("<sitemapindex");
    expect(index).toContain("/sitemaps/creators-1.xml");

    // Child is served gzipped; the client decompresses via Content-Encoding.
    const child = await request.get("/sitemaps/creators-1.xml");
    expect(child.status()).toBe(200);
    const xml = await child.text();
    expect(xml).toContain("<urlset");
    expect(xml).toContain("/creators/lanmoves");
    expect(xml).toContain("/vi/creators/lanmoves");

    expect((await request.get("/sitemaps/creators-99.xml")).status()).toBe(404);
  });
});
