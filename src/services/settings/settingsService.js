const Settings = require('../../models/Settings');
const { encrypt, decrypt } = require('../../utils/crypto');

/**
 * Single-tenant deployment — there is exactly ONE Settings document for the
 * whole app (no organizationId scoping). Lazily created on first access.
 */
async function getOrCreateSettings() {
  let settings = await Settings.findOne({}).sort({ createdAt: 1 });
  if (!settings) {
    // Atomic upsert: several webhooks arriving together on a fresh database
    // used to create more than one Settings document.
    settings = await Settings.findOneAndUpdate(
      {},
      { $setOnInsert: { aiPaused: false } },
      { upsert: true, new: true, setDefaultsOnInsert: true, sort: { createdAt: 1 } }
    );
  }
  return settings;
}

/** Public-safe settings (never exposes the raw Gemini key, only whether one is set). */
async function getPublicSettings() {
  const settings = await getOrCreateSettings();
  const withKey = await Settings.findOne({}).select('+geminiApiKeyEncrypted');

  return {
    ...settings.toObject(),
    geminiApiKeyEncrypted: undefined,
    geminiKeyConfigured: !!withKey?.geminiApiKeyEncrypted,
  };
}

async function updateSettings(updates) {
  const settings = await getOrCreateSettings();

  const { geminiApiKey, ...rest } = updates;
  Object.assign(settings, rest);

  if (geminiApiKey !== undefined) {
    settings.geminiApiKeyEncrypted = geminiApiKey ? encrypt(geminiApiKey) : null;
  }

  await settings.save();
  return getPublicSettings();
}

/**
 * Returns the configured Gemini key, falling back to the platform-wide
 * GEMINI_API_KEY env var so the product works out-of-the-box before the
 * broker/builder has configured their own key in Settings.
 */
async function getGeminiKey() {
  const settings = await Settings.findOne({}).select('+geminiApiKeyEncrypted');
  const configuredKey = settings ? decrypt(settings.geminiApiKeyEncrypted) : null;
  return configuredKey || process.env.GEMINI_API_KEY || null;
}

module.exports = { getOrCreateSettings, getPublicSettings, updateSettings, getGeminiKey };
