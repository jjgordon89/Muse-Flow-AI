import { test, expect } from '@playwright/test';

test.describe('AI Fiction Writer App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the main application', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('AI Fiction Writer');
    await expect(page.locator('[data-testid="word-processor"]')).toBeVisible();
  });

  test('should navigate between sidebar tabs', async ({ page }) => {
    // Click on Characters tab
    await page.click('button:has-text("Characters")');
    await expect(page.locator('h3:has-text("Characters")')).toBeVisible();

    // Click on Story Arcs tab
    await page.click('button:has-text("Story Arcs")');
    await expect(page.locator('h3:has-text("Story Arcs")')).toBeVisible();

    // Click back to Overview
    await page.click('button:has-text("Overview")');
    await expect(page.locator('h3:has-text("Project Overview")')).toBeVisible();
  });

  test('should create a new character', async ({ page }) => {
    // Navigate to Characters
    await page.click('button:has-text("Characters")');
    
    // Click Add button
    await page.click('button:has-text("Add")');
    
    // Fill character form
    await page.fill('input[placeholder="Enter character name..."]', 'Test Character');
    await page.selectOption('select', 'protagonist');
    await page.fill('textarea[placeholder="Physical appearance, personality overview..."]', 'A brave protagonist');
    
    // Save character
    await page.click('button:has-text("Save Character")');
    
    // Verify character appears in list
    await expect(page.locator('text=Test Character')).toBeVisible();
  });

  test('should update project information', async ({ page }) => {
    // Should start on Overview tab
    await expect(page.locator('h3:has-text("Project Overview")')).toBeVisible();
    
    // Update project title
    await page.fill('input[value="Untitled Novel"]', 'My Great Novel');
    
    // Update genre
    await page.fill('input[placeholder="e.g., Fantasy, Romance, Mystery..."]', 'Fantasy');
    
    // Update description
    await page.fill('textarea[placeholder="Brief description of your story..."]', 'An epic fantasy adventure');
    
    // Verify changes are reflected
    await expect(page.locator('input[value="My Great Novel"]')).toBeVisible();
  });

  test('should collapse and expand sidebar', async ({ page }) => {
    // Sidebar should be visible initially
    await expect(page.locator('text=Writing Tools')).toBeVisible();
    
    // Click toggle button
    await page.click('button:has-text("Writing Tools")');
    
    // Sidebar should be collapsed
    await expect(page.locator('text=Writing Tools')).not.toBeVisible();
    
    // Click toggle again
    await page.click('button[aria-label="Toggle sidebar"]'); // You may need to add aria-label
    
    // Sidebar should be visible again
    await expect(page.locator('text=Writing Tools')).toBeVisible();
  });

  test('should open and close settings modal', async ({ page }) => {
    // Click settings button
    await page.click('button[aria-label="Settings"]'); // You may need to add aria-label
    
    // Modal should be visible
    await expect(page.locator('text=AI Provider Settings')).toBeVisible();
    
    // Close modal
    await page.click('button:has-text("Cancel")');
    
    // Modal should be closed
    await expect(page.locator('text=AI Provider Settings')).not.toBeVisible();
  });

  test('should save project', async ({ page }) => {
    // Click save button
    await page.click('button:has-text("Save")');
    
    // Should show saving state briefly
    await expect(page.locator('text=Saving...')).toBeVisible();
    
    // Should return to normal state
    await expect(page.locator('button:has-text("Save")')).toBeVisible();
  });

  test('should handle word processor input', async ({ page }) => {
    // Find the word processor textarea
    const textarea = page.locator('textarea[placeholder*="Begin your story"]');
    
    // Type some content
    await textarea.fill('Once upon a time, in a land far away...');
    
    // Verify content is there
    await expect(textarea).toHaveValue('Once upon a time, in a land far away...');
    
    // Check that word count updates
    await expect(page.locator('text=/\\d+ words/')).toBeVisible();
  });
});