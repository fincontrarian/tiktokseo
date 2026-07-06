import { expect, test } from "@playwright/test";

// Handles from prisma/seed.ts — run `npx prisma db seed` before this suite.
const SEEDED_HANDLE = "lanmoves";
const UNKNOWN_HANDLE = "ghost.handle_404";

test.describe("free audit flow", () => {
  test("seeded handle shows a score, grade, and visible fix hints", async ({
    page,
  }) => {
    await page.goto("/audit");
    await expect(
      page.getByRole("heading", { name: /TikTok is a search engine/i }),
    ).toBeVisible();

    await page.getByPlaceholder("@yourhandle").fill(`@${SEEDED_HANDLE}`);
    await page.getByRole("button", { name: "Audit my profile" }).click();

    await page.waitForURL(`**/audit/${SEEDED_HANDLE}`);

    const score = page.getByTestId("score-value");
    await expect(score).toBeVisible();
    const scoreValue = Number(await score.textContent());
    expect(scoreValue).toBeGreaterThan(0);
    expect(scoreValue).toBeLessThanOrEqual(100);

    await expect(page.getByTestId("score-grade")).toBeVisible();

    // Two highest-priority checks are fully visible with fix hints.
    await expect(page.getByTestId("fix-hint")).toHaveCount(2);

    // The rest sit behind the signup wall.
    await expect(page.getByTestId("locked-section")).toBeVisible();
    expect(await page.getByTestId("locked-check-card").count()).toBeGreaterThan(
      0,
    );
  });

  test("unlocking the full report via email reveals all checks", async ({
    page,
  }) => {
    await page.goto(`/audit/${SEEDED_HANDLE}`);

    const wall = page.getByTestId("locked-section");
    await expect(wall).toBeVisible();
    await wall.getByPlaceholder("you@email.com").fill("creator@example.com");
    await wall.getByRole("button", { name: "Unlock full report" }).click();

    // Cookie set by the action re-renders the page with all checks visible.
    await expect(page.getByTestId("locked-check-card")).toHaveCount(0, {
      timeout: 15_000,
    });
    expect(await page.getByTestId("check-card").count()).toBe(6);
  });

  test("unknown handle offers lead capture and confirms it", async ({
    page,
  }) => {
    await page.goto("/audit");
    await page.getByPlaceholder("@yourhandle").fill(UNKNOWN_HANDLE);
    await page.getByRole("button", { name: "Audit my profile" }).click();

    await page.waitForURL(`**/audit/${UNKNOWN_HANDLE}`);
    await expect(
      page.getByRole("heading", { name: /isn't in our index yet/i }),
    ).toBeVisible();

    await page.getByPlaceholder("you@email.com").fill("waiting@example.com");
    await page.getByRole("button", { name: "Email me the audit" }).click();
    await expect(page.getByTestId("lead-success")).toBeVisible();
  });

  test("vi locale renders the localized audit page with the disclaimer", async ({
    page,
  }) => {
    await page.goto("/vi/audit");
    await expect(
      page.getByRole("heading", {
        name: /TikTok là một công cụ tìm kiếm/i,
      }),
    ).toBeVisible();
    await expect(page.getByText(/nền tảng phân tích độc lập/i)).toBeVisible();
  });

  test("invalid handle shows a friendly validation error", async ({ page }) => {
    await page.goto("/audit");
    await page.getByPlaceholder("@yourhandle").fill("not a handle!!");
    await page.getByRole("button", { name: "Audit my profile" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  });
});
