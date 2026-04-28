const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("API Running ✅");
});

app.get("/get-highlight", async (req, res) => {
  const { team1, team2, match } = req.query;

  if (!team1 || !team2 || !match) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const listingUrl = "https://www.crichighlightsvidz.com/p/ipl-2026-video-highlights.html";
  let browser;

  try {
    // ✅ NO HARDCODED PATH - Puppeteer will find it automatically
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
    await page.goto(listingUrl, { waitUntil: "networkidle2", timeout: 60000 });

    const content = await page.content();
    const regex = new RegExp(
      `https:\\/\\/www\\.crichighlightsvidz\\.com\\/2026\\/\\d+\\/[^"]*(${team1.toLowerCase()}|${team2.toLowerCase()})[^"]*${match}[^"]*highlights\\.html`,
      "gi"
    );

    const matches = content.match(regex);
    if (!matches || matches.length === 0) {
      await browser.close();
      return res.json({ error: "Highlight page not found" });
    }

    const highlightUrl = matches[0];
    let manifestUrl = null;

    page.on("response", (response) => {
      const url = response.url();
      if (url.includes("manifest.prod.boltdns.net/manifest/v1/hls")) {
        manifestUrl = url;
      }
    });

    await page.goto(highlightUrl, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 8000));
    await browser.close();

    if (!manifestUrl) {
      return res.json({ highlightPage: highlightUrl, error: "Manifest not captured" });
    }

    return res.json({ highlightPage: highlightUrl, manifest: manifestUrl });

  } catch (err) {
    if (browser) await browser.close();
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
