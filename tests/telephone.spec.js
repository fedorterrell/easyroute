const { test, expect } = require("./helpers");

for (const tab of ["#tabSheet", "#tabLabel", "#tabMsg"]) {
  test(`pas de défilement horizontal sur téléphone (${tab})`, async ({ page }) => {
    await page.click(tab);
    const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }));
    expect(scroll).toBeLessThanOrEqual(width);
  });
}
