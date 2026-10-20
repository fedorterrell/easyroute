const { test, expect } = require("./helpers");

test("la page s’ouvre avec le lieu d’exemple et un lien Google Maps", async ({ page }) => {
  await expect(page).toHaveTitle("Easy Route !");
  await expect(page.locator("#url")).toContainText("https://www.google.com/maps/search/?api=1&query=");
  await expect(page.locator("#coords")).toHaveValue(/46\.18/);
});

test("le QR peut ouvrir Waze, sur le repère du lieu", async ({ page }) => {
  await page.click('#appSeg [data-v="waze"]');
  await expect(page.locator("#url")).toHaveText(/^https:\/\/waze\.com\/ul\?ll=46\.18\d+,6\.19\d+&navigate=yes$/);
});

test("un lien Google Maps complet place le lieu sur la carte", async ({ page }) => {
  await page.fill("#custom", "https://www.google.com/maps/place/X/@45.1,5.1,17z/data=!3m1!4b1!4m6!3m5!8m2!3d45.5666!4d5.9212");
  await page.locator("#custom").blur();
  await expect(page.locator("#coords")).toHaveValue("45.5666000, 5.9212000");
  await expect(page.locator("#url")).toHaveText(/^https:\/\/www\.google\.com\/maps\/place\//);
});
