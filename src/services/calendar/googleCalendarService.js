const { google } = require('googleapis');
const env = require('../../config/env');
const logger = require('../../utils/logger');

/**
 * Books site-visit meetings straight onto a real Google Calendar.
 *
 * Auth: a Service Account (no per-broker OAuth flow to build/maintain).
 * Setup:
 *   1. Create a Service Account in Google Cloud Console, enable the
 *      Calendar API, and generate a JSON key.
 *   2. Set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY (from that JSON key)
 *      in the environment. GOOGLE_PRIVATE_KEY needs its newlines escaped as
 *      \n when stored as a single-line env var — this module un-escapes them.
 *   3. Open the target Google Calendar's settings -> "Share with specific
 *      people" -> add the service account's email with "Make changes to
 *      events" permission, then set GOOGLE_CALENDAR_ID to that calendar's id
 *      (its address, e.g. yourteam@yourcompany.com, or "primary").
 */

let cachedClient = null;

function isConfigured() {
  return Boolean(env.googleCalendar.clientEmail && env.googleCalendar.privateKey);
}

function getCalendarClient() {
  if (!isConfigured()) return null;
  if (cachedClient) return cachedClient;

  const auth = new google.auth.JWT({
    email: env.googleCalendar.clientEmail,
    key: env.googleCalendar.privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  cachedClient = google.calendar({ version: 'v3', auth });
  return cachedClient;
}

/**
 * Builds Google Calendar start/end for a "YYYY-MM-DD" + "HH:mm" in
 * GOOGLE_CALENDAR_TIMEZONE.
 *
 * Bug fixed: the old code did new Date(`${date}T${time}`).toISOString(),
 * which reads the time in the SERVER's timezone and sends it as UTC ("Z").
 * On a UTC server (Render, Railway, most VPS) an 11:00 IST visit was booked
 * at 16:30 IST. Google treats a dateTime WITHOUT an offset as local to the
 * given timeZone, so we send plain wall-clock strings instead.
 */
function toStartEnd(date, time) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = String(time).split(':').map(Number);
  const startMs = Date.UTC(y, mo - 1, d, h, mi || 0);
  const endMs = startMs + env.googleCalendar.defaultDurationMin * 60_000;
  const wallClock = (ms) => new Date(ms).toISOString().slice(0, 19); // "YYYY-MM-DDTHH:mm:ss", no "Z"
  return { start: wallClock(startMs), end: wallClock(endMs) };
}

/**
 * Creates a calendar event for a confirmed site visit.
 * Returns { eventId, eventLink } or null if Calendar isn't configured
 * (logs a warning in that case rather than throwing, so a missing Calendar
 * setup never blocks the WhatsApp conversation itself).
 */
async function createCalendarEvent({ summary, description, date, time, attendeeEmail }) {
  const calendar = getCalendarClient();
  if (!calendar) {
    logger.warn('[calendar] Google Calendar is not configured (GOOGLE_CLIENT_EMAIL/GOOGLE_PRIVATE_KEY) — skipping event creation');
    return null;
  }

  const { start, end } = toStartEnd(date, time);

  const requestBody = {
    summary,
    description,
    start: { dateTime: start, timeZone: env.googleCalendar.timezone },
    end: { dateTime: end, timeZone: env.googleCalendar.timezone },
  };
  if (attendeeEmail) requestBody.attendees = [{ email: attendeeEmail }];

  const { data } = await calendar.events.insert({
    calendarId: env.googleCalendar.calendarId,
    requestBody,
  });

  return { eventId: data.id, eventLink: data.htmlLink };
}

/** Updates an existing event's date/time (used when a broker reschedules a site visit). */
async function updateCalendarEvent({ eventId, date, time }) {
  const calendar = getCalendarClient();
  if (!calendar || !eventId) return null;

  const { start, end } = toStartEnd(date, time);

  const { data } = await calendar.events.patch({
    calendarId: env.googleCalendar.calendarId,
    eventId,
    requestBody: {
      start: { dateTime: start, timeZone: env.googleCalendar.timezone },
      end: { dateTime: end, timeZone: env.googleCalendar.timezone },
    },
  });

  return { eventId: data.id, eventLink: data.htmlLink };
}

/** Deletes/cancels a calendar event (used when a site visit is cancelled). */
async function deleteCalendarEvent(eventId) {
  const calendar = getCalendarClient();
  if (!calendar || !eventId) return;

  try {
    await calendar.events.delete({ calendarId: env.googleCalendar.calendarId, eventId });
  } catch (err) {
    // Already deleted / not found is fine to ignore; anything else, log it.
    if (err?.code !== 404 && err?.code !== 410) {
      logger.error('[calendar] Failed to delete Google Calendar event', { error: err.message, eventId });
    }
  }
}

module.exports = { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, isConfigured };
