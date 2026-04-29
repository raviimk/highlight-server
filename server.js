const express = require("express");
const puppeteer = require("puppeteer-core");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("Brightcove Extractor Running ✅");
});

app.get("/get-highlight", async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing page URL" });
  }

  let browser;

  try {
    browser = await puppeteer.launch({
      executablePath: "/usr/bin/chromium",
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    // ✅ Scroll to bottom (trigger lazy load)
    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    // ✅ Wait few seconds for player load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // ✅ Extract Brightcove manifest
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
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
