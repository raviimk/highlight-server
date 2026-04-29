const express = require("express");
const puppeteer = require("puppeteer-core");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("Brightcove Manifest Extractor Running ✅");
});

app.get("/get-highlight", async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing page URL" });
  }

  let browser;

  try {
    browser = await puppeteer.launch({
      executablePath: "/usr/bin/chromium-browser",
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    const page = await browser.newPage();

    // ✅ Set real browser user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    );

    // ✅ Open highlight page
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    // ✅ Smooth scroll to trigger lazy load
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 200);
      });
    });

    // ✅ Wait until Brightcove manifest appears
    await page.waitForFunction(() =>
      performance.getEntriesByType("resource")
        .some(r => r.name.includes("manifest.prod.boltdns.net")),
      { timeout: 20000 }
    );

    // ✅ Extract manifest URLs
    const manifestUrls = await page.evaluate(() => {
      return performance.getEntriesByType("resource")
        .map(r => r.name)
        .filter(u => u.includes("manifest.prod.boltdns.net"));
    });

    await browser.close();

    if (!manifestUrls.length) {
      return res.json({
        page: url,
        error: "Manifest not detected"
      });
    }

    return res.json({
      page: url,
      manifest: manifestUrls[manifestUrls.length - 1]
    });

  } catch (err) {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }

    return res.status(500).json({
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
