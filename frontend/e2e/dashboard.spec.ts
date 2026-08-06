import { test, expect, type Page } from '@playwright/test';
import type { DashboardAnalytics, SessionUser } from '../src/types';

const mockUser: SessionUser = {
  id: 'user-1',
  email: 'demo@example.com',
  name: 'Demo User',
  avatarUrl: null,
};

// Builds a 30-entry, oldest->newest UTC-day series ending today, matching
// the shape zeroFillSeries produces server-side (design D3).
function buildSeries(clicksPerDay: number[]): DashboardAnalytics['series'] {
  const today = new Date();
  return clicksPerDay.map((clicks, index) => {
    const offset = clicksPerDay.length - 1 - index;
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset));
    return { date: date.toISOString().slice(0, 10), clicks };
  });
}

async function mockAuth(page: Page, user: SessionUser | null): Promise<void> {
  await page.route('**/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user }) }),
  );
}

async function mockDashboard(page: Page, dashboard: DashboardAnalytics): Promise<void> {
  await page.route('**/api/analytics/dashboard', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dashboard) }),
  );
}

test.describe('Dashboard page', () => {
  test('renders aggregate analytics for a signed-in user with data', async ({ page }) => {
    await mockAuth(page, mockUser);
    await mockDashboard(page, {
      totalClicks30d: 5,
      series: buildSeries([...Array(29).fill(0), 5]),
      topLinks: [{ linkId: 'link-1', shortCode: 'abc123', totalClicks: 5 }],
    });

    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.locator('.stat-summary__value')).toHaveText('5');
    await expect(page.locator('.clicks-bar-chart')).toBeVisible();
    await expect(page.getByText('abc123')).toBeVisible();
  });

  test('shows an empty state for a user with zero links', async ({ page }) => {
    await mockAuth(page, mockUser);
    await mockDashboard(page, {
      totalClicks30d: 0,
      series: buildSeries(Array(30).fill(0)),
      topLinks: [],
    });

    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText(/no clicks yet/i)).toBeVisible();
    await expect(page.locator('.clicks-bar-chart')).toHaveCount(0);
  });

  test('shows an empty state for a user whose links have never been clicked', async ({ page }) => {
    await mockAuth(page, mockUser);
    // Same aggregate shape as "zero links" — a link that exists but was never
    // clicked is indistinguishable from the dashboard endpoint's response
    // (both totalClicks30d=0 and topLinks=[]), so it renders the same empty
    // state by construction (see DashboardPage's render-order comment).
    await mockDashboard(page, {
      totalClicks30d: 0,
      series: buildSeries(Array(30).fill(0)),
      topLinks: [],
    });

    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText(/no clicks yet/i)).toBeVisible();
  });

  test('prompts sign-in instead of dashboard data when unauthenticated', async ({ page }) => {
    await mockAuth(page, null);

    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText(/sign in to see your dashboard/i)).toBeVisible();
    await expect(page.locator('.create-card').getByRole('link', { name: /sign in with google/i })).toBeVisible();
  });
});
