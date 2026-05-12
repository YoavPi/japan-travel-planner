/* eslint-disable */
/* Generate CONTENT_AUDIT.md by scanning src/data/tripData.js.
   No imports of the JS module — we parse the source text by hand. */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src", "data", "tripData.js");
const OUT = path.join(__dirname, "..", "CONTENT_AUDIT.md");

const src = fs.readFileSync(SRC, "utf8");

const categoryFor = (text) => {
  const t = text.toLowerCase();
  if (/onsen|אונסן/.test(t))                                      return "אונסן";
  if (/ramen|ראמן/.test(t))                                       return "ראמן";
  if (/sushi|סושי/.test(t))                                       return "סושי";
  if (/cafe|café|coffee|starbucks|bricolage|anakuma|stumptown|בית קפה|קפה/.test(t)) return "בית קפה";
  if (/shrine|temple|inari|pagoda|todai|מקדש|פגוד/.test(t))       return "מקדש";
  if (/castle|טירה/.test(t))                                      return "טירה";
  if (/park|garden|gyoen|פארק|גן /.test(t))                       return "פארק/גן";
  if (/market|don quijote|parco|muji|outlet|uniqlo|kappabashi|shopping|ameyoko|sunshine city|radio kaikan|store|חנות|שוק|קניות/.test(t)) return "קניות";
  if (/bar|izakaya|golden gai|באר|אזקאיה/.test(t))                return "בר";
  if (/view|crossing|teamlab|sky deck|observation|tower|תצפית|מגדל/.test(t)) return "תצפית";
  if (/disney|universal|jurassic|harry|nintendo|mario|jaws|spider|flying dinosaur/.test(t)) return "פארק שעשועים";
  if (/gyoza|yakitori|katsu|yakiniku|food|burger|pizza|udon|soba|pancake|המבורגר|מסעדה|food tour/.test(t)) return "מסעדה";
  if (/hotel|מלון/.test(t))                                       return "מלון";
  if (/shinkansen|train|bus|car|taxi|רכבת|אוטובוס|רכב/.test(t))   return "תחבורה";
  if (/karaoke|קריוקי/.test(t))                                   return "בילוי";
  if (/aquarium|אקווריום/.test(t))                                return "אקווריום";
  if (/museum|מוזיאון/.test(t))                                   return "מוזיאון";
  return "מיקום";
};

const extractRating = (desc) => {
  if (!desc) return "";
  /* "ציון: 9/10" or "ציון: 9.5/10" → "9/10" / "9.5/10" */
  const m = desc.match(/ציון[:：]?\s*([\d.]+\s*\/\s*10\b)/);
  if (m) return m[1].replace(/\s+/g, "");
  /* fallback: a bare "ציון: 9" without denominator */
  const m2 = desc.match(/ציון[:：]?\s*([\d.]+)/);
  return m2 ? m2[1] : "";
};

const stripRating = (desc) => {
  if (!desc) return "";
  return desc
    .replace(/[.\s]*ציון[:：]?\s*[\d.]+\s*\/\s*10\b[.\s]*$/u, "")
    .replace(/[.\s]*ציון[:：]?\s*[\d.]+[.\s]*$/u, "")
    .trim();
};

/* tripData = [ { day: N, ... attractions: [ {…}, {…} ], lunch: {…}, dinner: {…}, hotel: "…" }, … ] */
const dayChunks = src.split(/\n  \{\n    day:\s*(\d+),/);
/* dayChunks layout: [preamble, "1", block1, "2", block2, ...] */
const rows = [];

for (let i = 1; i < dayChunks.length; i += 2) {
  const dayNum = parseInt(dayChunks[i], 10);
  const block = dayChunks[i + 1] || "";

  /* Find every {...} item that has a `name:` or `place:` field.
     We do a brace-counting walk so nested coordinate blocks don't
     break us. */
  const items = [];
  let depth = 0, start = -1;
  for (let p = 0; p < block.length; p++) {
    const ch = block[p];
    if (ch === "{") {
      if (depth === 0) start = p;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        items.push(block.slice(start, p + 1));
        start = -1;
      }
    }
  }

  /* Filter: keep items that look like a location (have name or place) */
  const seen = new Set();
  items.forEach((raw) => {
    const nm  = raw.match(/(?:^|[\s,{])name:\s*"([^"]+)"/);
    const pl  = raw.match(/(?:^|[\s,{])place:\s*"([^"]+)"/);
    const heM = raw.match(/nameHe:\s*"([^"]*)"/);
    const dM  = raw.match(/desc:\s*"([^"]*)"/);
    const rM  = raw.match(/rating:\s*"([^"]*)"/);
    if (!nm && !pl) return; // skip coordinate-only objects, expenses, etc.

    const name = (nm && nm[1]) || (pl && pl[1]) || "";
    if (!name || name === "—") return;
    const dedupKey = `${dayNum}::${name.toLowerCase()}`;
    if (seen.has(dedupKey)) return;
    seen.add(dedupKey);

    const nameHe = heM ? heM[1] : "";
    const desc   = dM  ? dM[1]  : "";
    const explicitRating = rM ? rM[1] : "";

    rows.push({
      day: dayNum,
      name,
      nameHe,
      category: categoryFor(`${name} ${nameHe} ${desc}`),
      note: stripRating(desc),
      rating: explicitRating || extractRating(desc) || "—",
    });
  });

  /* Also capture the hotel of the day as a row */
  const hotelMatch = block.match(/hotel:\s*"([^"]+)"/);
  if (hotelMatch && hotelMatch[1] !== "—") {
    const hname = hotelMatch[1];
    const dedupKey = `${dayNum}::${hname.toLowerCase()}`;
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      rows.push({
        day: dayNum,
        name: hname,
        nameHe: hname,
        category: "מלון",
        note: "",
        rating: "—",
      });
    }
  }
}

const today = new Date().toISOString().slice(0, 10);

let md = "# Content Audit — Japan Trip\n\n";
md += "_Auto-generated from `src/data/tripData.js`. Lists every named location across the 31 days, including all attractions, meals, and hotels._\n\n";
md += "_Run `node scripts/build-audit.js` to regenerate after editing the source._\n\n";
md += `_Total entries: **${rows.length}** across ${dayChunks.length === 1 ? 0 : (dayChunks.length - 1) / 2} days._\n\n`;
md += "| יום | שם המקום | קטגוריה | תיאור / הערות אישיות | דירוג |\n";
md += "|---:|---|---|---|---:|\n";

rows.forEach((r) => {
  const nameCol = r.nameHe ? `${r.nameHe} · _${r.name}_` : r.name;
  const note = (r.note || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  md += `| ${r.day} | ${nameCol} | ${r.category} | ${note} | ${r.rating} |\n`;
});

md += `\n---\n\n_Generated ${today}_\n`;

fs.writeFileSync(OUT, md);
console.log(`Wrote CONTENT_AUDIT.md  (${rows.length} entries)`);
