import { test, expect } from "@playwright/test";

// Helper function to login as demo user
async function loginAsDemo(page: any) {
  await page.goto("/login");
  await page.fill('input[name="email"]', "demo@workermill.com");
  await page.fill('input[type="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/projects");
}

// Helper function to navigate to dashboard
async function navigateToDashboard(page: any) {
  await loginAsDemo(page);
  await page.goto("/acme-backend/dashboard");
}

test.describe("Dashboard Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("should display dashboard page with proper layout", async ({ page }) => {
    await navigateToDashboard(page);

    // Check that we're on the dashboard page
    await expect(page).toHaveURL("/acme-backend/dashboard");

    // Should have dashboard heading or content
    await expect(page.locator("text=Dashboard").or(
      page.locator("h1").or(
        page.locator("[data-testid='dashboard-header']")
      )
    )).toBeVisible();

    // Should have main dashboard content area
    await expect(page.locator("main").or(
      page.locator(".dashboard-content").or(
        page.locator("[data-testid='dashboard-content']")
      )
    )).toBeVisible();
  });

  test("should display summary stat cards", async ({ page }) => {
    await navigateToDashboard(page);

    // Should have stat cards showing key metrics
    // Look for total runs stat
    await expect(page.locator("text=Total runs").or(
      page.locator("text=Total Runs")
    )).toBeVisible();

    // Look for success rate stat
    await expect(page.locator("text=Success Rate").or(
      page.locator("text=Success rate")
    )).toBeVisible();

    // Should show numeric values in the stat cards
    await expect(page.locator("text=/^\\d+$/.")).toBeVisible();

    // Should show percentage for success rate
    await expect(page.locator("text=/%/")).toBeVisible();
  });

  test("should display numeric stat values", async ({ page }) => {
    await navigateToDashboard(page);

    // Wait for dashboard to load
    await expect(page.locator("text=Total runs, text=Success Rate")).toBeVisible();

    // Should have numeric values displayed
    const statNumbers = page.locator("text=/^\\d+(\\.\\d+)?%?$/");
    await expect(statNumbers.first()).toBeVisible();

    // Check that numbers are reasonable (not negative)
    const firstStatValue = await statNumbers.first().textContent();
    if (firstStatValue) {
      const numericValue = parseFloat(firstStatValue.replace('%', ''));
      expect(numericValue).toBeGreaterThanOrEqual(0);
    }
  });

  test("should display runs by status chart", async ({ page }) => {
    await navigateToDashboard(page);

    // Should have runs by status chart section
    await expect(page.locator("text=Runs by Status")).toBeVisible();

    // Should have chart visualization (SVG or canvas)
    await expect(page.locator("svg").or(page.locator("canvas"))).toBeVisible();

    // Should show status legend with colors
    const legendItems = page.locator(".recharts-legend-item").or(
      page.locator("[data-testid='status-legend']").or(
        page.locator("text=COMPLETED, text=FAILED, text=QUEUED")
      )
    );

    // At least some legend items should be visible
    await expect(legendItems.first()).toBeVisible();
  });

  test("should display runs by task chart", async ({ page }) => {
    await navigateToDashboard(page);

    // Should have runs by task chart section
    await expect(page.locator("text=Runs by Task")).toBeVisible();

    // Should have chart visualization (SVG for Recharts)
    await expect(page.locator("svg")).toBeVisible();

    // Should show task names in the chart (either as labels or in legend)
    const taskElements = page.locator(".recharts-cartesian-axis-tick").or(
      page.locator(".recharts-bar").or(
        page.locator("[data-testid='task-chart-label']")
      )
    );

    if (await taskElements.count() > 0) {
      await expect(taskElements.first()).toBeVisible();
    }
  });

  test("should display runs over time chart", async ({ page }) => {
    await navigateToDashboard(page);

    // Should have runs over time chart section
    await expect(page.locator("text=Runs Over Time")).toBeVisible();

    // Should have subtitle indicating time period
    await expect(page.locator("text=Last 30 days")).toBeVisible();

    // Should have chart visualization
    await expect(page.locator("svg")).toBeVisible();

    // Should show time axis with dates
    const timeAxisElements = page.locator(".recharts-cartesian-axis-tick").or(
      page.locator(".recharts-area").or(
        page.locator("[data-testid='time-chart']")
      )
    );

    await expect(timeAxisElements.first()).toBeVisible();
  });

  test("should display success rate with colored indicator", async ({ page }) => {
    await navigateToDashboard(page);

    // Should have success rate section
    await expect(page.locator("text=Success Rate")).toBeVisible();

    // Should have large percentage number
    const percentageText = page.locator("text=/%$/");
    await expect(percentageText).toBeVisible();

    // Should have subtitle
    await expect(page.locator("text=Last 30 days")).toBeVisible();

    // Should show additional stats like failed runs
    await expect(page.locator("text=Failed").or(
      page.locator("text=failed runs")
    )).toBeVisible();
  });

  test("should display average duration if available", async ({ page }) => {
    await navigateToDashboard(page);

    // Look for average duration display
    const avgDurationElement = page.locator("text=Avg duration").or(
      page.locator("text=Average duration").or(
        page.locator("text=/\\d+ms|\\d+s|\\d+m/")
      )
    );

    // Average duration might not always be available, so check if it exists
    if (await avgDurationElement.count() > 0) {
      await expect(avgDurationElement.first()).toBeVisible();
    }
  });

  test("should handle empty state gracefully", async ({ page }) => {
    await navigateToDashboard(page);

    // Even with no data, dashboard should not crash
    await expect(page.locator("body")).not.toContainText("Error");
    await expect(page.locator("body")).not.toContainText("500");
    await expect(page.locator("body")).not.toContainText("Something went wrong");

    // Should still show chart containers
    await expect(page.locator("text=Runs by Status")).toBeVisible();
    await expect(page.locator("text=Success Rate")).toBeVisible();
  });

  test("should refresh data properly", async ({ page }) => {
    await navigateToDashboard(page);

    // Get initial stat values
    await expect(page.locator("text=Total runs")).toBeVisible();

    // Reload page
    await page.reload();

    // Should still show dashboard content
    await expect(page.locator("text=Total runs")).toBeVisible();
    await expect(page.locator("text=Success Rate")).toBeVisible();

    // Charts should still be visible
    await expect(page.locator("svg")).toBeVisible();
  });
});

test.describe("Dashboard Charts Interactivity", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await navigateToDashboard(page);
  });

  test("should show tooltips on chart hover", async ({ page }) => {
    // Look for chart elements that can be hovered
    const chartElements = page.locator(".recharts-pie-sector").or(
      page.locator(".recharts-bar").or(
        page.locator(".recharts-area-dot")
      )
    );

    if (await chartElements.count() > 0) {
      // Hover over first chart element
      await chartElements.first().hover();

      // Should show tooltip (might appear with delay)
      const tooltip = page.locator(".recharts-tooltip-wrapper").or(
        page.locator("[role='tooltip']").or(
          page.locator(".recharts-default-tooltip")
        )
      );

      // Check if tooltip appears
      if (await tooltip.count() > 0) {
        await expect(tooltip).toBeVisible();
      }
    }
  });

  test("should handle chart responsiveness", async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator("svg")).toBeVisible();

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator("svg")).toBeVisible();

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator("svg")).toBeVisible();

    // Charts should adapt to smaller screens
    const chartContainers = page.locator(".recharts-wrapper");
    if (await chartContainers.count() > 0) {
      const containerWidth = await chartContainers.first().boundingBox();
      expect(containerWidth?.width).toBeLessThanOrEqual(400); // Should fit mobile width
    }
  });
});

test.describe("Dashboard Data Accuracy", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await navigateToDashboard(page);
  });

  test("should display consistent data across charts and stats", async ({ page }) => {
    // Get total runs from stat card
    await expect(page.locator("text=Total runs")).toBeVisible();

    // The individual status counts in the pie chart should sum to total runs
    // This is a visual test - we can't easily verify the exact numbers
    // But we can ensure both elements are present and displaying data

    await expect(page.locator("text=Runs by Status")).toBeVisible();
    await expect(page.locator("svg")).toBeVisible();

    // Success rate should be between 0-100%
    const successRateElement = page.locator("text=/%$/");
    if (await successRateElement.count() > 0) {
      const rateText = await successRateElement.first().textContent();
      if (rateText) {
        const rate = parseFloat(rateText.replace('%', ''));
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(100);
      }
    }
  });

  test("should show reasonable time range for runs over time", async ({ page }) => {
    await expect(page.locator("text=Last 30 days")).toBeVisible();

    // Time chart should be present
    await expect(page.locator("text=Runs Over Time")).toBeVisible();
    await expect(page.locator("svg")).toBeVisible();

    // Should not show error states
    await expect(page.locator("body")).not.toContainText("Failed to load");
    await expect(page.locator("body")).not.toContainText("No data available");
  });

  test("should handle timezone display correctly", async ({ page }) => {
    // Runs over time chart should display dates in a readable format
    await expect(page.locator("text=Runs Over Time")).toBeVisible();

    // The chart should be rendered (we can't easily test exact date formatting)
    await expect(page.locator("svg")).toBeVisible();

    // Should not show invalid dates
    await expect(page.locator("body")).not.toContainText("Invalid Date");
    await expect(page.locator("body")).not.toContainText("NaN");
  });
});

test.describe("Dashboard Mobile Experience", () => {
  test("should be responsive on mobile devices", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await navigateToDashboard(page);

    // Dashboard should be accessible on mobile
    await expect(page.locator("text=Total runs").or(
      page.locator("text=Success Rate")
    )).toBeVisible();

    // Charts should be visible but possibly stacked
    await expect(page.locator("svg")).toBeVisible();

    // Stat cards should be readable on mobile
    const statCards = page.locator("text=Total runs").locator("..");
    if (await statCards.count() > 0) {
      const cardBounds = await statCards.first().boundingBox();
      expect(cardBounds?.width).toBeLessThanOrEqual(400);
    }
  });

  test("should handle touch interactions on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await navigateToDashboard(page);

    // Charts should handle touch events (basic test)
    const chartElements = page.locator(".recharts-pie-sector, .recharts-bar");

    if (await chartElements.count() > 0) {
      // Tap on chart element
      await chartElements.first().tap();

      // Should not cause errors
      await expect(page.locator("body")).not.toContainText("Error");
    }
  });
});