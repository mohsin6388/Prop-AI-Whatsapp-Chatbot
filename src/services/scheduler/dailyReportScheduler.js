const Settings = require('../../models/Settings');
const { sendDailySummary } = require('../reports/dailySummaryService');
const logger = require('../../utils/logger');

const TIMEZONE = process.env.DAILY_REPORT_TIMEZONE || process.env.GOOGLE_CALENDAR_TIMEZONE || 'Asia/Kolkata'; // same zone used for Google Calendar bookings elsewhere in this app
const CHECK_INTERVAL_MS = 60 * 1000; // check once a minute

function nowInTimezone() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  return {
    dateStr: `${parts.year}-${parts.month}-${parts.day}`, // 'YYYY-MM-DD'
    hhmm: `${parts.hour}:${parts.minute}`, // 'HH:mm'
  };
}

/**
 * Runs every minute: single-tenant app, so there's at most one Settings
 * document — checks if the daily report is switched on, whether the
 * configured send time matches right now (to the minute), and that it
 * hasn't already been sent today — then sends it and stamps the date so it
 * doesn't fire again for the rest of the day.
 */
const RETRY_AFTER_FAIL_MS = 15 * 60 * 1000;
let lastFailedAttemptAt = 0;

async function tick() {
  const { dateStr, hhmm } = nowInTimezone();

  // "Time reached and not yet sent today" instead of "time equals this exact
  // minute": setInterval drifts, and a restart or a busy event loop at
  // 19:00 used to skip the report for the whole day.
  const candidates = await Settings.find({
    dailyReportEnabled: true,
    dailyReportPhone: { $nin: [null, ''] },
  }).select('+dailyReportLastSentDate');

  for (const settings of candidates) {
    const sendAt = normalizeHhmm(settings.dailyReportTime || '19:00');
    if (hhmm < sendAt) continue; // not time yet today
    if (settings.dailyReportLastSentDate === dateStr) continue; // already sent today
    if (Date.now() - lastFailedAttemptAt < RETRY_AFTER_FAIL_MS) continue; // back off after a failure

    try {
      await sendDailySummary({
        phone: settings.dailyReportPhone,
        timezone: TIMEZONE,
      });
      settings.dailyReportLastSentDate = dateStr;
      await settings.save();
    } catch (err) {
      lastFailedAttemptAt = Date.now();
      logger.error('[reports] Failed to send daily summary (will retry in 15 min)', { error: err.message });
    }
  }
}

/** "9:5" / "09:05" -> "09:05" so string comparison works. */
function normalizeHhmm(value) {
  const [h = '0', m = '0'] = String(value).split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

let intervalHandle = null;

function startDailyReportScheduler() {
  if (intervalHandle) return;
  intervalHandle = setInterval(() => {
    tick().catch((err) => logger.error('[reports] Daily report scheduler tick failed', { error: err.message }));
  }, CHECK_INTERVAL_MS);
  logger.info(`[reports] Daily report scheduler started (checking every minute, timezone=${TIMEZONE})`);
}

function stopDailyReportScheduler() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}

module.exports = { startDailyReportScheduler, stopDailyReportScheduler, tick };
