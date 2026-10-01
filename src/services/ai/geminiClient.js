const logger = require("../../utils/logger");
const ApiError = require("../../utils/ApiError");

/*
 * Gemini REST client (native fetch, Node 18+).
 *
 * Flow: conversationEngine -> generateStructured -> generateContent -> Gemini
 *
 * Reliability notes:
 * - Default model is gemini-2.5-flash. Override with GEMINI_MODEL.
 * - Gemini 2.5 models "think" by default and those thinking tokens count
 *   against maxOutputTokens. With a small token limit the JSON answer gets
 *   cut off half-way ("AI returned an unparseable response"). For 2.5 models
 *   we therefore set a small thinking budget (GEMINI_THINKING_BUDGET, default
 *   0 = off, which is also the fastest for WhatsApp replies).
 * - Temporary errors (429, 5xx, timeouts, network) are retried with backoff.
 */

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS || 1024);
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 20000);
const GEMINI_MAX_RETRIES = Number(process.env.GEMINI_MAX_RETRIES || 2);
const THINKING_BUDGET =
  process.env.GEMINI_THINKING_BUDGET !== undefined
    ? Number(process.env.GEMINI_THINKING_BUDGET)
    : 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildThinkingConfig(model) {
  // Only 2.5-family models accept thinkingBudget. Other models (2.0, 3.x)
  // either don't think or use a different setting, so send nothing for them.
  if (/gemini-2\.5/i.test(model)) {
    // Pro cannot disable thinking entirely; use its minimum budget instead.
    const budget = /pro/i.test(model) ? Math.max(THINKING_BUDGET, 128) : THINKING_BUDGET;
    return { thinkingConfig: { thinkingBudget: budget } };
  }
  return {};
}

function isRetryableStatus(status) {
  return status === 429 || status === 408 || (status >= 500 && status < 600);
}

/**
 * Calls Gemini's generateContent endpoint once and returns the raw text.
 * Throws an Error with `.retryable = true` for temporary failures.
 */
async function callGeminiOnce({ url, body, model }) {
  const startedAt = Date.now();
  let response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
  } catch (err) {
    const e = ApiError.internal(
      err.name === "TimeoutError" ? "Gemini request timed out" : "Failed to reach Gemini API",
    );
    e.retryable = true;
    logger.error("[gemini] Request failed", {
      duration: `${Date.now() - startedAt}ms`,
      error: err.message,
      model,
    });
    throw e;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    logger.error("[gemini] Gemini API returned an error", {
      duration: `${Date.now() - startedAt}ms`,
      status: response.status,
      body: errText.slice(0, 1000),
      model,
    });
    const e = ApiError.internal(`Gemini API error (${response.status})`);
    e.retryable = isRetryableStatus(response.status);
    e.status = response.status;
    throw e;
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    const e = ApiError.internal("Invalid response received from Gemini");
    e.retryable = true;
    throw e;
  }

  const candidate = data?.candidates?.[0];
  const text =
    candidate?.content?.parts
      ?.filter((part) => !part?.thought)
      .map((part) => part?.text || "")
      .join("") || "";

  const finishReason = candidate?.finishReason;
  if (!text || finishReason === "MAX_TOKENS") {
    logger.warn("[gemini] Empty or truncated response from Gemini", {
      duration: `${Date.now() - startedAt}ms`,
      blockReason: data?.promptFeedback?.blockReason,
      finishReason,
      outputLength: text.length,
    });
  }

  logger.info("[gemini] Generation completed", {
    duration: `${Date.now() - startedAt}ms`,
    outputLength: text.length,
    finishReason,
    model,
  });

  return { text, raw: data, finishReason };
}

/**
 * @param {Object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.systemInstruction
 * @param {Array<{role: 'user'|'model', text: string}>} opts.history
 * @param {Object} [opts.responseSchema]
 * @param {number} [opts.temperature]
 */
async function generateContent({
  apiKey,
  systemInstruction,
  history = [],
  responseSchema,
  temperature = 0.7,
  model = DEFAULT_MODEL,
}) {
  if (!apiKey) {
    throw ApiError.badRequest(
      "No Gemini API key configured — add one in Settings before enabling AI conversations",
    );
  }

  const url = `${API_BASE}/${model}:generateContent?key=${apiKey}`;

  const contents = mergeConsecutiveTurns(
    (Array.isArray(history) ? history : []).filter(
      (turn) =>
        turn &&
        (turn.role === "user" || turn.role === "model") &&
        typeof turn.text === "string" &&
        turn.text.trim().length > 0,
    ),
  ).map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] }));

  // Gemini requires the conversation to start with a user turn.
  while (contents.length && contents[0].role !== "user") contents.shift();
  if (!contents.length) {
    contents.push({ role: "user", parts: [{ text: "(conversation start)" }] });
  }

  const body = {
    system_instruction: { parts: [{ text: systemInstruction || "" }] },
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      ...buildThinkingConfig(model),
      ...(responseSchema
        ? { responseMimeType: "application/json", responseJsonSchema: responseSchema }
        : {}),
    },
  };

  let lastErr;
  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    try {
      return await callGeminiOnce({ url, body, model });
    } catch (err) {
      lastErr = err;
      if (!err.retryable || attempt === GEMINI_MAX_RETRIES) break;
      const delay = 1000 * 2 ** attempt + Math.floor(Math.random() * 400);
      logger.warn(`[gemini] Retrying in ${delay}ms (attempt ${attempt + 2}/${GEMINI_MAX_RETRIES + 1})`, {
        error: err.message,
      });
      await sleep(delay);
    }
  }
  throw lastErr;
}

/**
 * WhatsApp users often send several short messages in a row ("hi", "2bhk",
 * "noida"). Gemini works best with alternating user/model turns, so
 * consecutive turns from the same side are joined into one.
 */
function mergeConsecutiveTurns(turns) {
  const merged = [];
  for (const turn of turns) {
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role) {
      last.text = `${last.text}\n${turn.text}`;
    } else {
      merged.push({ role: turn.role, text: turn.text });
    }
  }
  return merged;
}

/** Pulls the first JSON object out of a model response (tolerates ```json fences). */
function parseJsonLoose(text) {
  const cleaned = String(text || "").replace(/```json|```/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("No JSON object found");
  }
}

/**
 * Calls generateContent with a JSON schema and parses the result. A reply
 * that can't be parsed (e.g. cut off) is retried once before giving up.
 */
async function generateStructured(opts) {
  let lastText = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, raw } = await generateContent(opts);
    lastText = text;
    try {
      return { parsed: parseJsonLoose(text), raw };
    } catch (err) {
      logger.warn("[gemini] Could not parse structured JSON response", {
        attempt: attempt + 1,
        text: String(text).slice(0, 300),
      });
    }
  }

  logger.error("[gemini] Failed to parse structured JSON response", {
    text: lastText.slice(0, 500),
  });
  throw ApiError.internal("AI returned an unparseable response");
}

module.exports = {
  generateContent,
  generateStructured,
  parseJsonLoose,
  DEFAULT_MODEL,
};
