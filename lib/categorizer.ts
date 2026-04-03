import { Transaction } from "./qonto";

// ── Category rules (mirrors categories.json) ──

const SALARY_RULES: Record<string, string[]> = {
  "Co-CEO G.C (Guille)": ["guillermo", "guille"],
  "Co-CEO J.G (Jules)": ["jules", "granier"],
  "CTO": ["carlos"],
  "Software Engineer": ["guillaume"],
  "Designer": [],
  "Growth Lead": ["claudia", "torras"],
};

const OTHER_RULES: Record<string, string[]> = {
  "General & Administration": [
    "correos", "notario", "notary", "registro mercantil", "boe",
    "hacienda", "agencia tributaria", "seguridad social",
    "seguros", "insurance", "axa", "mapfre",
    "abogado", "lawyer", "legal", "urssaf", "impots", "tva",
  ],
  "Accountability / Gestor": ["gestor", "asesor", "contable", "accountant", "asesoria"],
  "Platform & Tech (tools)": [
    "stripe", "aws", "amazon web services", "google cloud",
    "vercel", "heroku", "digitalocean", "openai", "anthropic",
    "figma", "notion", "slack", "github", "gitlab",
    "postmark", "sendgrid", "mailgun", "twilio",
    "apple developer", "google play", "app store",
    "hubspot", "intercom", "crisp", "mixpanel",
    "amplitude", "segment", "posthog", "hotjar",
    "zapier", "make.com", "airtable",
    "canva", "adobe", "miro",
    "zoom", "google workspace", "microsoft",
    "whatsapp business", "meta business", "qonto",
    "ovh", "supabase", "linear", "apple",
  ],
  "Home / Office": [
    "alquiler", "rent", "loyer",
    "wework", "coworking", "regus", "spaces",
    "ikea", "leroy merlin",
    "endesa", "naturgy", "iberdrola",
    "vodafone", "movistar", "orange", "fiber",
  ],
  "Restaurants & Meals": [
    "noru gracia", "restaurante", "restaurant",
    "bar", "cafe", "cafeteria", "brunch",
    "deliveroo", "glovo", "uber eats", "just eat",
    "mcdonald", "burger king", "starbucks",
    "pizza", "sushi", "tapas", "bistro", "brasserie",
    "trattoria", "ramen", "poke",
    "el nacional", "flax & kale", "la boqueria",
  ],
  "Cold Start Events": [
    "tragaluz", "bosco de lobos", "perchoir",
    "catering", "venue", "sala", "espacio",
    "dj", "sonido", "sound", "lighting",
    "photographer", "fotografo", "photo",
    "florista", "decoracion",
  ],
  "Brand & Creative Production": [
    "imprenta", "print", "impresion",
    "video", "videographer", "production",
    "studio", "estudio",
  ],
  "Offsite Team": [
    "airbnb", "booking.com", "hotel",
    "vueling", "ryanair", "iberia", "easyjet", "transavia",
    "renfe", "sncf",
  ],
  "Travel Expenses": [
    "uber", "cabify", "bolt", "taxi", "free now",
    "ouigo", "gasolina", "fuel", "peaje", "toll", "parking",
  ],
  "Contingencies": [],
};

const ONSITE_CITIES = ["BARCELONA", "PARIS", "MADRID", "IBIZA"];
const ONSITE_ITEMS = ["Influencers", "PR (commission)", "Merch on-site", "Ads", "Contingencies"];

const ADS_KEYWORDS = ["meta", "facebook", "instagram", "google ads", "tiktok ads", "tiktok"];

interface CategorizedTransaction extends Transaction {
  section: string;
  category: string;
  categorizer_note?: string;
}

function categorizeOne(tx: Transaction): { section: string; category: string; note?: string } {
  const name = (tx.counterparty_name || "").toLowerCase();
  const label = (tx.label || "").toLowerCase();
  const text = `${name} ${label}`;

  // Credits
  if (tx.side === "credit") {
    if (text.includes("stripe")) return { section: "REVENUE", category: "Revenue B2C" };
    return { section: "REVENUE", category: "Revenue Other" };
  }

  // Stripe debit = fees
  if (text.includes("stripe")) {
    return { section: "GLOBAL COSTS - OTHER", category: "Platform & Tech (tools)", note: "Stripe fees" };
  }

  // Ads ambiguity
  for (const kw of ADS_KEYWORDS) {
    if (text.includes(kw)) {
      const noteText = (tx.note || "").toLowerCase();
      const full = `${text} ${noteText}`;
      const cityMap: [string, string][] = [
        ["barcelona", "BARCELONA"], ["bcn", "BARCELONA"],
        ["paris", "PARIS"], ["madrid", "MADRID"], ["ibiza", "IBIZA"],
      ];
      for (const [key, city] of cityMap) {
        if (full.includes(key)) return { section: `ON-SITE COSTS - ${city}`, category: "Ads" };
      }
      return { section: "UNCATEGORIZED", category: "UNCATEGORIZED", note: "Ads — quelle ville ?" };
    }
  }

  // Salaries
  for (const [cat, keywords] of Object.entries(SALARY_RULES)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return { section: "GLOBAL COSTS - SALARIES", category: cat };
    }
  }

  // Other
  for (const [cat, keywords] of Object.entries(OTHER_RULES)) {
    if (cat === "Contingencies") continue;
    for (const kw of keywords) {
      if (text.includes(kw)) return { section: "GLOBAL COSTS - OTHER", category: cat };
    }
  }

  return { section: "UNCATEGORIZED", category: "UNCATEGORIZED" };
}

export function categorizeTransactions(transactions: Transaction[]): CategorizedTransaction[] {
  return transactions.map((tx) => {
    const { section, category, note } = categorizeOne(tx);
    return { ...tx, section, category, categorizer_note: note };
  });
}

// ── Budget template ──

const BUDGET: Record<string, number> = {
  "Co-CEO G.C (Guille)": 3000, "Co-CEO J.G (Jules)": 3500,
  "CTO": 1500, "Software Engineer": 3000, "Designer": 5000, "Growth Lead": 4000,
  "General & Administration": 0, "Accountability / Gestor": 200,
  "Platform & Tech (tools)": 1000, "Home / Office": 2000,
  "Restaurants & Meals": 0, "Cold Start Events": 1000,
  "Brand & Creative Production": 0, "Offsite Team": 0,
  "Travel Expenses": 0, "Contingencies": 2000,
};

const BUDGET_ONSITE: Record<string, Record<string, number>> = {
  "ON-SITE COSTS - BARCELONA": { "Influencers": 2000, "PR (commission)": 230, "Merch on-site": 3000, "Ads": 2000, "Contingencies": 1000 },
  "ON-SITE COSTS - PARIS": { "Influencers": 0, "PR (commission)": 0, "Merch on-site": 3000, "Ads": 0, "Contingencies": 0 },
  "ON-SITE COSTS - MADRID": { "Influencers": 0, "PR (commission)": 0, "Merch on-site": 0, "Ads": 0, "Contingencies": 0 },
  "ON-SITE COSTS - IBIZA": { "Influencers": 0, "PR (commission)": 0, "Merch on-site": 0, "Ads": 0, "Contingencies": 0 },
};

export const SECTIONS = [
  {
    header: "GLOBAL COSTS — SALARIES",
    key: "GLOBAL COSTS - SALARIES",
    items: ["Co-CEO G.C (Guille)", "Co-CEO J.G (Jules)", "CTO", "Software Engineer", "Designer", "Growth Lead"],
    total: "TOTAL SALARIES",
  },
  {
    header: "GLOBAL COSTS — OTHER",
    key: "GLOBAL COSTS - OTHER",
    items: [
      "General & Administration", "Accountability / Gestor",
      "Platform & Tech (tools)", "Home / Office", "Restaurants & Meals",
      "Cold Start Events", "Brand & Creative Production", "Offsite Team",
      "Travel Expenses", "Contingencies",
    ],
    total: "TOTAL OTHER",
  },
  ...ONSITE_CITIES.map((city) => ({
    header: `ON-SITE — ${city}`,
    key: `ON-SITE COSTS - ${city}`,
    items: ONSITE_ITEMS,
    total: `TOTAL ${city}`,
  })),
];

export function getBudget(sectionKey: string, item: string): number {
  if (BUDGET_ONSITE[sectionKey]) return BUDGET_ONSITE[sectionKey][item] ?? 0;
  return BUDGET[item] ?? 0;
}

export function aggregateActuals(transactions: CategorizedTransaction[]): Record<string, number> {
  const agg: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.side !== "debit") continue;
    const key = `${tx.section}|${tx.category}`;
    agg[key] = (agg[key] || 0) + tx.amount;
  }
  return agg;
}
