const { test, expect, placePoint, message } = require("./helpers");

async function ficheLink(page) {
  await page.click("#tabMsg");
  await expect(page.locator("#ficheOpen")).toHaveAttribute("href", /#f=2/);
  return page.getAttribute("#ficheOpen", "href");
}

test("le lien de fiche figure dans le message et ouvre la fiche en lecture seule", async ({ page, context }) => {
  await page.fill("#eventName", "Concert Test");
  await page.fill("#callDate", "2026-10-24");
  await page.fill("#callTime", "08:30");
  await page.fill("#contactName", "Julien");
  await page.fill("#contactPhone", "06 12 34 56 78");
  await page.fill("#poiLabel-loges", "Loges — porte B");
  await placePoint(page, "loges", 0.6, 0.6);
  const url = await ficheLink(page);
  expect(url.length).toBeLessThan(450);
  expect(await message(page)).toContain("🔗 Fiche complète (plan, accès, itinéraires) :\n" + url);

  // Un équipier ouvre le lien sur son propre téléphone (autre navigateur, rien d'enregistré)
  const team = await context.browser().newPage();
  await team.context().route(/arcgisonline|nominatim|photon|fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await team.context().route(/qrcode\.min\.js/, (r) => r.fulfill({ path: require.resolve("qrcode-generator/qrcode.js"), contentType: "text/javascript" }));
  await team.goto(url.replace(/^https?:\/\/[^/]+\/(easyroute\/)?/, "/"));
  await expect(team.locator("#ficheView")).toBeVisible();
  await expect(team.locator(".wrap > .grid")).toBeHidden();
  await expect(team.locator("#fTitle")).toHaveText("Concert Test");
  await expect(team.locator("#fPlace")).toHaveText("Espace Culturel du Bois-Des-Arts");
  await expect(team.locator("#fInfos")).toContainText("samedi 24 octobre à 8h30");
  await expect(team.locator('#fInfos a[href^="tel:"]')).toHaveAttribute("href", "tel:0612345678");
  await expect(team.locator("#fRoutes .froute")).toHaveCount(2);
  await expect(team.locator("#fRoutes .froute").nth(1)).toContainText("Loges — porte B");
  await expect(team.locator("#fRoutes a", { hasText: "Waze" }).first()).toHaveAttribute("href", /^https:\/\/waze\.com\/ul\?ll=46\.18/);
  await expect(team.locator("#fCal a")).toHaveAttribute("href", /calendar\.google\.com/);
  await expect(team.locator("#fSheetSlot #sheet")).toBeVisible();
  // La fiche n'écrase pas la session de l'appareil
  expect(await team.evaluate(() => localStorage.getItem("easyroute.session"))).toBeNull();
  // Ouvrir dans l'éditeur (confirmation en deux touches)
  await team.click("#fEdit"); await team.click("#fEdit");
  await expect(team.locator("#ficheView")).toBeHidden();
  await expect(team.locator("#name")).toHaveValue("Espace Culturel du Bois-Des-Arts");
  await expect(team.locator("#contactName")).toHaveValue("Julien");
  await expect(team.locator("#poiLabel-loges")).toHaveValue("Loges — porte B");
  expect(await team.evaluate(() => location.hash)).toBe("");
  await team.close();
});

test("un lien de fiche abîmé affiche un message et l’éditeur normal", async ({ page }) => {
  await page.goto("/#f=2abc"); // même onglet : la page se recharge d'elle-même
  await expect(page.locator("#status")).toHaveText(/lien de fiche est incomplet/);
  await expect(page.locator("#ficheView")).toBeHidden();
});

test("on peut retirer le lien de fiche du message", async ({ page }) => {
  await ficheLink(page);
  await page.uncheck("#lkFiche");
  expect(await message(page)).not.toContain("Fiche complète");
});

test("les anciens liens de fiche (format 1) s’ouvrent toujours", async ({ page }) => {
  const zlib = require("zlib");
  const v1 = { v: 1, fields: { name: "Ancienne fiche", addr: "1 rue du Test, 73000 Chambéry", contactName: "Marie", infoOnSheet: true },
    app: "google", layout: "side", place: { lat: 45.5666, lng: 5.9212 }, center: { lat: 45.5666, lng: 5.9212 }, zoom: 18,
    pois: { loges: { lat: 45.567, lng: 5.922 } }, poiLabels: { loges: "Loges A" }, poiColors: {}, arrows: [] };
  const packed = "1" + zlib.deflateRawSync(Buffer.from(JSON.stringify(v1))).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await page.goto("/#fiche=" + packed);
  await expect(page.locator("#ficheView")).toBeVisible();
  await expect(page.locator("#fTitle")).toHaveText("Ancienne fiche");
  await expect(page.locator("#fRoutes .froute").nth(1)).toContainText("Loges A");
});

test("aller-retour du format compact : flèches, couleurs, libellés, réglages", async ({ page, context }) => {
  await page.click('#appSeg [data-v="waze"]');
  await page.click('#layout [data-v="stack"]');
  await page.locator("#poiColor-dock").fill("#123456");
  await page.fill("#poiLabel-dock", "Quai B");
  await placePoint(page, "dock", 0.3, 0.3);
  await page.click('#toolSeg [data-v="arrow"]');
  await page.locator("#sheet").scrollIntoViewIfNeeded();
  const box = await page.locator("#sheet").boundingBox();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width * (0.2 + i * 0.02), box.y + box.height * (0.5 - i * 0.02));
  await page.mouse.up();
  await expect(page.locator("#undo")).toBeEnabled();
  const url = await ficheLink(page);
  const team = await context.browser().newPage();
  await team.context().route(/arcgisonline|nominatim|photon|fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await team.context().route(/qrcode\.min\.js/, (r) => r.fulfill({ path: require.resolve("qrcode-generator/qrcode.js"), contentType: "text/javascript" }));
  await team.goto(url.replace(/^https?:\/\/[^/]+\/(easyroute\/)?/, "/"));
  await expect(team.locator("#fRoutes .froute").nth(1)).toContainText("Quai B");
  await team.click("#fEdit"); await team.click("#fEdit");
  await expect(team.locator('#appSeg [data-v="waze"]')).toHaveAttribute("aria-pressed", "true");
  await expect(team.locator('#layout [data-v="stack"]')).toHaveAttribute("aria-pressed", "true");
  await expect(team.locator("#poiColor-dock")).toHaveValue("#123456");
  await expect(team.locator("#undo")).toBeEnabled(); // la flèche est revenue
  const [a, b] = await Promise.all([page.inputValue("#coords"), team.inputValue("#coords")]);
  expect(b.split(",").map((v) => (+v).toFixed(5))).toEqual(a.split(",").map((v) => (+v).toFixed(5)));
  await team.close();
});
