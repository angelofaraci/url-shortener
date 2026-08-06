import { test, expect } from '@playwright/test';

// D7: /dashboard, /stats, and /links must render the SPA on direct
// navigation and hard refresh, not fall through to the backend's `/:code`
// redirect handler (which would 302 to /link-error). This is the real
// regression today in production (k8s ingress / CloudFront never route
// these paths to the frontend origin — see design D7 and tasks Phase 7).
//
// NOTE (residual risk, tracked for PR3): against `npm run dev` (this
// Playwright config's webServer), Vite's own dev-server history fallback
// already serves index.html for unknown paths, so this test currently
// PASSES locally without exercising the production edge-routing gap it is
// meant to catch. It only becomes a meaningful signal once run against the
// real k8s/CloudFront-fronted deployment, which is out of scope for this
// PR (frontend-only, WU2) and lands in PR3 (tasks 7.1-7.5). Kept here so
// PR3 can point CI/staging runs at it to close the loop.
const spaRoutes = ['/dashboard', '/stats', '/links'];

for (const route of spaRoutes) {
  test(`direct navigation and refresh on ${route} renders the SPA, not /link-error`, async ({ page }) => {
    await page.route('**/auth/me', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: null }) }),
    );
    await page.route('**/api/links', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: false, links: [] }),
      }),
    );

    await page.goto(route);
    await expect(page).not.toHaveURL(/\/link-error/);
    await expect(page.locator('.app-shell')).toBeVisible();

    await page.reload();
    await expect(page).not.toHaveURL(/\/link-error/);
    await expect(page.locator('.app-shell')).toBeVisible();
  });
}
