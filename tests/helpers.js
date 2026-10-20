// Outils communs aux tests : page sans réseau extérieur, et quelques gestes sur le plan.
const path = require("path");
const { test: base, expect } = require("@playwright/test");

const QR_LIB = require.resolve("qrcode-generator/qrcode.js");

const test = base.extend({
  page: async ({ page }, use) => {
    // Pas d'appel aux services extérieurs pendant les tests : tuiles, géocodage, polices Google.
    await page.context().route(/arcgisonline|nominatim|photon|fonts\.(googleapis|gstatic)/, (r) => r.abort());
    // Bibliothèque QR servie en local (pas de dépendance au CDN)
    await page.context().route(/qrcode\.min\.js/, (r) => r.fulfill({ path: QR_LIB, contentType: "text/javascript" }));
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.locator("#url")).not.toBeEmpty();
    await use(page);
    expect(errors, "erreurs JavaScript dans la page").toEqual([]);
  },
});

const fixture = (name) => path.join(__dirname, "fixtures", name);

// Toucher le plan à une position relative (0..1)
async function tapSheet(page, fx, fy) {
  const box = await page.locator("#sheet").boundingBox();
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

async function placePoint(page, key, fx, fy) {
  await page.click(`#poiPlace-${key}`);
  await tapSheet(page, fx, fy);
  await expect(page.locator(`#poiPlace-${key}`)).toHaveText("Déplacer");
}

const message = (page) => page.locator("#msg").inputValue();

module.exports = { test, expect, fixture, tapSheet, placePoint, message };
