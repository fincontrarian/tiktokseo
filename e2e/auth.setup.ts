import { expect, test as setup } from "@playwright/test";

/**
 * Signs in the shared E2E user through the real magic-link flow (the link
 * is read back from /api/dev/magic-link — E2E test mode) and stores the
 * session for the main project. Also resets the plan to free so every run
 * starts from a known baseline.
 */

const EMAIL = "e2e@findable.test";
export const STORAGE_STATE = "e2e/.auth/user.json";

setup("authenticate via magic link", async ({ page, request }) => {
  await page.goto("/signin");
  await page.getByTestId("signin-email").fill(EMAIL);
  await page.getByTestId("signin-submit").click();
  await expect(page.getByTestId("magic-link-sent")).toBeVisible();

  const response = await request.get(
    `/api/dev/magic-link?email=${encodeURIComponent(EMAIL)}`,
  );
  expect(response.ok()).toBeTruthy();
  const { url } = (await response.json()) as { url: string };
  await page.goto(url);

  // Signed in: the app shell renders with the session email.
  await page.goto("/app/dashboard");
  await expect(page.getByTestId("session-email")).toContainText(EMAIL);

  // Known baseline for every dependent spec.
  await page.getByTestId("plan-free").click();
  await expect(page.getByTestId("plan-badge")).toContainText("Free");

  await page.context().storageState({ path: STORAGE_STATE });
});
