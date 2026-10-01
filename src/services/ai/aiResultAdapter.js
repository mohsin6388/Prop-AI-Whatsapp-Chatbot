/**
 * Converts Monica's structured Gemini reply (the snake_case schema in
 * promptBuilder.REPLY_RESPONSE_SCHEMA) into the shape conversationEngine
 * works with.
 *
 * Why this file exists: the prompt/schema was rewritten (name, budget,
 * location_preference, assistant_interest, ...) but conversationEngine kept
 * reading the OLD field names (extractedRequirements, referralStage,
 * wantsSiteVisit, ...). Every one of those was always undefined, so
 * requirements were never saved, names never stored, the referral step never
 * advanced and site visits were never created. All mapping now lives here.
 */

const EMPTY_VALUES = new Set(["", "null", "none", "unknown", "n/a", "na", "-", "pata nahi"]);

function clean(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s || EMPTY_VALUES.has(s.toLowerCase())) return null;
  return s;
}

// ---------------------------------------------------------------------------
// Budget: "50 lakh", "50-60L", "80 lakh to 1.2 cr", "AED 1.5M", "15k/month"
// ---------------------------------------------------------------------------

const UNIT_MULTIPLIERS = [
  [/^(crores?|cr|c)$/i, 1e7],
  [/^(lakhs?|lacs?|lac|lks?|l)$/i, 1e5],
  [/^(millions?|mn|m)$/i, 1e6],
  [/^(thousands?|k)$/i, 1e3],
];

function unitMultiplier(unit) {
  if (!unit) return null;
  for (const [re, mult] of UNIT_MULTIPLIERS) {
    if (re.test(unit)) return mult;
  }
  return null;
}

/**
 * Returns { budgetMin, budgetMax } in absolute currency units, or nulls when
 * the text can't be understood. A single amount is treated as the maximum.
 */
function parseBudget(text) {
  const s = clean(text);
  if (!s) return { budgetMin: null, budgetMax: null };

  const normalized = s.toLowerCase().replace(/,/g, "").replace(/₹|rs\.?|inr|aed|dhs?|\$/g, " ");
  const re = /(\d+(?:\.\d+)?)\s*(crores?|cr|c|lakhs?|lacs?|lac|lks?|l|millions?|mn|m|thousands?|k)?\b/g;

  const amounts = [];
  let match;
  while ((match = re.exec(normalized)) !== null) {
    amounts.push({ value: parseFloat(match[1]), unit: match[2] || null });
  }
  if (!amounts.length) return { budgetMin: null, budgetMax: null };

  // "50-60 lakh": the unit written after the last number applies to the
  // numbers before it that have no unit of their own.
  let carryUnit = null;
  for (let i = amounts.length - 1; i >= 0; i--) {
    if (amounts[i].unit) carryUnit = amounts[i].unit;
    else if (carryUnit) amounts[i].unit = carryUnit;
  }

  const values = amounts
    .map(({ value, unit }) => {
      const mult = unitMultiplier(unit);
      if (mult) return Math.round(value * mult);
      return value >= 1000 ? Math.round(value) : null; // bare "50" is too ambiguous
    })
    .filter((v) => Number.isFinite(v) && v > 0)
    .slice(0, 2);

  if (!values.length) return { budgetMin: null, budgetMax: null };
  if (values.length === 1) return { budgetMin: null, budgetMax: values[0] };

  const [a, b] = values;
  return { budgetMin: Math.min(a, b), budgetMax: Math.max(a, b) };
}

// ---------------------------------------------------------------------------
// Site-visit date / time validation
// ---------------------------------------------------------------------------

function todayInTimezone(timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD
}

function normalizeVisitDate(value, timezone) {
  const s = clean(value);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return null;
  if (s < todayInTimezone(timezone)) return null; // never book in the past
  return s;
}

/** Accepts "17:30", "5:30 pm", "5pm", "11 AM" -> "HH:MM" (24h) */
function normalizeVisitTime(value) {
  const s = clean(value);
  if (!s) return null;
  const m = s.toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Main adapter
// ---------------------------------------------------------------------------

function normalizeAiResult(parsed = {}, { timezone = "Asia/Kolkata" } = {}) {
  const budgetText = clean(parsed.budget);
  const { budgetMin, budgetMax } = parseBudget(budgetText);

  const extractedRequirements = {
    city: clean(parsed.city),
    location: clean(parsed.location_preference),
    bhk: clean(parsed.bhk),
    propertyType: clean(parsed.property_type),
    purpose: clean(parsed.purpose),
    timeline: clean(parsed.timeline),
    language: clean(parsed.preferred_language),
    notes: clean(parsed.notes),
    budgetText,
    budgetMin,
    budgetMax,
  };

  // If the model put "Noida, Sector 150" only into location_preference and
  // left city empty, don't lose the city.
  if (!extractedRequirements.city && extractedRequirements.location && extractedRequirements.location.includes(",")) {
    const parts = extractedRequirements.location.split(",").map((p) => p.trim()).filter(Boolean);
    extractedRequirements.city = parts[parts.length - 1] || null;
  }

  let referralStage = "none";
  if (parsed.assistant_offer_asked === true) referralStage = "ask_now";
  else if (parsed.assistant_interest === "yes") referralStage = "accepted";
  else if (parsed.assistant_interest === "no") referralStage = "declined";

  const wantsSiteVisit = parsed.wants_site_visit === true;
  const proposedDate = wantsSiteVisit ? normalizeVisitDate(parsed.visit_date, timezone) : null;
  const proposedTime = wantsSiteVisit ? normalizeVisitTime(parsed.visit_time) : null;

  const interestLevel = clean(parsed.interest_level) || (parsed.interest_level === "pata nahi" ? "pata nahi" : null);

  return {
    reply: typeof parsed.reply === "string" ? parsed.reply.trim() : "",
    name: clean(parsed.name),
    extractedRequirements,
    intent: wantsSiteVisit ? "site_visit" : interestLevel,
    sentiment: null,
    interestLevel: parsed.interest_level || null,
    leadType: clean(parsed.lead_type),
    verified: parsed.verified === true,
    referralStage,
    wantsSiteVisit,
    proposedDate,
    proposedTime,
    sendPropertyMedia: parsed.send_property_media === true,
    propertyReference: clean(parsed.property_reference),
    readyForPropertyRecommendation: Boolean(
      extractedRequirements.city &&
        (budgetText || extractedRequirements.bhk || extractedRequirements.propertyType),
    ),
  };
}

module.exports = {
  normalizeAiResult,
  parseBudget,
  normalizeVisitDate,
  normalizeVisitTime,
  todayInTimezone,
};
