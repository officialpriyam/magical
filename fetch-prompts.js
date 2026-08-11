// fetch-prompts.js
// Run: node fetch-prompts.js
// Requires: npm install node-fetch (or use Node 18+ built-in fetch)

const fs = require('fs');
const path = require('path');

const SLUGS = [
  "self-storage","bowling-alley","bookstore","car-dealership","property-management",
  "music-venue","social-media-agency","solar-company","personal-stylist","craft-brewery",
  "tattoo-parlor","photography-studio","real-estate-agent","coffee-shop-dark","car-wash",
  "podcast","music-school","chiropractor","boutique-hotel","moving-company",
  "makeup-artist","hair-salon","gym","accountant-website-prompt","yoga-studio-website-prompt",
  "music-producer-website-prompt","lawyer-website-prompt","interior-design","dj","electrician",
  "photographer","tattoo-studio","landscaping-business","it-support","pharmacy",
  "golf-club","winery","dermatology-clinic","psychologist","clothing-boutique",
  "orthodontist","language-school","dog-trainer","flower-shop","law-firm",
  "fine-dining-restaurant","finance-advisor","escape-room","roofing-company","dance-studio",
  "wine-bar","online-course","recruitment-agency","travel-agency","life-coach",
  "pilates-studio","personal-chef-website-prompt","restaurant-website-prompt","pest-control-website-prompt",
  "copywriter-website-prompt","barber","nail-salon","swim-coach","hvac",
  "car-detailing","personal-trainer","butcher-shop","pizzeria","church",
  "consulting-firm","construction-company","home-inspector","wedding-planner","ice-cream-shop",
  "vacation-rental","boxing-gym","yoga-studio","fitness-coach","dog-groomer-boutique",
  "therapist","ceramics-studio","crossfit-gym","surf-school","jeweler",
  "childcare-nursery","event-planner","physiotherapist","mortgage-broker","wedding-venue",
  "architect-website-prompt","wedding-photographer-website-prompt","developer-portfolio-website-prompt",
  "nutritionist","retail-saas","run-club","band","bakery",
  "spa-wellness","art-gallery","security-company","furniture-store","nonprofit-organization",
  "martial-arts-academy","tutoring","med-spa","acupuncture-clinic","driving-school",
  "massage-therapist","hair-salon-editorial","interior-design-studio","wedding-venue-romantic",
  "mechanic","food-truck","optician","branding-agency","cocktail-bar",
  "digital-agency","vet-clinic","florist","dog-groomer","coffee-shop",
  "real-estate-website-prompt","sports-coach-website-prompt","designer-portfolio-website-prompt",
  "artist-portfolio","health-saas","catering","dentist","cleaning-service","plumber"
];

const BASE_URL = 'https://websiteprompts.ai/prompts';

function extractBetween(text, startMarker, endMarker) {
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return '';
  const fromStart = text.substring(startIdx + startMarker.length);
  const endIdx = fromStart.indexOf(endMarker);
  if (endIdx === -1) return fromStart.trim();
  return fromStart.substring(0, endIdx).trim();
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (match) return match[1].replace(/\s*[-—]\s*Websiteprompts\.ai.*$/i, '').replace(/\s*AI Website Prompt.*$/i, '').trim();
  return '';
}

function extractDescription(html) {
  const match = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
                html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
  return match ? match[1].trim() : '';
}

function extractOgImage(html) {
  const match = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
  return match ? match[1].trim() : '';
}

function extractPrompt(html) {
  // The prompt content is in the main article, between the first <h1> and "Key Dependencies" or "## Categories"
  // In the markdown version, it's between "# [Title]" and "## Categories" or "## FAQ"
  const lines = html.split('\n');
  let promptStart = -1;
  let promptEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ') && !line.startsWith('## ') && promptStart === -1) {
      promptStart = i;
    }
    if (promptStart !== -1 && (line === '## Categories' || line === '## FAQ' || line === '[Copy Prompt]')) {
      promptEnd = i;
      break;
    }
  }

  if (promptStart === -1) return '';
  return lines.slice(promptStart, promptEnd).join('\n').trim();
}

function extractCategories(html) {
  const cats = [];
  const catSection = extractBetween(html, '## Categories', '## FAQ');
  if (!catSection) return cats;
  const matches = catSection.match(/\[([^\]]+)\]\([^)]+\)/g);
  if (matches) {
    matches.forEach(m => {
      const nameMatch = m.match(/\[([^\]]+)\]/);
      if (nameMatch) cats.push(nameMatch[1]);
    });
  }
  return cats;
}

async function fetchPrompt(slug) {
  const url = `${BASE_URL}/${slug}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Failed to fetch ${slug}: ${res.status}`);
      return null;
    }
    const text = await res.text();

    const title = extractTitle(text);
    const description = extractDescription(text);
    const image = extractOgImage(text);
    const prompt = extractPrompt(text);
    const categories = extractCategories(text);

    return {
      id: slug,
      name: title || slug,
      description: description,
      prompt: prompt,
      image: image,
      categories: categories,
      source: 'websiteprompts.ai'
    };
  } catch (err) {
    console.error(`Error fetching ${slug}: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log(`Fetching ${SLUGS.length} prompts...`);
  const results = [];
  const batchSize = 8;

  for (let i = 0; i < SLUGS.length; i += batchSize) {
    const batch = SLUGS.slice(i, i + batchSize);
    console.log(`Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(SLUGS.length / batchSize)}: ${batch.join(', ')}`);

    const batchResults = await Promise.all(batch.map(slug => fetchPrompt(slug)));
    batchResults.forEach(r => { if (r) results.push(r); });

    // Small delay between batches to be respectful
    if (i + batchSize < SLUGS.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const outputPath = path.join(__dirname, 'websiteprompts-all.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nDone! ${results.length} prompts saved to ${outputPath}`);
}

main().catch(console.error);
