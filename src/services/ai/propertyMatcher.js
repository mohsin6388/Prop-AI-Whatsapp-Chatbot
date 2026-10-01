// // const Property = require('../../models/Property');

// // /**
// //  * Finds and ranks properties matching a buyer's known requirements.
// //  * Single-tenant app: searches the whole (one) active inventory — no org
// //  * scoping needed.
// //  *
// //  * Scoring is intentionally simple and explainable (not another AI call) —
// //  * budget overlap and location/city/bhk matches are exact, cheap, and easy
// //  * to reason about; Gemini then explains the *why* in natural language.
// //  */
// // async function matchProperties({ city, location, budgetMin, budgetMax, bhk, amenities = [] }, limit = 5) {
// //   const filter = { isActive: true };

// //   // Soft city match instead of an exact "^City$" match: buyers/leads type
// //   // things like "noida", "Noida ", "Greater Noida" etc., and an exact match
// //   // was silently wiping out every candidate the moment casing/whitespace/
// //   // a locality suffix didn't line up perfectly.
// //   if (city) filter.city = new RegExp(escapeRegex(city.trim()), 'i');

// //   let candidates = await Property.find(filter).limit(200).lean();

// //   // If a (possibly slightly-off) city still returns nothing, don't leave the
// //   // AI with an empty database — fall back to the full active inventory so
// //   // it can still have a real, honest conversation instead of wrongly
// //   // claiming "we have nothing available".
// //   if (!candidates.length) {
// //     candidates = await Property.find({ isActive: true }).limit(200).lean();
// //   }
// //   if (!candidates.length) return [];

// //   const scored = candidates.map((p) => ({ property: p, score: scoreMatch(p, { location, budgetMin, budgetMax, bhk, amenities }) }));

// //   scored.sort((a, b) => b.score - a.score);

// //   // Prefer genuine matches (score > 0), but if literally nothing scored above
// //   // zero (e.g. buyer's budget is outside every listing), still surface the
// //   // closest options rather than telling the buyer we have nothing at all —
// //   // the AI is instructed to be upfront that these are the closest fit.
// //   const positive = scored.filter((s) => s.score > 0);
// //   const pool = positive.length ? positive : scored;

// //   return pool.slice(0, limit).map((s) => s.property);
// // }

// // function scoreMatch(property, { location, budgetMin, budgetMax, bhk, amenities }) {
// //   let score = 1; // base score — already scoped to this city bucket

// //   if (budgetMin != null || budgetMax != null) {
// //     const buyerMin = budgetMin ?? 0;
// //     const buyerMax = budgetMax ?? Number.MAX_SAFE_INTEGER;
// //     const propMin = property.budgetMin ?? 0;
// //     const propMax = property.budgetMax ?? Number.MAX_SAFE_INTEGER;
// //     const overlaps = propMin <= buyerMax && propMax >= buyerMin;

// //     if (overlaps) {
// //       score += 3;
// //     } else {
// //       // Near-budget properties are still worth showing (e.g. buyer said 50L,
// //       // property starts at 55L) — penalize instead of hard-excluding so the
// //       // AI has something honest to offer rather than nothing.
// //       const gap = propMin > buyerMax ? propMin - buyerMax : buyerMin - propMax;
// //       const referencePoint = buyerMax || buyerMin || propMax || 1;
// //       const gapRatio = gap / referencePoint;
// //       if (gapRatio <= 0.2) {
// //         score += 1; // within ~20% of budget — close enough to mention
// //       } else {
// //         score -= 2; // clearly out of range — rank last, but don't erase
// //       }
// //     }
// //   }

// //   if (bhk && property.bhk && String(property.bhk).includes(String(bhk).replace(/\D/g, ''))) {
// //     score += 2;
// //   }

// //   if (location && property.location && property.location.toLowerCase().includes(location.toLowerCase())) {
// //     score += 2;
// //   }

// //   if (amenities?.length && property.amenities?.length) {
// //     const propAmenitiesLower = property.amenities.map((a) => a.toLowerCase());
// //     const matched = amenities.filter((a) => propAmenitiesLower.includes(a.toLowerCase()));
// //     score += matched.length;
// //   }

// //   return score;
// // }

// // function escapeRegex(str) {
// //   return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// // }

// // module.exports = { matchProperties };

// const Property = require("../../models/Property");

// /**
//  * Finds and ranks properties based on buyer requirements.
//  *
//  * Matching priority:
//  * 1. City
//  * 2. Location
//  * 3. Budget
//  * 4. BHK
//  * 5. Property Type
//  * 6. Amenities
//  */

// async function matchProperties(
//   { city, location, budgetMin, budgetMax, bhk, propertyType, amenities = [] },
//   limit = 5,
// ) {
//   const filter = {
//     isActive: true,
//   };

//   // City is the main filter.
//   if (city) {
//     filter.city = new RegExp(escapeRegex(city.trim()), "i");
//   }

//   let candidates = await Property.find(filter).limit(200).lean();

//   // If city has no exact-ish match, don't immediately return nothing.
//   // Search active inventory so the AI can honestly offer alternatives.
//   if (!candidates.length && city) {
//     candidates = await Property.find({
//       isActive: true,
//     })
//       .limit(200)
//       .lean();
//   }

//   if (!candidates.length) {
//     return [];
//   }

//   const scored = candidates.map((property) => ({
//     property,
//     score: scoreMatch(property, {
//       city,
//       location,
//       budgetMin,
//       budgetMax,
//       bhk,
//       propertyType,
//       amenities,
//     }),
//   }));

//   scored.sort((a, b) => b.score - a.score);

//   return scored.slice(0, limit).map((item) => item.property);
// }

// /**
//  * Calculate match score.
//  */
// function scoreMatch(
//   property,
//   { city, location, budgetMin, budgetMax, bhk, propertyType, amenities },
// ) {
//   let score = 0;

//   // --------------------------------------------------
//   // CITY - strongest match
//   // --------------------------------------------------

//   if (city && property.city) {
//     const buyerCity = normalize(city);
//     const propertyCity = normalize(property.city);

//     if (propertyCity === buyerCity) {
//       score += 10;
//     } else if (
//       propertyCity.includes(buyerCity) ||
//       buyerCity.includes(propertyCity)
//     ) {
//       score += 6;
//     } else {
//       // Different city should be heavily penalized.
//       score -= 8;
//     }
//   }

//   // --------------------------------------------------
//   // LOCATION
//   // --------------------------------------------------

//   if (location && property.location) {
//     const buyerLocation = normalize(location);
//     const propertyLocation = normalize(property.location);

//     if (propertyLocation === buyerLocation) {
//       score += 7;
//     } else if (
//       propertyLocation.includes(buyerLocation) ||
//       buyerLocation.includes(propertyLocation)
//     ) {
//       score += 5;
//     }
//   }

//   // --------------------------------------------------
//   // BUDGET
//   // --------------------------------------------------

//   if (budgetMin != null || budgetMax != null) {
//     const buyerMin = Number(budgetMin ?? 0);
//     const buyerMax = Number(budgetMax ?? Number.MAX_SAFE_INTEGER);

//     const propertyMin = Number(property.budgetMin ?? 0);
//     const propertyMax = Number(property.budgetMax ?? Number.MAX_SAFE_INTEGER);

//     const overlaps = propertyMin <= buyerMax && propertyMax >= buyerMin;

//     if (overlaps) {
//       score += 8;
//     } else {
//       // Allow slightly-over-budget properties.
//       const gap =
//         propertyMin > buyerMax
//           ? propertyMin - buyerMax
//           : buyerMin - propertyMax;

//       const reference = buyerMax || buyerMin || propertyMax || 1;

//       const gapRatio = gap / reference;

//       if (gapRatio <= 0.1) {
//         score += 3;
//       } else if (gapRatio <= 0.2) {
//         score += 1;
//       } else {
//         score -= 5;
//       }
//     }
//   }

//   // --------------------------------------------------
//   // BHK
//   // --------------------------------------------------

//   if (bhk && property.bhk) {
//     const buyerBhk = normalizeBhk(bhk);
//     const propertyBhk = normalizeBhk(property.bhk);

//     if (propertyBhk === buyerBhk) {
//       score += 8;
//     } else if (propertyBhk.includes(buyerBhk)) {
//       score += 5;
//     }
//   }

//   // --------------------------------------------------
//   // PROPERTY TYPE
//   // --------------------------------------------------

//   if (propertyType && property.propertyType) {
//     const buyerType = normalize(propertyType);
//     const propertyTypeValue = normalize(property.propertyType);

//     if (propertyTypeValue === buyerType) {
//       score += 6;
//     } else if (
//       propertyTypeValue.includes(buyerType) ||
//       buyerType.includes(propertyTypeValue)
//     ) {
//       score += 4;
//     }
//   }

//   // --------------------------------------------------
//   // AMENITIES
//   // --------------------------------------------------

//   if (
//     Array.isArray(amenities) &&
//     amenities.length &&
//     Array.isArray(property.amenities)
//   ) {
//     const propertyAmenities = property.amenities.map(normalize);

//     for (const amenity of amenities) {
//       const requested = normalize(amenity);

//       if (
//         propertyAmenities.some(
//           (item) =>
//             item === requested ||
//             item.includes(requested) ||
//             requested.includes(item),
//         )
//       ) {
//         score += 2;
//       }
//     }
//   }

//   return score;
// }

// // --------------------------------------------------
// // Helpers
// // --------------------------------------------------

// function normalize(value) {
//   return String(value || "")
//     .trim()
//     .toLowerCase()
//     .replace(/\s+/g, " ");
// }

// function normalizeBhk(value) {
//   return normalize(value).replace(/bhk/g, "").replace(/\s+/g, "");
// }

// function escapeRegex(str) {
//   return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// }

// module.exports = {
//   matchProperties,
// };

const Property = require("../../models/Property");

/**
 * Property Matcher
 *
 * Searches and ranks properties using:
 *
 * - Project name
 * - Builder
 * - City
 * - Location
 * - Property type
 * - BHK
 * - Budget
 * - Size
 * - Amenities
 * - Parking
 * - RERA
 * - Nearby metro
 * - Nearby school
 * - Nearby hospital
 * - Description
 *
 * Important:
 * If customer explicitly asks for a project by name,
 * projectName gets the highest priority.
 */

async function matchProperties(
  {
    projectName,
    city,
    location,
    budgetMin,
    budgetMax,
    bhk,
    propertyType,
    sizeSqft,
    amenities = [],
    parking,
    reraNumber,
    nearbyMetro,
    nearbySchool,
    nearbyHospital,
    searchText,
  },
  limit = 5,
) {
  const cleanProjectName = normalizeSearchValue(projectName);

  const filter = {
    isActive: true,
  };

  // =========================================================
  // EXPLICIT PROJECT SEARCH
  // =========================================================
  //
  // If customer specifically asks:
  //
  // "Sunflower ki details batao"
  // "Sunflower project hai?"
  // "Palorma ke baare mein batao"
  //
  // Search project name FIRST.
  //

  if (cleanProjectName) {
    const projectRegex = buildFlexibleRegex(cleanProjectName);

    filter.projectName = projectRegex;
  } else if (city) {
    // For normal property discovery, city is the main filter.
    filter.city = new RegExp(escapeRegex(String(city).trim()), "i");
  }

  console.log("[propertyMatcher] Search input:", {
    projectName,
    city,
    location,
    budgetMin,
    budgetMax,
    bhk,
    propertyType,
    sizeSqft,
    amenities,
    parking,
    reraNumber,
    nearbyMetro,
    nearbySchool,
    nearbyHospital,
    searchText,
  });

  console.log("[propertyMatcher] Mongo filter:", filter);

  let candidates = await Property.find(filter).limit(200).lean();

  console.log("[propertyMatcher] Initial candidates:", candidates.length);

  // =========================================================
  // PROJECT NAME FALLBACK
  // =========================================================
  //
  // If exact-ish project search didn't find anything,
  // search the project name across several text fields.
  //
  // This handles:
  //
  // "Sunflower"
  // "The Sunflower"
  // "Sunflower project"
  // "Sunflower projects"
  //

  if (!candidates.length && cleanProjectName) {
    const projectRegex = buildFlexibleRegex(cleanProjectName);

    candidates = await Property.find({
      isActive: true,
      $or: [
        { projectName: projectRegex },
        { description: projectRegex },
        { location: projectRegex },
        { builderName: projectRegex },
      ],
    })
      .limit(200)
      .lean();

    console.log(
      "[propertyMatcher] Project fallback candidates:",
      candidates.length,
    );
  }

  // =========================================================
  // GENERAL SEARCH FALLBACK
  // =========================================================
  //
  // If city/location didn't find anything, search all active
  // inventory rather than incorrectly telling the customer
  // that no property exists.
  //

  if (!candidates.length && !cleanProjectName) {
    candidates = await Property.find({
      isActive: true,
    })
      .limit(200)
      .lean();

    console.log(
      "[propertyMatcher] Full inventory fallback:",
      candidates.length,
    );
  }

  if (!candidates.length) {
    console.log("[propertyMatcher] No active properties found.");

    return [];
  }

  // =========================================================
  // SCORE PROPERTIES
  // =========================================================

  const scored = candidates.map((property) => {
    const score = scoreMatch(property, {
      projectName,
      city,
      location,
      budgetMin,
      budgetMax,
      bhk,
      propertyType,
      sizeSqft,
      amenities,
      parking,
      reraNumber,
      nearbyMetro,
      nearbySchool,
      nearbyHospital,
      searchText,
    });

    return {
      property,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  console.log(
    "[propertyMatcher] Ranked properties:",
    scored.slice(0, limit).map((item) => ({
      project: item.property.projectName,
      city: item.property.city,
      location: item.property.location,
      score: item.score,
    })),
  );

  return scored.slice(0, limit).map((item) => item.property);
}

// =========================================================
// SCORE MATCH
// =========================================================

function scoreMatch(
  property,
  {
    projectName,
    city,
    location,
    budgetMin,
    budgetMax,
    bhk,
    propertyType,
    sizeSqft,
    amenities,
    parking,
    reraNumber,
    nearbyMetro,
    nearbySchool,
    nearbyHospital,
    searchText,
  },
) {
  let score = 0;

  // =======================================================
  // PROJECT NAME
  // =======================================================

  if (projectName && property.projectName) {
    const requested = normalizeSearchValue(projectName);
    const actual = normalizeSearchValue(property.projectName);

    if (actual === requested) {
      score += 100;
    } else if (actual.includes(requested) || requested.includes(actual)) {
      score += 80;
    } else {
      score -= 30;
    }
  }

  // =======================================================
  // CITY
  // =======================================================

  if (city && property.city) {
    const requestedCity = normalizeSearchValue(city);
    const actualCity = normalizeSearchValue(property.city);

    if (actualCity === requestedCity) {
      score += 20;
    } else if (
      actualCity.includes(requestedCity) ||
      requestedCity.includes(actualCity)
    ) {
      score += 12;
    } else {
      score -= 15;
    }
  }

  // =======================================================
  // LOCATION
  // =======================================================

  if (location && property.location) {
    const requestedLocation = normalizeSearchValue(location);

    const actualLocation = normalizeSearchValue(property.location);

    if (actualLocation === requestedLocation) {
      score += 18;
    } else if (
      actualLocation.includes(requestedLocation) ||
      requestedLocation.includes(actualLocation)
    ) {
      score += 12;
    }
  }

  // =======================================================
  // BUILDER
  // =======================================================

  if (searchText && property.builderName) {
    const search = normalizeSearchValue(searchText);
    const builder = normalizeSearchValue(property.builderName);

    if (builder.includes(search) || search.includes(builder)) {
      score += 15;
    }
  }

  // =======================================================
  // PROPERTY TYPE
  // =======================================================

  if (propertyType && property.propertyType) {
    const requestedType = normalizeSearchValue(propertyType);

    const actualType = normalizeSearchValue(property.propertyType);

    if (actualType === requestedType) {
      score += 12;
    } else if (
      actualType.includes(requestedType) ||
      requestedType.includes(actualType)
    ) {
      score += 8;
    }
  }

  // =======================================================
  // BHK
  // =======================================================

  if (bhk && property.bhk) {
    const requestedBhk = normalizeBhk(bhk);
    const actualBhk = normalizeBhk(property.bhk);

    if (actualBhk === requestedBhk) {
      score += 15;
    } else if (
      actualBhk.includes(requestedBhk) ||
      requestedBhk.includes(actualBhk)
    ) {
      score += 8;
    }
  }

  // =======================================================
  // BUDGET
  // =======================================================

  if (budgetMin != null || budgetMax != null) {
    const buyerMin = Number(budgetMin ?? 0);

    const buyerMax = Number(budgetMax ?? Number.MAX_SAFE_INTEGER);

    const propertyMin = Number(property.budgetMin ?? 0);

    const propertyMax = Number(property.budgetMax ?? Number.MAX_SAFE_INTEGER);

    const overlaps = propertyMin <= buyerMax && propertyMax >= buyerMin;

    if (overlaps) {
      score += 15;
    } else {
      const gap =
        propertyMin > buyerMax
          ? propertyMin - buyerMax
          : buyerMin - propertyMax;

      const reference = buyerMax || buyerMin || propertyMax || 1;

      const gapRatio = gap / reference;

      if (gapRatio <= 0.1) {
        score += 5;
      } else if (gapRatio <= 0.2) {
        score += 2;
      } else {
        score -= 10;
      }
    }
  }

  // =======================================================
  // SIZE
  // =======================================================

  if (sizeSqft != null && property.sizeSqft != null) {
    const requestedSize = Number(sizeSqft);

    const propertySize = Number(property.sizeSqft);

    if (requestedSize === propertySize) {
      score += 12;
    } else {
      const difference = Math.abs(propertySize - requestedSize);

      const ratio = difference / requestedSize;

      if (ratio <= 0.1) {
        score += 8;
      } else if (ratio <= 0.2) {
        score += 4;
      }
    }
  }

  // =======================================================
  // AMENITIES
  // =======================================================

  if (
    Array.isArray(amenities) &&
    amenities.length &&
    Array.isArray(property.amenities)
  ) {
    const propertyAmenities = property.amenities.map(normalizeSearchValue);

    for (const amenity of amenities) {
      const requested = normalizeSearchValue(amenity);

      const found = propertyAmenities.some(
        (item) =>
          item === requested ||
          item.includes(requested) ||
          requested.includes(item),
      );

      if (found) {
        score += 5;
      }
    }
  }

  // =======================================================
  // PARKING
  // =======================================================

  if (
    parking !== undefined &&
    parking !== null &&
    property.parking !== undefined
  ) {
    if (Boolean(parking) === Boolean(property.parking)) {
      score += 8;
    }
  }

  // =======================================================
  // RERA
  // =======================================================

  if (reraNumber && property.reraNumber) {
    const requested = normalizeSearchValue(reraNumber);

    const actual = normalizeSearchValue(property.reraNumber);

    if (
      actual === requested ||
      actual.includes(requested) ||
      requested.includes(actual)
    ) {
      score += 20;
    }
  }

  // =======================================================
  // NEARBY METRO
  // =======================================================

  if (nearbyMetro && property.nearbyMetro) {
    if (textMatches(nearbyMetro, property.nearbyMetro)) {
      score += 8;
    }
  }

  // =======================================================
  // NEARBY SCHOOL
  // =======================================================

  if (nearbySchool && property.nearbySchool) {
    if (textMatches(nearbySchool, property.nearbySchool)) {
      score += 8;
    }
  }

  // =======================================================
  // NEARBY HOSPITAL
  // =======================================================

  if (nearbyHospital && property.nearbyHospital) {
    if (textMatches(nearbyHospital, property.nearbyHospital)) {
      score += 8;
    }
  }

  // =======================================================
  // GENERAL SEARCH TEXT
  // =======================================================

  if (searchText) {
    const searchableText = [
      property.projectName,
      property.builderName,
      property.propertyType,
      property.bhk,
      property.location,
      property.city,
      property.reraNumber,
      property.nearbyMetro,
      property.nearbySchool,
      property.nearbyHospital,
      property.description,
      ...(property.amenities || []),
    ]
      .filter(Boolean)
      .map(normalizeSearchValue)
      .join(" ");

    const words = normalizeSearchValue(searchText).split(" ").filter(Boolean);

    for (const word of words) {
      if (word.length < 2) continue;

      if (searchableText.includes(word)) {
        score += 3;
      }
    }
  }

  return score;
}

// =========================================================
// TEXT MATCH
// =========================================================

function textMatches(requested, actual) {
  const a = normalizeSearchValue(requested);

  const b = normalizeSearchValue(actual);

  return a === b || a.includes(b) || b.includes(a);
}

// =========================================================
// NORMALIZE
// =========================================================

function normalizeSearchValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\bprojects?\b/g, "")
    .replace(/[^\p{L}\p{N}\s.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// =========================================================
// BHK NORMALIZE
// =========================================================

function normalizeBhk(value) {
  return normalizeSearchValue(value).replace(/bhk/g, "").replace(/\s+/g, "");
}

// =========================================================
// FLEXIBLE PROJECT REGEX
// =========================================================

function buildFlexibleRegex(value) {
  const normalized = normalizeSearchValue(value);

  if (!normalized) {
    return /.*/i;
  }

  const words = normalized.split(/\s+/).filter(Boolean).map(escapeRegex);

  return new RegExp(words.join(".*"), "i");
}

// =========================================================
// ESCAPE REGEX
// =========================================================

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// =========================================================
// EXPORT
// =========================================================

module.exports = {
  matchProperties,
};
