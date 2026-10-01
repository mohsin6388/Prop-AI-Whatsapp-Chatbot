// const Property = require('../../models/Property');

// /**
//  * Finds and ranks properties matching a buyer's known requirements.
//  * Single-tenant app: searches the whole (one) active inventory — no org
//  * scoping needed.
//  *
//  * Scoring is intentionally simple and explainable (not another AI call) —
//  * budget overlap and location/city/bhk matches are exact, cheap, and easy
//  * to reason about; Gemini then explains the *why* in natural language.
//  */
// async function matchProperties({ city, location, budgetMin, budgetMax, bhk, amenities = [] }, limit = 5) {
//   const filter = { isActive: true };

//   // Soft city match instead of an exact "^City$" match: buyers/leads type
//   // things like "noida", "Noida ", "Greater Noida" etc., and an exact match
//   // was silently wiping out every candidate the moment casing/whitespace/
//   // a locality suffix didn't line up perfectly.
//   if (city) filter.city = new RegExp(escapeRegex(city.trim()), 'i');

//   let candidates = await Property.find(filter).limit(200).lean();

//   // If a (possibly slightly-off) city still returns nothing, don't leave the
//   // AI with an empty database — fall back to the full active inventory so
//   // it can still have a real, honest conversation instead of wrongly
//   // claiming "we have nothing available".
//   if (!candidates.length) {
//     candidates = await Property.find({ isActive: true }).limit(200).lean();
//   }
//   if (!candidates.length) return [];

//   const scored = candidates.map((p) => ({ property: p, score: scoreMatch(p, { location, budgetMin, budgetMax, bhk, amenities }) }));

//   scored.sort((a, b) => b.score - a.score);

//   // Prefer genuine matches (score > 0), but if literally nothing scored above
//   // zero (e.g. buyer's budget is outside every listing), still surface the
//   // closest options rather than telling the buyer we have nothing at all —
//   // the AI is instructed to be upfront that these are the closest fit.
//   const positive = scored.filter((s) => s.score > 0);
//   const pool = positive.length ? positive : scored;

//   return pool.slice(0, limit).map((s) => s.property);
// }

// function scoreMatch(property, { location, budgetMin, budgetMax, bhk, amenities }) {
//   let score = 1; // base score — already scoped to this city bucket

//   if (budgetMin != null || budgetMax != null) {
//     const buyerMin = budgetMin ?? 0;
//     const buyerMax = budgetMax ?? Number.MAX_SAFE_INTEGER;
//     const propMin = property.budgetMin ?? 0;
//     const propMax = property.budgetMax ?? Number.MAX_SAFE_INTEGER;
//     const overlaps = propMin <= buyerMax && propMax >= buyerMin;

//     if (overlaps) {
//       score += 3;
//     } else {
//       // Near-budget properties are still worth showing (e.g. buyer said 50L,
//       // property starts at 55L) — penalize instead of hard-excluding so the
//       // AI has something honest to offer rather than nothing.
//       const gap = propMin > buyerMax ? propMin - buyerMax : buyerMin - propMax;
//       const referencePoint = buyerMax || buyerMin || propMax || 1;
//       const gapRatio = gap / referencePoint;
//       if (gapRatio <= 0.2) {
//         score += 1; // within ~20% of budget — close enough to mention
//       } else {
//         score -= 2; // clearly out of range — rank last, but don't erase
//       }
//     }
//   }

//   if (bhk && property.bhk && String(property.bhk).includes(String(bhk).replace(/\D/g, ''))) {
//     score += 2;
//   }

//   if (location && property.location && property.location.toLowerCase().includes(location.toLowerCase())) {
//     score += 2;
//   }

//   if (amenities?.length && property.amenities?.length) {
//     const propAmenitiesLower = property.amenities.map((a) => a.toLowerCase());
//     const matched = amenities.filter((a) => propAmenitiesLower.includes(a.toLowerCase()));
//     score += matched.length;
//   }

//   return score;
// }

// function escapeRegex(str) {
//   return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// }

// module.exports = { matchProperties };

const Property = require("../../models/Property");

/**
 * Finds and ranks properties based on buyer requirements.
 *
 * Matching priority:
 * 1. City
 * 2. Location
 * 3. Budget
 * 4. BHK
 * 5. Property Type
 * 6. Amenities
 */

async function matchProperties(
  { city, location, budgetMin, budgetMax, bhk, propertyType, amenities = [] },
  limit = 5,
) {
  const filter = {
    isActive: true,
  };

  // City is the main filter.
  if (city) {
    filter.city = new RegExp(escapeRegex(city.trim()), "i");
  }

  let candidates = await Property.find(filter).limit(200).lean();

  // If city has no exact-ish match, don't immediately return nothing.
  // Search active inventory so the AI can honestly offer alternatives.
  if (!candidates.length && city) {
    candidates = await Property.find({
      isActive: true,
    })
      .limit(200)
      .lean();
  }

  if (!candidates.length) {
    return [];
  }

  const scored = candidates.map((property) => ({
    property,
    score: scoreMatch(property, {
      city,
      location,
      budgetMin,
      budgetMax,
      bhk,
      propertyType,
      amenities,
    }),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((item) => item.property);
}

/**
 * Calculate match score.
 */
function scoreMatch(
  property,
  { city, location, budgetMin, budgetMax, bhk, propertyType, amenities },
) {
  let score = 0;

  // --------------------------------------------------
  // CITY - strongest match
  // --------------------------------------------------

  if (city && property.city) {
    const buyerCity = normalize(city);
    const propertyCity = normalize(property.city);

    if (propertyCity === buyerCity) {
      score += 10;
    } else if (
      propertyCity.includes(buyerCity) ||
      buyerCity.includes(propertyCity)
    ) {
      score += 6;
    } else {
      // Different city should be heavily penalized.
      score -= 8;
    }
  }

  // --------------------------------------------------
  // LOCATION
  // --------------------------------------------------

  if (location && property.location) {
    const buyerLocation = normalize(location);
    const propertyLocation = normalize(property.location);

    if (propertyLocation === buyerLocation) {
      score += 7;
    } else if (
      propertyLocation.includes(buyerLocation) ||
      buyerLocation.includes(propertyLocation)
    ) {
      score += 5;
    }
  }

  // --------------------------------------------------
  // BUDGET
  // --------------------------------------------------

  if (budgetMin != null || budgetMax != null) {
    const buyerMin = Number(budgetMin ?? 0);
    const buyerMax = Number(budgetMax ?? Number.MAX_SAFE_INTEGER);

    const propertyMin = Number(property.budgetMin ?? 0);
    const propertyMax = Number(property.budgetMax ?? Number.MAX_SAFE_INTEGER);

    const overlaps = propertyMin <= buyerMax && propertyMax >= buyerMin;

    if (overlaps) {
      score += 8;
    } else {
      // Allow slightly-over-budget properties.
      const gap =
        propertyMin > buyerMax
          ? propertyMin - buyerMax
          : buyerMin - propertyMax;

      const reference = buyerMax || buyerMin || propertyMax || 1;

      const gapRatio = gap / reference;

      if (gapRatio <= 0.1) {
        score += 3;
      } else if (gapRatio <= 0.2) {
        score += 1;
      } else {
        score -= 5;
      }
    }
  }

  // --------------------------------------------------
  // BHK
  // --------------------------------------------------

  if (bhk && property.bhk) {
    const buyerBhk = normalizeBhk(bhk);
    const propertyBhk = normalizeBhk(property.bhk);

    if (propertyBhk === buyerBhk) {
      score += 8;
    } else if (propertyBhk.includes(buyerBhk)) {
      score += 5;
    }
  }

  // --------------------------------------------------
  // PROPERTY TYPE
  // --------------------------------------------------

  if (propertyType && property.propertyType) {
    const buyerType = normalize(propertyType);
    const propertyTypeValue = normalize(property.propertyType);

    if (propertyTypeValue === buyerType) {
      score += 6;
    } else if (
      propertyTypeValue.includes(buyerType) ||
      buyerType.includes(propertyTypeValue)
    ) {
      score += 4;
    }
  }

  // --------------------------------------------------
  // AMENITIES
  // --------------------------------------------------

  if (
    Array.isArray(amenities) &&
    amenities.length &&
    Array.isArray(property.amenities)
  ) {
    const propertyAmenities = property.amenities.map(normalize);

    for (const amenity of amenities) {
      const requested = normalize(amenity);

      if (
        propertyAmenities.some(
          (item) =>
            item === requested ||
            item.includes(requested) ||
            requested.includes(item),
        )
      ) {
        score += 2;
      }
    }
  }

  return score;
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeBhk(value) {
  return normalize(value).replace(/bhk/g, "").replace(/\s+/g, "");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  matchProperties,
};
