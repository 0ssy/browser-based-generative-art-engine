import { test, expect } from '@playwright/test';

test('test generative art engine', async ({ page }) => {
  await page.goto('http://localhost:8080');
  await page.waitForLoadState('networkidle');

  // Wait for the seed control to be present
  await page.waitForFunction(() => {
    const seedControl = document.getElementById('control-seed');
    return seedControl !== null;
  });

  // Check initial state: FPS and seed value
  const fpsElement = await page.$('#fps');
  const seedControl = await page.$('#control-seed');
  expect(fpsElement).toBeTruthy();
  expect(seedControl).toBeTruthy();

  const fpsValue = await fpsElement.textContent();
  const seedValue = await seedControl.inputValue();
  console.log(`Initial FPS: ${fpsValue}`);
  console.log(`Initial Seed: ${seedValue}`);

  // Wait for FPS to update from 0 (indicating engine is running)
  await page.waitForFunction(() => {
    const fps = document.getElementById('fps');
    return fps && !fps.textContent.startsWith('FPS: 0');
  });

  // Click "New variation" button
  await page.click('#new-variation-btn');

  // Wait for the status to show "New variation"
  await page.waitForFunction(() => {
    const status = document.getElementById('status');
    return status && status.textContent === 'New variation';
  });

  // Now click export and capture the download to get the new seed
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#export-png-btn')
  ]);
  const filename = download.suggestedFilename();
  console.log(`Download filename: ${filename}`);
  // Extract seed from filename: flow-field-<seed>.png
  const seedMatch = filename.match(/flow-field-(\d+)\.png/);
  let newSeedValue = '';
  if (seedMatch) {
    newSeedValue = seedMatch[1];
    console.log(`New Seed from download: ${newSeedValue}`);
  } else {
    throw new Error('Could not extract seed from download filename');
  }
  expect(newSeedValue).not.toBe(seedValue);
  expect(newSeedValue.length > 0).toBeTruthy();

  // Change "Noise Scale" slider to a different value
  // Find the noise scale slider (input type=range with id="control-noiseScale")
  const noiseScaleSlider = await page.$('#control-noiseScale');
  expect(noiseScaleSlider).toBeTruthy();

  // Get current value
  const currentNoiseScale = await noiseScaleSlider.inputValue();
  console.log(`Current Noise Scale: ${currentNoiseScale}`);

  // Set to a different value (e.g., if current is 0.25, set to 0.5)
  const newNoiseScale = parseFloat(currentNoiseScale) === 0.25 ? 0.5 : 0.25;
  await noiseScaleSlider.fill(newNoiseScale.toString());
  // Trigger input event to update the value display
  await noiseScaleSlider.dispatchEvent('input', { bubbles: true });
  // Wait a bit for the update
  await page.waitForTimeout(500);

  // Verify the value display changed
  const noiseScaleValueDisplay = await page.$('#value-noiseScale');
  if (noiseScaleValueDisplay) {
    const displayedValue = await noiseScaleValueDisplay.textContent();
    console.log(`Noise Scale Display: ${displayedValue}`);
    expect(displayedValue).toBe(newNoiseScale.toString());
  }

  // Click "Pause" button
  await page.click('#pause-btn');

  // Verify animation pauses: status should show "Paused"
  await page.waitForFunction(() => {
    const status = document.getElementById('status');
    return status && status.textContent === 'Paused';
  });

  const pausedStatus = await page.$eval('#status', el => el.textContent);
  console.log(`Status after pause: ${pausedStatus}`);
  expect(pausedStatus).toBe('Paused');

  // Take a screenshot
  await page.screenshot({ path: 'screenshot.png' });

  await page.close();
});