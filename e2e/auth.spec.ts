import { expect, test } from "@playwright/test";

/**
 * Auth flow details beyond the shared setup: validation, route protection,
 * sign-out, and lead conversion. Uses fresh identities so the shared E2E
 * session is never touched.
 */

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("auth", () => {
  test("signed-out users are redirected from the app to /signin", async ({
    page,
  }) => {
    await page.goto("/app/dashboard");
    await page.waitForURL("**/signin");
    await expect(page.getByTestId("signin-email")).toBeVisible();
  });

  test("invalid email shows a validation error", async ({ page }) => {
    await page.goto("/signin");
    // Passes the browser's native type=email check but fails server-side
    // validation (no TLD) — the error must come from the action.
    await page.getByTestId("signin-email").fill("invalid@nodot");
    await page.getByTestId("signin-submit").click();
    await expect(page.getByTestId("signin-error")).toBeVisible();
  });

  test("magic link signs in a brand-new email and sign-out ends the session", async ({
    page,
    request,
  }) => {
    const email = `auth-${Date.now()}@example.com`;

    // Leave a lead first (the audit lead-capture flow writes these).
    await page.goto("/audit/ghost.handle_404");
    await page.getByPlaceholder("you@email.com").fill(email);
    await page.getByRole("button", { name: "Email me the audit" }).click();
    await expect(page.getByTestId("lead-success")).toBeVisible();

    // First login converts it.
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
    await page.goto("/app/dashboard");
    await expect(page.getByTestId("session-email")).toContainText(email);

    // Sign out: session gone, app routes locked again.
    await page.getByTestId("signout-button").click();
    await page.waitForURL(/\/$/);
    await page.goto("/app/dashboard");
    await page.waitForURL("**/signin");
  });

  test("localized sign-in page renders (vi)", async ({ page }) => {
    await page.goto("/vi/signin");
    await expect(page.getByTestId("signin-submit")).toContainText(
      /liên kết đăng nhập/i,
    );
  });
});
