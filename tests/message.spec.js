const { test, expect, placePoint, message } = require("./helpers");

async function fillInfos(page) {
  await page.fill("#eventName", "Concert Test");
  await page.fill("#callDate", "2026-10-24");
  await page.fill("#callTime", "08:30");
  await page.fill("#contactName", "Julien");
  await page.fill("#contactPhone", "06 12 34 56 78");
  await page.fill("#accessCode", "1234A, portail; nord");
}

test("infos pratiques et événement dans le message et l’objet de l’e-mail", async ({ page }) => {
  await fillInfos(page);
  await page.click("#tabMsg");
  const msg = await message(page);
  expect(msg.split("\n")[0]).toBe("🎫 Concert Test");
  expect(msg).toContain("🕒 Get-In : samedi 24 octobre à 8h30");
  expect(msg).toContain("👤 Contact sur place : Julien — 06 12 34 56 78");
  const href = await page.getAttribute("#msgMail", "href");
  expect(decodeURIComponent(href.split("subject=")[1].split("&")[0]))
    .toBe("Concert Test — Espace Culturel du Bois-Des-Arts — samedi 24 octobre à 8h30");
});

test("liens d’itinéraire choisis point par point", async ({ page }) => {
  await placePoint(page, "dock", 0.3, 0.3);
  await page.click("#tabMsg");
  let msg = await message(page);
  expect(msg).toContain("🚚 Accès technique / déchargement :");
  await page.uncheck("#lk-main-a");
  await page.uncheck("#lk-dock-g");
  await page.uncheck("#lk-dock-w");
  msg = await message(page);
  expect(msg).not.toContain("Plans (Apple)");
  expect(msg).not.toContain("🚚");
  expect(msg).toContain("Google Maps :\nhttps://www.google.com/maps/search/?api=1&query=46.18");
});

test("agenda : lien Google Agenda et fichier .ics à l’heure de Paris", async ({ page }) => {
  await page.click("#tabMsg");
  await expect(page.locator("#msgIcs")).toBeDisabled();
  await fillInfos(page);
  await page.selectOption("#callDur", "6");
  const msg = await message(page);
  expect(msg).toContain("📅 Ajouter à Google Agenda :");
  expect(msg).toContain("dates=20261024T063000Z/20261024T123000Z");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#msgIcs")]);
  const ics = Buffer.concat(await (await download.createReadStream()).toArray()).toString();
  expect(ics).toContain("DTSTART:20261024T063000Z");
  expect(ics).toContain("DTEND:20261024T123000Z");
  expect(ics).toContain("SUMMARY:Get-In — Concert Test");
  expect(ics).toContain("TRIGGER:-PT1H");
  for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  // Sans heure : journée entière
  await page.fill("#callTime", "");
  await page.dispatchEvent("#callTime", "change");
  await expect(page.locator("#calHint")).toContainText("journée entière");
  await page.uncheck("#lkCal");
  expect(await message(page)).not.toContain("Google Agenda");
});

test("le bouton WhatsApp transmet le message avec ses emojis, encodés en UTF-8", async ({ page }) => {
  await page.fill("#eventName", "Concert Test");
  await page.click("#tabMsg");
  const href = await page.getAttribute("#msgWa", "href");
  expect(href.startsWith("https://api.whatsapp.com/send?text=")).toBe(true);
  expect(decodeURIComponent(href.split("text=")[1])).toBe(await message(page));
  expect(href).toContain("%F0%9F%8E%AB"); // 🎫 encodé sur 4 octets
});
