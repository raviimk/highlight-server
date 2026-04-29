const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("CDN Extractor Running ✅");
});

app.get("/get-highlight", async (req, res) => {
  const { team1, team2, match } = req.query;

  if (!team1 || !team2 || !match) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  // ✅ Base Video ID logic (Match 36 = base)
  const videoIdBase = 1540066405;
  const matchNumber = parseInt(match);

  if (isNaN(matchNumber) || matchNumber < 36) {
    return res.status(400).json({ error: "Invalid match number" });
  }

  const targetVideoId = videoIdBase + ((matchNumber - 36) * 3);

  const hotstarUrl = `https://www.hotstar.com/in/sports/cricket/${team1.toLowerCase()}-vs-${team2.toLowerCase()}-highlights/${targetVideoId}/video/highlights/watch`;

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    const page = await browser.newPage();

    // ✅ Open page
    await page.goto(hotstarUrl, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // ✅ Wait until actual highlight stream loads (auto skip ad)
    await page.waitForFunction(() => {
      return performance.getEntriesByType("resource")
        .some(r => r.name.includes("media-1/index.m3u8"));
    }, { timeout: 60000 });

    // ✅ Extract CDN media playlist
    const cdnUrls = await page.evaluate(() => {
      return performance.getEntriesByType("resource")
        .map(r => r.name)
        .filter(u =>
          u.includes("/videos/cricket/") &&
          u.includes("media-1/index.m3u8")
        );
    });

    await browser.close();

    if (!cdnUrls || cdnUrls.length === 0) {
      return res.json({
        highlightPage: hotstarUrl,
        error: "CDN playlist not found"
      });
    }

    const finalUrl = cdnUrls[cdnUrls.length - 1];

    return res.json({
      highlightPage: hotstarUrl,
      manifest: finalUrl
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
