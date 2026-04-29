const express = require("express");
const puppeteer = require("puppeteer-core");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("CDN Extractor Running ✅");
});

// ✅ Dynamically find Chrome path
function getChromePath() {
  const baseDir = "/opt/render/.cache/puppeteer/chrome";
  if (!fs.existsSync(baseDir)) {
    throw new Error("Chrome base directory not found");
  }

  const versions = fs.readdirSync(baseDir);
  if (!versions.length) {
    throw new Error("No Chrome versions found");
  }

  const chromePath = path.join(
    baseDir,
    versions[0],
    "chrome-linux64",
    "chrome"
  );

  if (!fs.existsSync(chromePath)) {
    throw new Error("Chrome executable not found");
  }

  return chromePath;
}

app.get("/get-highlight", async (req, res) => {
  const { team1, team2, match } = req.query;

  if (!team1 || !team2 || !match) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const videoIdBase = 1540066405;
  const matchNumber = parseInt(match);

  if (isNaN(matchNumber) || matchNumber < 36) {
    return res.status(400).json({ error: "Invalid match number" });
  }

  const targetVideoId = videoIdBase + ((matchNumber - 36) * 3);

  const hotstarUrl = `https://www.hotstar.com/in/sports/cricket/${team1.toLowerCase()}-vs-${team2.toLowerCase()}-highlights/${targetVideoId}/video/highlights/watch`;

  let browser;

  try {
    const chromeExecutablePath = getChromePath();

    browser = await puppeteer.launch({
      executablePath: chromeExecutablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    const page = await browser.newPage();

    await page.goto(hotstarUrl, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await page.waitForFunction(() => {
      return performance.getEntriesByType("resource")
        .some(r => r.name.includes("media-1/index.m3u8"));
    }, { timeout: 60000 });

    const cdnUrls = await page.evaluate(() => {
      return performance.getEntriesByType("resource")
        .map(r => r.name)
        .filter(u =>
          u.includes("/videos/cricket/") &&
          u.includes("media-1/index.m3u8")
        );
    });

    await browser.close();

    if (!cdnUrls.length) {
      return res.json({
        highlightPage: hotstarUrl,
        error: "CDN playlist not found"
      });
    }

    return res.json({
      highlightPage: hotstarUrl,
      manifest: cdnUrls[cdnUrls.length - 1]
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
