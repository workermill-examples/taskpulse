import { test, expect, devices } from "@playwright/test";

// Test mobile viewport specifically
const iPhone = devices["iPhone 13"];
const tablet = devices["iPad"];

test.describe("Mobile Responsive Design", () => {
  test.beforeEach(async ({ page, browser }) => {
    // Login as demo user for all mobile tests
    await page.goto("/login");
    await page.fill('input[name="email"]', "demo@workermill.com");
    await page.fill('input[type="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/projects");
  });

  test("should display mobile-optimized login page", async ({ browser }) => {
    const context = await browser.newContext({
      ...iPhone,
    });
    const page = await context.newPage();

    await page.goto("/login");

    // Check that form is readable and clickable on mobile
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Check that elements are properly sized for touch
    const emailInput = page.locator('input[name="email"]');
    const emailBox = await emailInput.boundingBox();
    expect(emailBox?.height).toBeGreaterThan(40); // Minimum touch target size

    const submitButton = page.locator('button[type="submit"]');
    const submitBox = await submitButton.boundingBox();
    expect(submitBox?.height).toBeGreaterThan(40);

    await context.close();
  });

  test("should show collapsible sidebar on mobile", async ({ browser }) => {
    const context = await browser.newContext({
      ...iPhone,
    });
    const page = await context.newPage();

    // Login first
    await page.goto("/login");
    await page.fill('input[name="email"]', "demo@workermill.com");
    await page.fill('input[type="password"]', "demo1234");
    await page.click('button[type="submit"]');

    // Navigate to a project page with sidebar
    await page.goto("/acme-backend/runs");

    // On mobile, sidebar should be hidden by default or collapsible
    const sidebar = page.locator('[data-testid="sidebar"]').or(
      page.locator('aside').or(
        page.locator('[role="navigation"]')
      )
    );

    // Look for hamburger menu button
    const hamburgerButton = page.locator('[data-testid="mobile-menu-button"]').or(
      page.locator('[aria-label="Toggle navigation"]').or(
        page.locator('button:has([data-testid="menu-icon"])')
      )
    );

    if (await hamburgerButton.count() > 0) {
      // Test hamburger menu functionality
      await hamburgerButton.first().click();

      // Sidebar should become visible
      await expect(sidebar.first()).toBeVisible();

      // Click hamburger again to close
      await hamburgerButton.first().click();

      // Sidebar should be hidden again (or have overlay removed)
      // Note: sidebar might still be visible but with different styling
    }

    await context.close();
  });

  test("should display mobile-optimized runs table", async ({ browser }) => {
    const context = await browser.newContext({
      ...iPhone,
    });
    const page = await context.newPage();

    // Login and navigate to runs
    await page.goto("/login");
    await page.fill('input[name="email"]', "demo@workermill.com");
    await page.fill('input[type="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.goto("/acme-backend/runs");

    // Table should be responsive - might be scrollable or stacked
    const table = page.locator('table').or(page.locator('[role="table"]'));

    if (await table.count() > 0) {
      await expect(table.first()).toBeVisible();

      // Should not overflow the viewport
      const tableBox = await table.first().boundingBox();
      const viewportSize = page.viewportSize();

      if (tableBox && viewportSize) {
        // Table should not be significantly wider than viewport
        expect(tableBox.width).toBeLessThanOrEqual(viewportSize.width + 50); // Allow small overflow for scrollable tables
      }
    }

    // Check if run rows are clickable with sufficient touch targets
    const runRows = page.locator('[data-testid="run-row"]').or(
      page.locator('tbody tr').or(
        page.locator('[role="row"]')
      )
    );

    if (await runRows.count() > 0) {
      const firstRow = runRows.first();
      const rowBox = await firstRow.boundingBox();
      expect(rowBox?.height).toBeGreaterThan(40); // Minimum touch target
    }

    await context.close();
  });

  test("should handle mobile filters and search", async ({ browser }) => {
    const context = await browser.newContext({
      ...iPhone,
    });
    const page = await context.newPage();

    // Login and navigate to runs
    await page.goto("/login");
    await page.fill('input[name="email"]', "demo@workermill.com");
    await page.fill('input[type="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.goto("/acme-backend/runs");

    // Look for filter controls
    const statusFilter = page.locator('[data-testid="status-filter"]').or(
      page.locator('select').first().or(
        page.locator('[role="combobox"]').first()
      )
    );

    if (await statusFilter.count() > 0) {
      // Filter dropdown should be touch-friendly
      const filterBox = await statusFilter.first().boundingBox();
      expect(filterBox?.height).toBeGreaterThan(40);

      // Should be clickable
      await statusFilter.first().click();
    }

    await context.close();
  });

  test("should display mobile-optimized dashboard charts", async ({ browser }) => {
    const context = await browser.newContext({
      ...iPhone,
    });
    const page = await context.newPage();

    // Login and navigate to dashboard
    await page.goto("/login");
    await page.fill('input[name="email"]', "demo@workermill.com");
    await page.fill('input[type="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.goto("/acme-backend/dashboard");

    // Charts should be visible and responsive
    const charts = page.locator('[data-testid="chart"]').or(
      page.locator('svg').or(
        page.locator('.recharts-wrapper')
      )
    );

    if (await charts.count() > 0) {
      // At least one chart should be visible
      await expect(charts.first()).toBeVisible();

      // Charts should fit within mobile viewport
      const chartBox = await charts.first().boundingBox();
      const viewportSize = page.viewportSize();

      if (chartBox && viewportSize) {
        expect(chartBox.width).toBeLessThanOrEqual(viewportSize.width);
      }
    }

    // Stat cards should stack vertically on mobile
    const statCards = page.locator('[data-testid="stat-card"]').or(
      page.locator('.bg-gray-900')
    );

    if (await statCards.count() > 1) {
      const firstCard = await statCards.first().boundingBox();
      const secondCard = await statCards.nth(1).boundingBox();

      if (firstCard && secondCard) {
        // On mobile, cards should be stacked (second card below first)
        expect(secondCard.y).toBeGreaterThan(firstCard.y + firstCard.height - 20);
      }
    }

    await context.close();
  });

  test("should handle tablet layout correctly", async ({ browser }) => {
    const context = await browser.newContext({
      ...tablet,
    });
    const page = await context.newPage();

    // Login and navigate to project
    await page.goto("/login");
    await page.fill('input[name="email"]', "demo@workermill.com");
    await page.fill('input[type="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.goto("/acme-backend/runs");

    // Sidebar should be visible or easily accessible on tablet
    const sidebar = page.locator('[data-testid="sidebar"]').or(
      page.locator('aside').or(
        page.locator('[role="navigation"]')
      )
    );

    // Either sidebar is visible or hamburger menu exists
    const sidebarVisible = await sidebar.count() > 0 && await sidebar.first().isVisible();
    const hamburgerExists = await page.locator('[data-testid="mobile-menu-button"]').count() > 0;

    expect(sidebarVisible || hamburgerExists).toBeTruthy();

    await context.close();
  });

  test("should handle touch interactions properly", async ({ browser }) => {
    const context = await browser.newContext({
      ...iPhone,
      hasTouch: true,
    });
    const page = await context.newPage();

    // Login and navigate to runs
    await page.goto("/login");
    await page.fill('input[name="email"]', "demo@workermill.com");
    await page.fill('input[type="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.goto("/acme-backend/runs");

    // Test touch interactions on clickable elements
    const clickableElements = await page.locator('button, a, [role="button"], [data-testid="run-row"]').all();

    for (let i = 0; i < Math.min(clickableElements.length, 3); i++) {
      const element = clickableElements[i];
      if (await element.isVisible()) {
        const box = await element.boundingBox();
        if (box) {
          // Touch targets should be at least 40px
          expect(box.height).toBeGreaterThan(38);

          // Element should be touchable (tap test)
          await element.tap({ timeout: 5000 });
          // If tap was successful, no error should be thrown
        }
      }
    }

    await context.close();
  });

  test("should maintain dark theme on mobile", async ({ browser }) => {
    const context = await browser.newContext({
      ...iPhone,
    });
    const page = await context.newPage();

    // Login and navigate to project
    await page.goto("/login");
    await page.fill('input[name="email"]', "demo@workermill.com");
    await page.fill('input[type="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.goto("/acme-backend/runs");

    // Check that dark theme colors are applied
    const body = page.locator("body");
    const bodyStyles = await body.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
        color: styles.color,
      };
    });

    // Dark theme should have dark background
    // RGB values for dark backgrounds are typically low
    const bgColor = bodyStyles.backgroundColor;
    expect(bgColor).toMatch(/rgb\(([0-9]|[1-5][0-9]|6[0-3]),\s*([0-9]|[1-5][0-9]|6[0-3]),\s*([0-9]|[1-5][0-9]|6[0-3])\)/);

    await context.close();
  });
});

test.describe("Cross-Browser Mobile Compatibility", () => {
  test("should work on Safari mobile viewport", async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    // Basic login and navigation test
    await page.goto("/login");
    await page.fill('input[name="email"]', "demo@workermill.com");
    await page.fill('input[type="password"]', "demo1234");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("/projects");
    await expect(page.locator("h1")).toContainText("Projects");

    await context.close();
  });
});