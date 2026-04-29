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

  // Hotstar Highlight Page Build
  // Format: /{team1}-vs-{team2}-highlights/{VIDEO_ID}/video/highlights/watch
  const videoIdBase = 1540066405; // Match 36 base ID
  const targetVideoId = videoIdBase + ((parseInt(match) - 36) * 3);
  
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

    // Open Hotstar page
    await page.goto(hotstarUrl, { waitUntil: "networkidle0", timeout: 60000 });
    
    // Wait for player & stream loading
    await new Promise(resolve => setTimeout(resolve, 12000));

    // ✅ EXTRACT CDN URL VIA PERFORMANCE API
    const cdnUrls = await page.evaluate(() => {
      return performance.getEntriesByType("resource")
        .map(r => r.name)
        .filter(u => u.includes("/videos/cricket/") && 
                    u.includes("media-1") && 
                    u.includes(".m3u8"));
    });

    await browser.close();

    if (!cdnUrls || cdnUrls.length === 0) {
      
      // Fallback: Try direct URL build with known pattern
      const fallbackUrl = `https://hssportsprepack.akamaized.net/videos/cricket/1271507153/${targetVideoId}/in/hin/v2/avc/1777153941704/hls/plain/media-1/index.m3u8`;
      
      return res.json({
        method: "fallback_pattern",
        highlightPage: hotstarUrl,
        manifest: fallbackUrl,
        note: "Performance API empty, using pattern fallback"
      });
    }

    // Get last media playlist (usually the actual content)
    const finalUrl = cdnUrls[cdnUrls.length - 1];

    return res.json({
      method: "performance_api",
      highlightPage: hotstarUrl,
      manifest: finalUrl,
      allFound: cdnUrls
    });

  } catch (err) {
    if (browser) await browser.close();
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
