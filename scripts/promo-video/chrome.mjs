// Headless Chrome for the promo tools. Playwright is deliberately not a project
// dependency: install it without saving (`npm install --no-save playwright-core`)
// or point PLAYWRIGHT_MODULE at a copy you already have. It drives the installed
// Google Chrome, whose GPU path the WebGL scene needs.
const playwright = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright-core'
).catch((error) => {
  throw new Error(
    'Playwright is not installed. Run `npm install --no-save playwright-core` ' +
      'or set PLAYWRIGHT_MODULE to an existing Playwright entry point.',
    { cause: error },
  );
});

export function launchChrome() {
  return playwright.chromium.launch({
    channel: 'chrome',
    headless: true,
    args: [
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--hide-scrollbars',
      ...(process.platform === 'darwin' ? ['--use-angle=metal'] : []),
    ],
  });
}
