const { test, expect, fixture, tapSheet, placePoint, message } = require("./helpers");

test("points utiles : placer, déplacer, retirer", async ({ page }) => {
  await placePoint(page, "dock", 0.3, 0.3);
  await placePoint(page, "loges", 0.6, 0.6);
  await expect(page.locator("#poiClear-dock")).toBeEnabled();
  await page.click("#poiClear-dock");
  await expect(page.locator("#poiPlace-dock")).toHaveText("Placer");
  await page.click("#tabMsg");
  const msg = await message(page);
  expect(msg).toContain("Loges :");
  expect(msg).not.toContain("Accès technique");
});

test("couleurs des points : choix, puis retour aux couleurs par défaut", async ({ page }) => {
  await expect(page.locator("#poiColor-loges")).toHaveValue("#f4b400");
  await expect(page.locator("#poiColorsReset")).toBeDisabled();
  await page.locator("#poiColor-dock").fill("#000000");
  await expect(page.locator("#poiColorsReset")).toBeEnabled();
  await page.click("#poiColorsReset");
  await expect(page.locator("#poiColor-dock")).toHaveValue("#1a73e8");
});

test("le repère rouge se déplace en le faisant glisser, et les liens suivent", async ({ page }) => {
  await page.click('#appSeg [data-v="waze"]');
  const before = await page.inputValue("#coords");
  const box = await page.locator("#sheet").boundingBox();
  const x = box.x + box.width / 2, headY = box.y + box.height / 2 - box.width * (9 * 0.64 / 297);
  await page.mouse.move(x, headY);
  await page.mouse.down();
  await page.mouse.move(x + 60, headY + 40, { steps: 6 });
  await page.mouse.up();
  const after = await page.inputValue("#coords");
  expect(after).not.toBe(before);
  const [lat, lng] = after.split(",").map((v) => (+v).toFixed(6));
  await expect(page.locator("#url")).toHaveText(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`);
});

test("« Déplacer le repère » puis un toucher place le lieu", async ({ page }) => {
  const before = await page.inputValue("#coords");
  await page.click("#movePin");
  await expect(page.locator("#movePin")).toHaveText("Touchez le plan…");
  await tapSheet(page, 0.3, 0.4);
  await expect(page.locator("#movePin")).toHaveText("Déplacer le repère");
  expect(await page.inputValue("#coords")).not.toBe(before);
});

test("le plan A4 se télécharge en JPG", async ({ page }) => {
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#sheetJpg")]);
  expect(download.suggestedFilename()).toMatch(/^plan-.+\.jpg$/);
});

test("logo : sur le plan, et en option sur l’étiquette", async ({ page }) => {
  await page.click("#tabLabel");
  await expect(page.locator("#logoOnLabel")).toBeDisabled();
  await page.setInputFiles("#logoFile", fixture("logo-marges.png"));
  await expect(page.locator("#status")).toHaveText(/Logo ajouté/);
  const h0 = await page.locator("#out").evaluate((img) => img.naturalHeight);
  await page.click('#layout [data-v="stack"]');
  await page.check("#logoOnLabel");
  await expect.poll(() => page.locator("#out").evaluate((img) => img.naturalHeight)).toBeGreaterThan(h0);
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#dlSvg")]);
  const svg = await (await download.createReadStream()).toArray().then((b) => Buffer.concat(b).toString());
  expect(svg).toContain("<image ");
});

test("logo SVG accepté", async ({ page }) => {
  await page.setInputFiles("#logoFile", fixture("logo.svg"));
  await expect(page.locator("#status")).toHaveText(/Logo ajouté/);
  await expect(page.locator("#logoClear")).toBeEnabled();
});

test("police : Barlow par défaut", async ({ page }) => {
  await expect(page.locator("#fontState")).toHaveText("Police par défaut : Barlow.");
  await expect(page.locator("#fontReset")).toBeHidden();
});
