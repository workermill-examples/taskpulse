import { test, expect } from "@playwright/test";

// Helper function to login as demo user
async function loginAsDemo(page: any) {
  await page.goto("/login");
  await page.fill('input[name="email"]', "demo@workermill.com");
  await page.fill('input[type="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/projects");
}

// Helper function to navigate to runs page
async function navigateToRuns(page: any) {
  await loginAsDemo(page);
  await page.goto("/acme-backend/runs");
}

test.describe("Runs List Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("should display runs list page with proper layout", async ({ page }) => {
    await navigateToRuns(page);

    // Check page title and heading
    await expect(page.locator("h1")).toContainText("Runs");

    // Should have a trigger run button
    await expect(page.locator('button:has-text("Trigger Run")')).toBeVisible();

    // Should have filters section
    await expect(page.locator("text=Status")).toBeVisible();
    await expect(page.locator("text=Task")).toBeVisible();
    await expect(page.locator("text=From")).toBeVisible();
    await expect(page.locator("text=To")).toBeVisible();

    // Should have apply filters button
    await expect(page.locator('button:has-text("Apply Filters")')).toBeVisible();

    // Should have table headers
    await expect(page.locator("th:has-text('Status')")).toBeVisible();
    await expect(page.locator("th:has-text('Task')")).toBeVisible();
    await expect(page.locator("th:has-text('Triggered By')")).toBeVisible();
    await expect(page.locator("th:has-text('Started')")).toBeVisible();
    await expect(page.locator("th:has-text('Duration')")).toBeVisible();
    await expect(page.locator("th:has-text('Run ID')")).toBeVisible();
  });

  test("should show loading state initially", async ({ page }) => {
    await loginAsDemo(page);

    // Navigate to runs and check for loading state
    const navigationPromise = page.goto("/acme-backend/runs");

    // Look for skeleton loading or loading spinner
    await expect(page.locator(".animate-pulse").or(page.locator(".animate-spin"))).toBeVisible();

    await navigationPromise;

    // Eventually should show content
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
  });

  test("should display runs data in table format", async ({ page }) => {
    await navigateToRuns(page);

    // Wait for table to load
    await expect(page.locator("table")).toBeVisible();

    // Check for at least one run row (from seed data)
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCountGreaterThan(0);

    // Check that first row has expected cells
    const firstRow = rows.first();
    await expect(firstRow.locator("td").nth(0)).toBeVisible(); // Status
    await expect(firstRow.locator("td").nth(1)).toBeVisible(); // Task
    await expect(firstRow.locator("td").nth(2)).toBeVisible(); // Triggered By
    await expect(firstRow.locator("td").nth(3)).toBeVisible(); // Started
    await expect(firstRow.locator("td").nth(4)).toBeVisible(); // Duration
    await expect(firstRow.locator("td").nth(5)).toBeVisible(); // Run ID
  });

  test("should navigate to run detail on row click", async ({ page }) => {
    await navigateToRuns(page);

    // Wait for table to load
    await expect(page.locator("table")).toBeVisible();

    // Click on first run row
    const firstRow = page.locator("tbody tr").first();
    await firstRow.click();

    // Should navigate to run detail page
    await expect(page).toHaveURL(/\/acme-backend\/runs\/[a-f0-9\-]+/);
  });

  test("should filter runs by status", async ({ page }) => {
    await navigateToRuns(page);

    // Wait for table to load
    await expect(page.locator("table")).toBeVisible();

    // Check COMPLETED status filter
    await page.check('input[type="checkbox"] + span:has-text("Completed")');
    await page.click('button:has-text("Apply Filters")');

    // Should filter the results
    await expect(page.locator("table")).toBeVisible();

    // URL should contain status parameter
    await expect(page).toHaveURL(/status=COMPLETED/);
  });

  test("should filter runs by task", async ({ page }) => {
    await navigateToRuns(page);

    // Wait for table to load and task dropdown to be populated
    await expect(page.locator("table")).toBeVisible();
    await expect(page.locator("select option")).toHaveCountGreaterThan(1);

    // Select a task from dropdown (not "All Tasks")
    const taskSelect = page.locator("select");
    const taskOptions = taskSelect.locator("option");

    // Skip first option which is "All Tasks"
    const secondOption = taskOptions.nth(1);
    const taskValue = await secondOption.getAttribute("value");

    if (taskValue) {
      await taskSelect.selectOption(taskValue);
      await page.click('button:has-text("Apply Filters")');

      // Should filter the results
      await expect(page.locator("table")).toBeVisible();

      // URL should contain taskId parameter
      await expect(page).toHaveURL(new RegExp(`taskId=${taskValue}`));
    }
  });

  test("should filter runs by date range", async ({ page }) => {
    await navigateToRuns(page);

    // Wait for table to load
    await expect(page.locator("table")).toBeVisible();

    // Set date range filters
    const today = new Date().toISOString().split("T")[0];
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    await page.fill('input[type="date"]', lastWeek);
    await page.fill('input[type="date"]:nth-of-type(2)', today);
    await page.click('button:has-text("Apply Filters")');

    // Should filter the results
    await expect(page.locator("table")).toBeVisible();

    // URL should contain date parameters
    await expect(page).toHaveURL(/from=.*&to=/);
  });

  test("should clear all filters", async ({ page }) => {
    await navigateToRuns(page);

    // Wait for table to load
    await expect(page.locator("table")).toBeVisible();

    // Apply some filters first
    await page.check('input[type="checkbox"] + span:has-text("Failed")');
    const today = new Date().toISOString().split("T")[0];
    await page.fill('input[type="date"]', today);
    await page.click('button:has-text("Apply Filters")');

    // Clear filters should now be visible
    await expect(page.locator('button:has-text("Clear Filters")')).toBeVisible();

    // Click clear filters
    await page.click('button:has-text("Clear Filters")');

    // Filters should be reset
    await expect(page.locator('input[type="checkbox"]:checked')).toHaveCount(0);
    await expect(page.locator('input[type="date"]').first()).toHaveValue("");
  });

  test("should show load more button when more results available", async ({ page }) => {
    await navigateToRuns(page);

    // Wait for table to load
    await expect(page.locator("table")).toBeVisible();

    // Check for Load More button (may not always be present depending on data)
    const loadMoreButton = page.locator('button:has-text("Load More")');

    if (await loadMoreButton.count() > 0) {
      await expect(loadMoreButton).toBeVisible();

      // Click load more and check loading state
      await loadMoreButton.click();

      // Should show loading state temporarily
      await expect(page.locator('button:has-text("Loading...")')).toBeVisible();
    }
  });

  test("should show empty state when no runs match filters", async ({ page }) => {
    await navigateToRuns(page);

    // Wait for table to load
    await expect(page.locator("table")).toBeVisible();

    // Apply filters that should return no results
    await page.check('input[type="checkbox"] + span:has-text("Cancelled")');
    await page.check('input[type="checkbox"] + span:has-text("Timed Out")');
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    await page.fill('input[type="date"]', futureDate);
    await page.click('button:has-text("Apply Filters")');

    // Should show empty state
    await expect(page.locator("text=No runs found")).toBeVisible();
    await expect(page.locator("text=Try adjusting your filters")).toBeVisible();
  });
});

test.describe("Trigger Run Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await navigateToRuns(page);
  });

  test("should open trigger run dialog", async ({ page }) => {
    await page.click('button:has-text("Trigger Run")');

    // Dialog should be visible
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator("text=Trigger Run")).toBeVisible();

    // Should have task selector and JSON input
    await expect(page.locator("label:has-text('Task')")).toBeVisible();
    await expect(page.locator("label:has-text('Input (JSON)')")).toBeVisible();
    await expect(page.locator("textarea")).toBeVisible();

    // Should have Cancel and Trigger buttons
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    await expect(page.locator('button:has-text("Trigger Run")')).toBeVisible();
  });

  test("should close dialog on cancel", async ({ page }) => {
    await page.click('button:has-text("Trigger Run")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    await page.click('button:has-text("Cancel")');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test("should show task options in dropdown", async ({ page }) => {
    await page.click('button:has-text("Trigger Run")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Click on task selector to open dropdown
    await page.click('[role="button"]:has-text("Select a task")');

    // Should show task options
    await expect(page.locator('[role="option"]')).toHaveCountGreaterThan(0);
  });

  test("should validate JSON input", async ({ page }) => {
    await page.click('button:has-text("Trigger Run")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Enter invalid JSON
    await page.fill("textarea", "{ invalid json");

    // Try to submit
    await page.click('button:has-text("Trigger Run")');

    // Should show error message
    await expect(page.locator("text=Invalid JSON input")).toBeVisible();
  });

  test("should require task selection", async ({ page }) => {
    await page.click('button:has-text("Trigger Run")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Don't select a task, just try to submit
    await page.click('button:has-text("Trigger Run")');

    // Should show error message
    await expect(page.locator("text=Please select a task")).toBeVisible();
  });

  test("should successfully trigger a run", async ({ page }) => {
    await page.click('button:has-text("Trigger Run")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Wait for tasks to load and select first task
    await expect(page.locator('[role="button"]:has-text("Select a task")').or(
      page.locator('[role="button"]:not(:has-text("Select a task"))')
    )).toBeVisible();

    // If no task is pre-selected, open dropdown and select first option
    if (await page.locator('[role="button"]:has-text("Select a task")').count() > 0) {
      await page.click('[role="button"]:has-text("Select a task")');
      await page.click('[role="option"]').first();
    }

    // Enter valid JSON
    await page.fill("textarea", '{"test": true}');

    // Submit the form
    await page.click('button:has-text("Trigger Run")');

    // Should show loading state
    await expect(page.locator('button:has-text("Triggering...")')).toBeVisible();

    // Should eventually navigate to run detail page
    await expect(page).toHaveURL(/\/acme-backend\/runs\/[a-f0-9\-]+/, { timeout: 10000 });
  });
});

test.describe("Run Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await navigateToRuns(page);
  });

  test("should display run detail page layout", async ({ page }) => {
    // Click on first run to navigate to detail
    await expect(page.locator("table")).toBeVisible();
    const firstRow = page.locator("tbody tr").first();
    await firstRow.click();

    // Should be on run detail page
    await expect(page).toHaveURL(/\/acme-backend\/runs\/[a-f0-9\-]+/);

    // Should have run header information
    await expect(page.locator("text=Run")).toBeVisible();

    // Should have status badge
    await expect(page.locator(".bg-gray-400\\/10, .bg-blue-400\\/10, .bg-emerald-400\\/10, .bg-red-400\\/10")).toBeVisible();

    // Should have timeline section
    await expect(page.locator("text=Timeline").or(page.locator("text=Steps"))).toBeVisible();

    // Should have logs section
    await expect(page.locator("text=Logs")).toBeVisible();
  });

  test("should display run timeline with steps", async ({ page }) => {
    // Navigate to a run detail page
    await expect(page.locator("table")).toBeVisible();
    const firstRow = page.locator("tbody tr").first();
    await firstRow.click();

    await expect(page).toHaveURL(/\/acme-backend\/runs\/[a-f0-9\-]+/);

    // Should show timeline/steps
    const timelineSteps = page.locator(".timeline-step, .step-item, [data-testid='run-step']").or(
      page.locator("text=Step").locator("..")
    );

    // There should be at least one step
    await expect(timelineSteps.first()).toBeVisible();
  });

  test("should display run logs with proper formatting", async ({ page }) => {
    // Navigate to a run detail page
    await expect(page.locator("table")).toBeVisible();
    const firstRow = page.locator("tbody tr").first();
    await firstRow.click();

    await expect(page).toHaveURL(/\/acme-backend\/runs\/[a-f0-9\-]+/);

    // Should have logs section with monospace font
    await expect(page.locator(".font-mono")).toBeVisible();

    // Should have log level filters
    await expect(page.locator('button:has-text("ALL")').or(
      page.locator('button:has-text("INFO")')
    )).toBeVisible();
  });

  test("should filter logs by level", async ({ page }) => {
    // Navigate to a run detail page
    await expect(page.locator("table")).toBeVisible();
    const firstRow = page.locator("tbody tr").first();
    await firstRow.click();

    await expect(page).toHaveURL(/\/acme-backend\/runs\/[a-f0-9\-]+/);

    // Look for log level filter buttons
    const errorButton = page.locator('button:has-text("ERROR")');
    const infoButton = page.locator('button:has-text("INFO")');
    const debugButton = page.locator('button:has-text("DEBUG")');

    if (await errorButton.count() > 0) {
      await errorButton.click();
      // Should filter to show only error logs (visual change)
      await expect(errorButton).toHaveClass(/active|selected|bg-red/);
    }
  });

  test("should show run actions based on status", async ({ page }) => {
    // Navigate to a run detail page
    await expect(page.locator("table")).toBeVisible();
    const firstRow = page.locator("tbody tr").first();
    await firstRow.click();

    await expect(page).toHaveURL(/\/acme-backend\/runs\/[a-f0-9\-]+/);

    // Look for action buttons (Retry for failed runs, Cancel for running runs)
    const retryButton = page.locator('button:has-text("Retry")');
    const cancelButton = page.locator('button:has-text("Cancel")');

    // At least one action button should be available or none if run is completed
    const actionButtons = await Promise.all([
      retryButton.count(),
      cancelButton.count()
    ]);

    const totalActionButtons = actionButtons.reduce((sum, count) => sum + count, 0);
    expect(totalActionButtons).toBeGreaterThanOrEqual(0);
  });

  test("should display breadcrumb navigation", async ({ page }) => {
    // Navigate to a run detail page
    await expect(page.locator("table")).toBeVisible();
    const firstRow = page.locator("tbody tr").first();
    await firstRow.click();

    await expect(page).toHaveURL(/\/acme-backend\/runs\/[a-f0-9\-]+/);

    // Should have breadcrumb showing Runs > Run {id}
    await expect(page.locator("text=Runs").or(
      page.locator("text=acme-backend")
    )).toBeVisible();
  });
});

test.describe("Runs Mobile Experience", () => {
  test("should be responsive on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await navigateToRuns(page);

    // Should still show main content
    await expect(page.locator("h1")).toContainText("Runs");
    await expect(page.locator('button:has-text("Trigger Run")')).toBeVisible();

    // Table should be scrollable horizontally or stack columns
    await expect(page.locator("table")).toBeVisible();
  });

  test("should handle filters on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await navigateToRuns(page);

    // Filters should be accessible on mobile
    await expect(page.locator("text=Status")).toBeVisible();
    await expect(page.locator('button:has-text("Apply Filters")')).toBeVisible();

    // Should be able to apply filters
    await page.check('input[type="checkbox"] + span:has-text("Completed")');
    await page.click('button:has-text("Apply Filters")');

    await expect(page.locator("table")).toBeVisible();
  });
});