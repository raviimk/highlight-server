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
        "--disable-gpu",
        "--single-process",
        "--no-zygote"
      ]
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    );

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    // ✅ Smooth scroll
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

    // ✅ Wait for iframe to appear
    await new Promise(resolve => setTimeout(resolve, 5000));

    let manifestUrl = null;

    const frames = page.frames();

    for (const frame of frames) {
      try {
        const urls = await frame.evaluate(() => {
          return performance.getEntriesByType("resource")
            .map(r => r.name)
            .filter(u => u.includes("manifest.prod.boltdns.net"));
        });

        if (urls.length) {
          manifestUrl = urls[urls.length - 1];
          break;
        }
      } catch (e) {
        // ignore cross-origin frame errors
      }
    }

    await browser.close();

    if (!manifestUrl) {
      return res.json({
        page: url,
        error: "Manifest not detected (iframe issue)"
      });
    }

    return res.json({
      page: url,
      manifest: manifestUrl
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
