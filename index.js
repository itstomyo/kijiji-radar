const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------- SERVER --------------------
app.get("/", (req, res) => {
  res.send("Kijiji radar running");
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// -------------------- CONFIG --------------------
const KEYWORDS = [
  "powerblock",
  "power block",
  "adjustable dumbbell",
  "kitchenaid",
  "kitchen aid",
  "stand mixer"
];

const URL =
  "https://www.kijiji.ca/b-buy-sell/oakville-halton-region/dumbbells/k0c10l1700277?address=1119%20Privet%20Pl%2C%20Oakville%2C%20ON%2C%20Canada&ll=43.499163%2C-79.652515&radius=13.0&view=list";

// -------------------- MEMORY --------------------
const seen = new Set();
const MAX_SEEN = 200;

// -------------------- HELPERS --------------------
function matchesKeywords(text = "") {
  const lower = text.toLowerCase();
  return KEYWORDS.some((k) => lower.includes(k));
}

function isNew(listing) {
  if (seen.has(listing.link)) return false;

  seen.add(listing.link);

  if (seen.size > MAX_SEEN) {
    const first = seen.values().next().value;
    seen.delete(first);
  }

  return true;
}

// -------------------- SCRAPER --------------------
async function fetchListings() {
  try {
    const { data } = await axios.get(URL, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "en-CA,en;q=0.9"
      }
    });

    const jsonMatch = data.match(
      /<script type="application\/ld\+json">(.*?)<\/script>/s
    );

    if (!jsonMatch) {
      console.log("❌ No structured data found");
      return [];
    }

    const json = JSON.parse(jsonMatch[1]);
    const items = json?.itemListElement || [];

    console.log(`RAW ITEMS FOUND: ${items.length}`);

    const listings = [];

    for (const item of items) {
      const product = item?.item;
      if (!product) continue;

      const listing = {
        title: product.name,
        price: product.offers?.price
          ? `$${product.offers.price}`
          : "N/A",
        link: product.url
      };

      if (matchesKeywords(listing.title) && isNew(listing)) {
        listings.push(listing);
      }
    }

    return listings;
  } catch (err) {
    console.error("❌ Scraper error:", err.message);
    return [];
  }
}

// -------------------- RUN --------------------
async function run() {
  console.log(`\n[${new Date().toISOString()}] 🔎 Checking Kijiji...\n`);

  const listings = await fetchListings();

  if (listings.length === 0) {
    console.log("No new matches right now.");
    return;
  }

  console.log(`🔥 FOUND ${listings.length} MATCH(ES):\n`);

  listings.forEach((item, i) => {
    console.log(`${i + 1}. ${item.title}`);
    console.log(`   💰 ${item.price}`);
    console.log(`   🔗 ${item.link}\n`);
  });
}

// -------------------- LOOP --------------------
async function loop() {
  console.log("🚀 LOOP STARTED");

  try {
    await run();
  } catch (err) {
    console.error("Loop error:", err.message);
  }

  setTimeout(loop, 5 * 60 * 1000);
}

// -------------------- START --------------------
setTimeout(() => {
  loop();
}, 3000);