// const Lead = require("../../models/Lead");
// const Conversation = require("../../models/Conversation");
// const Message = require("../../models/Message");
// const Meeting = require("../../models/Meeting");
// const Notification = require("../../models/Notification");
// const OutboundJob = require("../../models/OutboundJob");

// const settingsService = require("../settings/settingsService");
// const metaWhatsappClient = require("../whatsapp/metaWhatsappClient");
// const { recordOutboundMessage } = require("../whatsapp/messageStore");
// const { matchProperties } = require("./propertyMatcher");
// const { generateStructured } = require("./geminiClient");
// const {
//   buildSystemInstruction,
//   REPLY_RESPONSE_SCHEMA,
//   toGeminiHistory,
// } = require("./promptBuilder");
// const { normalizeAiResult } = require("./aiResultAdapter");
// const { analyzeConversationAsync } = require("./leadAnalyzer");
// const {
//   createCalendarEvent,
//   updateCalendarEvent,
// } = require("../calendar/googleCalendarService");
// const { enqueueLeads } = require("../queue/outboundQueue");
// const env = require("../../config/env");
// const { emitToUser } = require("../../sockets");
// const logger = require("../../utils/logger");

// // Most recent messages sent as context per turn. 20 keeps enough memory for a
// // full qualification chat; key facts are also carried in collectedRequirements.
// const HISTORY_LIMIT = parseInt(process.env.AI_HISTORY_LIMIT || "20", 10);

// // People on WhatsApp often send 2-4 short messages in a row ("hi", "2bhk
// // chahiye", "noida me"). We wait this long after the LAST message before
// // replying, so Monica answers once, with all of it in mind, instead of
// // firing 3 separate (and often contradictory) replies.
// const REPLY_DEBOUNCE_MS = parseInt(
//   process.env.AI_REPLY_DEBOUNCE_MS || "3000",
//   10,
// );

// // Sent when Gemini is down / out of quota after all retries, so the customer
// // is never left on "seen". Set AI_FALLBACK_REPLY=off to disable.
// const FALLBACK_REPLY =
//   process.env.AI_FALLBACK_REPLY ||
//   "Thanks for your message! 🙏 Our team will get back to you shortly.";
// const FALLBACK_COOLDOWN_MS = 30 * 60 * 1000;

// const DEFAULT_REFERRAL_NUMBER = "8750200899";

// // ---------------------------------------------------------------------------
// // Per-conversation scheduling: debounce bursts + never run two AI turns for
// // the same chat at the same time (that caused double / out-of-order replies).
// // This is in-process, which is correct for a single Node instance. If you ever
// // run several instances, put a shared lock (e.g. Redis) in front of this.
// // ---------------------------------------------------------------------------

// const turnState = new Map(); // conversationId -> { timer, running, rerun }
// const lastFallbackAt = new Map(); // conversationId -> ms

// function scheduleInbound(conversationId, delayMs = REPLY_DEBOUNCE_MS) {
//   const id = String(conversationId);
//   const state = turnState.get(id) || {
//     timer: null,
//     running: false,
//     rerun: false,
//   };
//   if (state.timer) clearTimeout(state.timer);
//   state.timer = setTimeout(() => runTurn(id), delayMs);
//   turnState.set(id, state);
// }

// async function runTurn(id) {
//   const state = turnState.get(id);
//   if (!state) return;
//   state.timer = null;

//   if (state.running) {
//     // A reply is being generated right now; answer the new message(s) right
//     // after it finishes.
//     state.rerun = true;
//     return;
//   }

//   state.running = true;
//   try {
//     await processTurn(id);
//   } catch (err) {
//     logger.error(`[ai] Conversation turn failed for conversation ${id}`, {
//       error: err.message,
//       stack: err.stack,
//     });
//   } finally {
//     state.running = false;
//     if (state.rerun) {
//       state.rerun = false;
//       scheduleInbound(id, 500);
//     } else if (!state.timer) {
//       turnState.delete(id);
//     }
//   }
// }

// /**
//  * Backwards-compatible entry point (old code awaited this per message).
//  * It now just schedules a debounced turn for the conversation.
//  */
// async function handleInbound({ conversation }) {
//   scheduleInbound(conversation._id);
// }

// function isPlaceholderName(name, phone) {
//   if (!name) return true;
//   const digits = String(phone || "").replace(/\D/g, "");
//   return (
//     /^whatsapp\s*\+?\d+$/i.test(name.trim()) ||
//     (digits && name.replace(/\D/g, "") === digits)
//   );
// }

// function buildRequirementsSummary(r) {
//   return [
//     r.purpose,
//     [r.bhk, r.propertyType].filter(Boolean).join(" "),
//     [r.location, r.city].filter(Boolean).join(", "),
//     r.budgetText && `budget ${r.budgetText}`,
//     r.timeline && `timeline ${r.timeline}`,
//   ]
//     .filter(Boolean)
//     .join(" | ");
// }

// async function processTurn(conversationId) {
//   const conversation = await Conversation.findById(conversationId);
//   if (!conversation) return;

//   // Only chats the AI owns. "manual" = broker took over, "paused"/"closed" =
//   // AI must stay quiet.
//   if (conversation.status !== "ai_active") return;

//   const lead = await Lead.findById(conversation.leadId);
//   if (!lead) return;

//   const settings = await settingsService.getOrCreateSettings();
//   if (settings.aiPaused || !settings.autoReplyEnabled) return;
//   if (settings.whatsappDisconnected) return;

//   const recentMessages = await Message.find({
//     conversationId: conversation._id,
//   })
//     .sort({ timestamp: -1, _id: -1 })
//     .limit(HISTORY_LIMIT)
//     .lean();
//   recentMessages.reverse(); // oldest -> newest for the model

//   // Nothing new to answer (e.g. the burst was already answered in a previous
//   // turn, or a broker replied by hand in the meantime).
//   const last = recentMessages[recentMessages.length - 1];
//   if (!last || last.direction !== "inbound") return;

//   const apiKey = await settingsService.getGeminiKey();
//   if (!apiKey) {
//     logger.warn(
//       `[ai] No Gemini API key configured — skipping AI reply for lead ${lead._id}`,
//     );
//     await notifyOwner(conversation, lead, {
//       type: "whatsapp_send_failed",
//       title: `AI could not reply to ${lead.name || lead.phone}`,
//       body: "No Gemini API key is configured. Add it in Settings or GEMINI_API_KEY.",
//     });
//     return;
//   }

//   const requirements = conversation.collectedRequirements
//     ? conversation.toObject().collectedRequirements || {}
//     : {};

//   const candidateProperties = await matchProperties({
//     projectName: requirements.projectName,
//     city: requirements.city || lead.city,
//     location: requirements.location || lead.location,
//     budgetMin: requirements.budgetMin ?? lead.budgetMin,
//     budgetMax: requirements.budgetMax ?? lead.budgetMax,
//     bhk: requirements.bhk,
//     propertyType: requirements.propertyType,
//     sizeSqft: requirements.sizeSqft,
//     amenities: requirements.amenities,
//     parking: requirements.parking,
//     reraNumber: requirements.reraNumber,
//     nearbyMetro: requirements.nearbyMetro,
//     nearbySchool: requirements.nearbySchool,
//     nearbyHospital: requirements.nearbyHospital,
//   });

//   const referralEnabled = settings.referral?.enabled ?? env.referral.enabled;
//   const referralPersonName =
//     settings.referral?.personName || env.referral.personName;
//   const referralContactNumber =
//     settings.referral?.contactNumber ||
//     env.referral.contactNumber ||
//     DEFAULT_REFERRAL_NUMBER;
//   const timezone = env.googleCalendar.timezone;

//   const systemInstruction = buildSystemInstruction({
//     lead,
//     settings,
//     collectedRequirements: requirements,
//     matchedProperties: candidateProperties,
//     // Referral switched off in Settings -> tell the prompt the offer is
//     // already done, so Monica never asks it.
//     referralStatus: referralEnabled
//       ? conversation.referralStatus || "none"
//       : "declined",
//     referralPersonName,
//     referralContactNumber,
//     timezone,
//   });

//   let result;
//   try {
//     result = await generateStructured({
//       apiKey,
//       systemInstruction,
//       history: toGeminiHistory(recentMessages),
//       responseSchema: REPLY_RESPONSE_SCHEMA,
//     });
//   } catch (err) {
//     logger.error(`[ai] Gemini reply generation failed for lead ${lead._id}`, {
//       error: err.message,
//     });
//     await sendFallbackReply({ conversation, lead });
//     return;
//   }

//   const ai = normalizeAiResult(result.parsed, { timezone });
//   if (!ai.reply) {
//     logger.warn(`[ai] Gemini returned an empty reply for lead ${lead._id}`);
//     await sendFallbackReply({ conversation, lead });
//     return;
//   }

//   // Re-check right before sending: the broker may have pressed "Take over"
//   // while Gemini was thinking.
//   const fresh = await Conversation.findById(conversation._id)
//     .select("status")
//     .lean();
//   if (!fresh || fresh.status !== "ai_active") return;

//   // ---- Remember what we learned (never overwrite known facts with blanks) ----
//   const mergedRequirements = mergeRequirements(
//     requirements,
//     ai.extractedRequirements,
//   );
//   conversation.collectedRequirements = mergedRequirements;
//   conversation.lastIntent = ai.intent;
//   conversation.lastSentiment = ai.sentiment;
//   if (ai.interestLevel) conversation.interestLevel = ai.interestLevel;
//   if (ai.leadType) conversation.leadType = ai.leadType;
//   if (ai.verified) conversation.verified = true;
//   if (candidateProperties.length) {
//     conversation.recommendedProperties = candidateProperties.map((p) => p._id);
//   }

//   // ---- Referral / "Monica as your assistant" offer state machine ----
//   if (referralEnabled) {
//     if (
//       conversation.referralStatus === "none" &&
//       ai.referralStage === "ask_now"
//     ) {
//       conversation.referralStatus = "asked";
//       conversation.referralAskedAt = new Date();
//     } else if (
//       conversation.referralStatus === "asked" &&
//       ai.referralStage === "accepted"
//     ) {
//       conversation.referralStatus = "accepted";
//       conversation.referralRespondedAt = new Date();
//     } else if (
//       conversation.referralStatus === "asked" &&
//       ai.referralStage === "declined"
//     ) {
//       conversation.referralStatus = "declined";
//       conversation.referralRespondedAt = new Date();
//     }
//   }

//   // ---- Mirror key fields onto the Lead for list / filter / CSV export ----
//   const leadUpdates = {};
//   if (
//     ai.name &&
//     ai.name !== lead.name &&
//     (isPlaceholderName(lead.name, lead.phone) ||
//       (lead.whatsappProfileName && lead.name === lead.whatsappProfileName))
//   ) {
//     leadUpdates.name = ai.name;
//   }
//   if (mergedRequirements.city) leadUpdates.city = mergedRequirements.city;
//   if (mergedRequirements.location)
//     leadUpdates.location = mergedRequirements.location;
//   if (mergedRequirements.budgetMin != null)
//     leadUpdates.budgetMin = mergedRequirements.budgetMin;
//   if (mergedRequirements.budgetMax != null)
//     leadUpdates.budgetMax = mergedRequirements.budgetMax;
//   const summary = buildRequirementsSummary(mergedRequirements);
//   if (summary && (!lead.requirements || lead.requirements.startsWith("AI: "))) {
//     leadUpdates.requirements = `AI: ${summary}`;
//   }
//   if (lead.status === "new") leadUpdates.status = "contacted";
//   if (Object.keys(leadUpdates).length) {
//     await Lead.updateOne({ _id: lead._id }, { $set: leadUpdates });
//     Object.assign(lead, leadUpdates);
//   }

//   // ---- Send the reply ----
//   let outbound;
//   try {
//     const { messageId } = await metaWhatsappClient.sendToLead({
//       phone: lead.phone,
//       text: ai.reply,
//     });

//     outbound = await recordOutboundMessage({
//       conversationId: conversation._id,
//       leadId: lead._id,
//       text: ai.reply,
//       sender: "ai",
//       whatsappMessageId: messageId || null,
//       aiPrompt:
//         process.env.AI_STORE_PROMPTS === "true" ? systemInstruction : null,
//       aiResponseRaw: result.parsed,
//       intent: ai.intent,
//       sentiment: ai.sentiment,
//     });
//   } catch (err) {
//     logger.error(
//       `[ai] Failed to send AI reply for lead ${lead._id} via Meta WhatsApp Cloud API`,
//       {
//         error: err.metaError || err.response?.data || err.message,
//         code: err.code,
//       },
//     );
//     await conversation.save(); // keep the requirements we just learned
//     await notifyOwner(conversation, lead, {
//       type: "whatsapp_send_failed",
//       title: `Couldn't message ${lead.name || "lead"} — WhatsApp send failed`,
//       body:
//         err.code === "WHATSAPP_24H_WINDOW_CLOSED"
//           ? `The 24-hour WhatsApp window for ${lead.phone} is closed. Send an approved template first.`
//           : `Sending via WhatsApp failed for ${lead.phone}: ${err.message}`,
//     });
//     return;
//   }

//   // ---- Site visit: only book once BOTH a valid date and time are known ----
//   if (ai.wantsSiteVisit) {
//     if (ai.proposedDate && ai.proposedTime) {
//       await createSiteVisit({
//         lead,
//         conversation,
//         date: ai.proposedDate,
//         time: ai.proposedTime,
//         property: pickProperty(candidateProperties, ai.propertyReference),
//       });
//     } else if (conversation.meetingStatus === "none") {
//       conversation.meetingStatus = "proposed";
//     }
//   }

//   conversation.requirementsComplete = ai.readyForPropertyRecommendation;
//   await conversation.save();

//   emitToUser(conversation.ownerId, "conversation:aiReply", {
//     conversationId: conversation._id,
//     leadId: lead._id,
//     message: outbound,
//   });

//   if (ai.leadType === "realtor_prospect" && ai.verified) {
//     await notifyOwner(conversation, lead, {
//       type: "hot_lead",
//       title: `Realtor interested in Monica — ${lead.name || lead.phone}`,
//       body: "This person looks interested in using Monica for their own business.",
//       once: `realtor:${conversation._id}`,
//     });
//   }

//   // Lead scoring + follow-up planning runs as a separate Gemini pass, async.
//   analyzeConversationAsync({
//     leadId: lead._id,
//     conversationId: conversation._id,
//   }).catch((err) =>
//     logger.error(`[ai] Async lead analysis failed for lead ${lead._id}`, {
//       error: err.message,
//     }),
//   );
// }

// function pickProperty(candidates, reference) {
//   if (!candidates?.length) return undefined;
//   if (reference) {
//     const ref = reference.toLowerCase();
//     const hit = candidates.find(
//       (p) =>
//         p.projectName &&
//         (ref.includes(p.projectName.toLowerCase()) ||
//           p.projectName.toLowerCase().includes(ref)),
//     );
//     if (hit) return hit;
//   }
//   return candidates[0];
// }

// const notifiedOnce = new Set();

// async function notifyOwner(conversation, lead, { type, title, body, once }) {
//   if (once) {
//     if (notifiedOnce.has(once)) return;
//     notifiedOnce.add(once);
//   }
//   try {
//     await Notification.create({
//       userId: conversation.ownerId,
//       type,
//       title,
//       body,
//       link: `/leads/${lead._id}`,
//     });
//     emitToUser(conversation.ownerId, "notification:new", { leadId: lead._id });
//   } catch (err) {
//     logger.warn("[ai] Could not create notification", { error: err.message });
//   }
// }

// /** Keeps the customer from being left on "seen" when the AI is unavailable. */
// async function sendFallbackReply({ conversation, lead }) {
//   await notifyOwner(conversation, lead, {
//     type: "whatsapp_send_failed",
//     title: `AI could not reply to ${lead.name || lead.phone}`,
//     body: "Gemini did not respond (quota, key or outage). Please reply manually from Conversations.",
//   });

//   if (!FALLBACK_REPLY || FALLBACK_REPLY.toLowerCase() === "off") return;
//   const id = String(conversation._id);
//   if (Date.now() - (lastFallbackAt.get(id) || 0) < FALLBACK_COOLDOWN_MS) return;
//   lastFallbackAt.set(id, Date.now());

//   try {
//     const { messageId } = await metaWhatsappClient.sendToLead({
//       phone: lead.phone,
//       text: FALLBACK_REPLY,
//     });
//     const outbound = await recordOutboundMessage({
//       conversationId: conversation._id,
//       leadId: lead._id,
//       text: FALLBACK_REPLY,
//       sender: "ai",
//       whatsappMessageId: messageId || null,
//     });
//     emitToUser(conversation.ownerId, "conversation:aiReply", {
//       conversationId: conversation._id,
//       leadId: lead._id,
//       message: outbound,
//     });
//   } catch (err) {
//     logger.error(`[ai] Fallback reply also failed for lead ${lead._id}`, {
//       error: err.message,
//     });
//   }
// }

// /**
//  * Sends the very first outbound WhatsApp message to a lead.
//  *
//  * Ab yeh function queue worker (services/queue/bulkWorker.js) ke liye
//  * banaya gaya hai, isliye:
//  *   - Success par        -> { sent: true, usedTemplate }
//  *   - Skip karna pade to -> { skipped: true, reason }
//  *       reasons: not_ai_active | already_started | ai_paused | whatsapp_disconnected
//  *   - Koi bhi ERROR par  -> THROW karta hai (err.code / err.metaError ke saath),
//  *       taaki worker retry ya fail decide kar sake. Yahan koi error nigla nahi jata.
//  *
//  * Idempotent: agar outbound message pehle se ja chuka hai to dobara nahi bhejta
//  * (isse retry par double message nahi jayega).
//  */
// async function startConversation({ lead, conversation }) {
//   if (conversation.status !== "ai_active") {
//     return { skipped: true, reason: "not_ai_active" };
//   }

//   const alreadyStarted = await Message.exists({
//     conversationId: conversation._id,
//     direction: "outbound",
//   });
//   if (alreadyStarted) return { skipped: true, reason: "already_started" };

//   if (!env.metaWhatsapp.accessToken || !env.metaWhatsapp.phoneNumberId) {
//     const err = new Error(
//       "Meta WhatsApp Cloud API is not configured (META_WHATSAPP_ACCESS_TOKEN / META_WHATSAPP_PHONE_NUMBER_ID)",
//     );
//     err.code = "META_NOT_CONFIGURED";
//     throw err;
//   }

//   const settings = await settingsService.getOrCreateSettings();
//   if (settings.aiPaused || !settings.autoReplyEnabled) {
//     return { skipped: true, reason: "ai_paused" };
//   }
//   if (settings.whatsappDisconnected) {
//     return { skipped: true, reason: "whatsapp_disconnected" };
//   }

//   const openingText =
//     settings.openingText ||
//     env.metaWhatsapp.openingText ||
//     settings.greetingMessage ||
//     "Hi! Thanks for your interest. I'm here to help you find the right property 🙂";

//   let outbound = null;
//   let usedTemplate = false;

//   try {
//     const lastInboundAt = conversation.lastInboundAt
//       ? new Date(conversation.lastInboundAt)
//       : null;

//     const isWindowOpen =
//       lastInboundAt &&
//       !Number.isNaN(lastInboundAt.getTime()) &&
//       Date.now() - lastInboundAt.getTime() < 24 * 60 * 60 * 1000;

//     if (isWindowOpen) {
//       // Customer ne last 24 hours mein message kiya hai: normal text allowed.
//       const { messageId } = await metaWhatsappClient.sendTextMessage({
//         phone: lead.phone,
//         text: openingText,
//       });

//       outbound = await recordOutboundMessage({
//         conversationId: conversation._id,
//         leadId: lead._id,
//         text: openingText,
//         sender: "ai",
//         whatsappMessageId: messageId || null,
//       });

//       logger.info(
//         `[ai] Opening text sent via Meta Cloud API for lead ${lead._id}`,
//         { phone: lead.phone, reason: "24h-window-open" },
//       );
//     } else {
//       // New lead / closed 24-hour window: approved template first.
//       // ENV value takes priority over an old template saved in Settings.
//       const templateName =
//         env.metaWhatsapp.openingTemplateName || settings.openingTemplate?.name;

//       const templateLanguage =
//         env.metaWhatsapp.openingTemplateLanguage ||
//         settings.openingTemplate?.language;

//       if (!templateName) {
//         const err = new Error(
//           "Opening template is not configured. Set META_WHATSAPP_OPENING_TEMPLATE_NAME.",
//         );
//         err.code = "OPENING_TEMPLATE_MISSING";
//         throw err;
//       }

//       const components = [];

//       // Use this only if the approved template has an IMAGE header.
//       const imageUrl = process.env.META_WHATSAPP_OPENING_TEMPLATE_IMAGE_URL;

//       if (imageUrl) {
//         components.push({
//           type: "header",
//           parameters: [
//             {
//               type: "image",
//               image: { link: imageUrl },
//             },
//           ],
//         });
//       }

//       const { messageId } = await metaWhatsappClient.sendTemplateMessage({
//         phone: lead.phone,
//         templateName,
//         languageCode: templateLanguage,
//         components,
//       });

//       outbound = await recordOutboundMessage({
//         conversationId: conversation._id,
//         leadId: lead._id,
//         text: `[Template: ${templateName}]`,
//         sender: "ai",
//         whatsappMessageId: messageId || null,
//       });

//       usedTemplate = true;

//       logger.info(`[ai] Opening WhatsApp template sent for lead ${lead._id}`, {
//         templateName,
//         templateLanguage,
//         reason: "24h-window-closed",
//       });
//     }
//   } catch (err) {
//     logger.error(
//       `[ai] Failed to send opening WhatsApp message for lead ${lead._id}`,
//       {
//         error: err.metaError || err.response?.data || err.message,
//         code: err.code,
//         phone: lead.phone,
//       },
//     );
//     // IMPORTANT: error ko nigalna nahi hai — worker ko pata chalna chahiye.
//     throw err;
//   }

//   conversation.templateSent = usedTemplate;
//   conversation.templateSentAt = usedTemplate ? new Date() : null;
//   conversation.lastMessageAt = new Date();
//   await conversation.save();

//   emitToUser(conversation.ownerId, "conversation:aiReply", {
//     conversationId: conversation._id,
//     leadId: lead._id,
//     message: outbound,
//   });

//   return { sent: true, usedTemplate };
// }

// /**
//  * Broker ke woh leads dhundhta hai jinka conversation ai_active hai lekin
//  * abhi tak koi message nahi gaya, aur unhe QUEUE mein daal deta hai.
//  * (Ab seedha message nahi bhejta — isse 100+ leads par parallel burst nahi hoga.)
//  *
//  * Skip karta hai:
//  *   - jinka message pehle se ja chuka hai
//  *   - jinka job pehle 'failed' ya 'cancelled' ho chuka hai
//  *     (warna har server restart par woh dobara queue mein aa jate)
//  *   - jinka job abhi pending/processing/paused hai (enqueueLeads khud handle karta hai)
//  */
// async function catchUpPendingConversations(brokerId) {
//   const pending = await Conversation.find({
//     ownerId: brokerId,
//     status: "ai_active",
//   })
//     .select("_id leadId")
//     .lean();
//   if (!pending.length) return;

//   const conversationIds = pending.map((c) => c._id);
//   const leadIds = pending.map((c) => c.leadId);

//   const [withMessages, blockedLeadIds] = await Promise.all([
//     Message.distinct("conversationId", {
//       conversationId: { $in: conversationIds },
//     }),
//     OutboundJob.distinct("leadId", {
//       leadId: { $in: leadIds },
//       status: { $in: ["failed", "cancelled"] },
//     }),
//   ]);

//   const hasMessageSet = new Set(withMessages.map(String));
//   const blockedSet = new Set(blockedLeadIds.map(String));

//   const toQueue = pending
//     .filter(
//       (c) =>
//         !hasMessageSet.has(String(c._id)) && !blockedSet.has(String(c.leadId)),
//     )
//     .map((c) => c.leadId);

//   if (!toQueue.length) return;

//   const { queued } = await enqueueLeads({
//     ownerId: brokerId,
//     leadIds: toQueue,
//   });

//   if (queued) {
//     logger.info(
//       `[ai] Catch-up: ${queued} pending conversation(s) queued for broker ${brokerId}`,
//     );
//   }
// }

// function mergeRequirements(existing, incoming = {}) {
//   const merged = { ...existing };
//   for (const [key, value] of Object.entries(incoming)) {
//     if (value === undefined || value === null || value === "") continue;
//     if (Array.isArray(value) && value.length === 0) continue;
//     merged[key] = value;
//   }
//   return merged;
// }

// /**
//  * Creates a Meeting the first time a buyer agrees to a site visit for this
//  * lead, and simply UPDATES that same Meeting on every later turn instead of
//  * inserting a new one — e.g. if the AI re-confirms the date/time again a
//  * few messages later, or the buyer changes the time mid-conversation. Only
//  * an already-finished meeting (visited / not_visited / cancelled) is left
//  * alone and a fresh one started, since that's a genuinely new visit.
//  */
// async function createSiteVisit({ lead, conversation, date, time, property }) {
//   const preferredDate =
//     date || new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10); // default: 2 days out if not specified yet
//   const preferredTime = time || "11:00";

//   let meeting = await Meeting.findOne({
//     leadId: lead._id,
//     status: { $in: ["scheduled", "rescheduled"] },
//   }).sort({ createdAt: -1 });

//   let isNew = false;
//   if (meeting) {
//     meeting.preferredDate = preferredDate;
//     meeting.preferredTime = preferredTime;
//     if (property?._id) meeting.propertyId = property._id;
//     meeting.status = "scheduled";
//     await meeting.save();
//   } else {
//     isNew = true;
//     meeting = await Meeting.create({
//       leadId: lead._id,
//       ownerId: conversation.ownerId,
//       propertyId: property?._id || null,
//       preferredDate,
//       preferredTime,
//       status: "scheduled",
//     });
//   }

//   // Cached copy on Conversation for quick UI reads — Meeting model remains
//   // the source of truth. Keep this in sync any time Meeting.status changes
//   // elsewhere too (e.g. a broker marking a visit as done/cancelled).
//   conversation.meetingStatus = "scheduled";
//   await Lead.updateOne({ _id: lead._id }, { $set: { status: "site_visit" } });

//   // Book/update the real calendar event. Best-effort: a Calendar failure
//   // must never block the WhatsApp conversation or lose the Meeting record.
//   try {
//     if (meeting.googleEventId) {
//       const event = await updateCalendarEvent({
//         eventId: meeting.googleEventId,
//         date: preferredDate,
//         time: preferredTime,
//       });
//       if (event) {
//         meeting.googleEventLink = event.eventLink;
//         await meeting.save();
//       }
//     } else {
//       const event = await createCalendarEvent({
//         summary: `Site Visit — ${lead.name || lead.phone}${property ? ` (${property.projectName})` : ""}`,
//         description: [
//           `Lead: ${lead.name || "N/A"} (${lead.phone})`,
//           property
//             ? `Property: ${property.projectName}, ${property.city || ""}`
//             : null,
//           "Booked automatically by the AI WhatsApp assistant.",
//         ]
//           .filter(Boolean)
//           .join("\n"),
//         date: preferredDate,
//         time: preferredTime,
//       });
//       if (event) {
//         meeting.googleEventId = event.eventId;
//         meeting.googleEventLink = event.eventLink;
//         await meeting.save();
//       }
//     }
//   } catch (err) {
//     logger.error(
//       `[calendar] Failed to sync Google Calendar event for lead ${lead._id}`,
//       { error: err.message },
//     );
//   }

//   if (isNew) {
//     await Notification.create({
//       userId: conversation.ownerId,
//       type: "site_visit_scheduled",
//       title: `Site visit scheduled — ${lead.name}`,
//       body: `${preferredDate} at ${preferredTime}${property ? ` for ${property.projectName}` : ""}`,
//       link: `/leads/${lead._id}`,
//     });
//   }

//   emitToUser(conversation.ownerId, "meeting:created", { meeting });

//   return meeting;
// }

// module.exports = {
//   handleInbound,
//   scheduleInbound,
//   processTurn,
//   createSiteVisit,
//   startConversation,
//   catchUpPendingConversations,
// };

const Lead = require("../../models/Lead");
const Conversation = require("../../models/Conversation");
const Message = require("../../models/Message");
const Meeting = require("../../models/Meeting");
const Notification = require("../../models/Notification");
const OutboundJob = require("../../models/OutboundJob");

const settingsService = require("../settings/settingsService");
const metaWhatsappClient = require("../whatsapp/metaWhatsappClient");
const { recordOutboundMessage } = require("../whatsapp/messageStore");
const { matchProperties } = require("./propertyMatcher");
const { generateStructured } = require("./geminiClient");

const {
  buildSystemInstruction,
  REPLY_RESPONSE_SCHEMA,
  toGeminiHistory,
} = require("./promptBuilder");

const { analyzeConversationAsync } = require("./leadAnalyzer");

const {
  createCalendarEvent,
  updateCalendarEvent,
} = require("../calendar/googleCalendarService");

const { enqueueLeads } = require("../queue/outboundQueue");

const env = require("../../config/env");
const { emitToUser } = require("../../sockets");
const logger = require("../../utils/logger");

const HISTORY_LIMIT = 12;

/**
 * Detect whether customer is asking for other properties
 * instead of continuing with the currently discussed project.
 */
function isAskingForOtherProperties(text = "") {
  const value = String(text).trim().toLowerCase();

  if (!value) {
    return false;
  }

  const patterns = [
    "iske alawa",
    "is ke alawa",
    "iske ilawa",
    "is ke ilawa",
    "aur koi property",
    "aur koi properties",
    "koi aur property",
    "koi aur properties",
    "aur property hai",
    "aur properties hai",
    "other property",
    "other properties",
    "another property",
    "another properties",
    "apart from",
    "besides",
  ];

  return patterns.some((pattern) => value.includes(pattern));
}

/**
 * Detect whether customer is asking for all available properties.
 */
function isAskingForAllProperties(text = "") {
  const value = String(text).trim().toLowerCase();

  if (!value) {
    return false;
  }

  const patterns = [
    "kaun kaun si property",
    "kon kon si property",
    "kaun kaun si properties",
    "kon kon si properties",
    "konsi property",
    "kaunsi property",
    "kaun si property",
    "koi property hai",
    "koi properties hai",
    "available properties",
    "all properties",
    "all property",
    "property batao",
    "properties batao",
    "property dikhao",
    "properties dikhao",
    "property list",
    "properties list",
  ];

  return patterns.some((pattern) => value.includes(pattern));
}

/**
 * Detect whether customer is asking about a specific project.
 */
function isSpecificPropertyQuestion(text = "") {
  const value = String(text).trim().toLowerCase();

  if (!value) {
    return false;
  }

  const patterns = [
    "project",
    "property",
    "details",
    "detail",
    "rera",
    "price",
    "rate",
    "sqft",
    "square feet",
    "size",
    "parking",
    "amenities",
    "builder",
    "location",
    "city",
    "tower",
    "flat",
    "unit",
  ];

  return patterns.some((pattern) => value.includes(pattern));
}

// ---------------------------------------------------------------------------
// Per-conversation debounce / scheduling
// ---------------------------------------------------------------------------

const REPLY_DEBOUNCE_MS = parseInt(
  process.env.AI_REPLY_DEBOUNCE_MS || "3000",
  10,
);

const turnState = new Map();

function scheduleInbound(conversationId, delayMs = REPLY_DEBOUNCE_MS) {
  const id = String(conversationId);

  const state = turnState.get(id) || {
    timer: null,
    running: false,
    rerun: false,
  };

  if (state.timer) {
    clearTimeout(state.timer);
  }

  state.timer = setTimeout(
    async () => {
      state.timer = null;

      if (state.running) {
        state.rerun = true;
        return;
      }

      state.running = true;

      try {
        const conversation = await Conversation.findById(id);

        if (!conversation) {
          return;
        }

        const lead = await Lead.findById(conversation.leadId);

        if (!lead) {
          return;
        }

        const message = await Message.findOne({
          conversationId: id,
        })
          .sort({
            timestamp: -1,
          })
          .lean();

        if (!message || message.direction !== "inbound") {
          return;
        }

        await handleInbound({
          conversation,
          lead,
          message,
        });
      } catch (err) {
        logger.error(`[ai] Scheduled conversation turn failed for ${id}`, {
          error: err.message,
          stack: err.stack,
        });
      } finally {
        state.running = false;

        if (state.rerun) {
          state.rerun = false;

          scheduleInbound(id, 500);
        } else if (!state.timer) {
          turnState.delete(id);
        }
      }
    },
    Math.max(0, Number(delayMs) || 0),
  );

  turnState.set(id, state);
}

/**
 * Main inbound conversation handler.
 */
async function handleInbound({ conversation, lead, message }) {
  // ---------------------------------------------------------
  // MANUAL / CLOSED CHAT
  // ---------------------------------------------------------

  if (conversation.status === "manual" || conversation.status === "closed") {
    return;
  }

  // ---------------------------------------------------------
  // SETTINGS
  // ---------------------------------------------------------

  const settings = await settingsService.getOrCreateSettings();

  if (settings.aiPaused || !settings.autoReplyEnabled) {
    return;
  }

  if (settings.whatsappDisconnected) {
    return;
  }

  // ---------------------------------------------------------
  // GEMINI KEY
  // ---------------------------------------------------------

  const apiKey = await settingsService.getGeminiKey();

  if (!apiKey) {
    logger.warn(
      `[ai] No Gemini API key configured — skipping AI reply for lead ${lead._id}`,
    );

    return;
  }

  // ---------------------------------------------------------
  // RECENT MESSAGES
  // ---------------------------------------------------------

  const recentMessages = await Message.find({
    conversationId: conversation._id,
  })
    .sort({
      timestamp: -1,
    })
    .limit(HISTORY_LIMIT)
    .lean();

  recentMessages.reverse();

  // ---------------------------------------------------------
  // CURRENT CUSTOMER MESSAGE
  // ---------------------------------------------------------

  const currentCustomerMessage = String(
    message?.text ||
      message?.body ||
      message?.content ||
      message?.message ||
      recentMessages[recentMessages.length - 1]?.text ||
      "",
  ).trim();

  const asksForOtherProperties = isAskingForOtherProperties(
    currentCustomerMessage,
  );

  const asksForAllProperties = isAskingForAllProperties(currentCustomerMessage);

  const asksSpecificProperty = isSpecificPropertyQuestion(
    currentCustomerMessage,
  );

  // ---------------------------------------------------------
  // EXISTING REQUIREMENTS
  // ---------------------------------------------------------

  const requirements = conversation.collectedRequirements || {};

  const ignoreProjectFilter = asksForOtherProperties || asksForAllProperties;

  const ignoreRequirementFilters = asksForAllProperties;

  // ---------------------------------------------------------
  // PROPERTY MATCHING
  // ---------------------------------------------------------

  let candidateProperties = [];

  try {
    candidateProperties = await matchProperties({
      projectName: !ignoreProjectFilter ? requirements.projectName : undefined,

      city: !ignoreRequirementFilters
        ? requirements.city || lead.city
        : undefined,

      location: !ignoreRequirementFilters
        ? requirements.location || lead.location
        : undefined,

      budgetMin: !ignoreRequirementFilters
        ? (requirements.budgetMin ?? lead.budgetMin)
        : undefined,

      budgetMax: !ignoreRequirementFilters
        ? (requirements.budgetMax ?? lead.budgetMax)
        : undefined,

      bhk: !ignoreRequirementFilters ? requirements.bhk : undefined,

      propertyType: !ignoreRequirementFilters
        ? requirements.propertyType
        : undefined,

      sizeSqft: !ignoreRequirementFilters ? requirements.sizeSqft : undefined,

      amenities: !ignoreRequirementFilters ? requirements.amenities : undefined,

      parking: !ignoreRequirementFilters ? requirements.parking : undefined,

      reraNumber: !ignoreRequirementFilters
        ? requirements.reraNumber
        : undefined,

      nearbyMetro: !ignoreRequirementFilters
        ? requirements.nearbyMetro
        : undefined,

      nearbySchool: !ignoreRequirementFilters
        ? requirements.nearbySchool
        : undefined,

      nearbyHospital: !ignoreRequirementFilters
        ? requirements.nearbyHospital
        : undefined,

      searchText: currentCustomerMessage,

      excludeProjectName: asksForOtherProperties
        ? requirements.projectName
        : undefined,
    });
  } catch (err) {
    logger.error(`[ai] Property matching failed for lead ${lead._id}`, {
      error: err.message,
    });

    candidateProperties = [];
  }

  // ---------------------------------------------------------
  // PROPERTY MATCHING DEBUG LOG
  // ---------------------------------------------------------

  logger.info(`[ai] Property matching context for lead ${lead._id}`, {
    customerMessage: currentCustomerMessage,

    asksForOtherProperties,

    asksForAllProperties,

    asksSpecificProperty,

    previousProject: requirements.projectName || null,

    candidateCount: candidateProperties.length,

    candidateProjects: candidateProperties.map((property) => ({
      id: property._id,

      projectName: property.projectName,

      city: property.city,

      location: property.location,

      bhk: property.bhk,
    })),
  });

  // ---------------------------------------------------------
  // SYSTEM INSTRUCTION
  // ---------------------------------------------------------

  const systemInstruction = buildSystemInstruction({
    lead,

    settings,

    collectedRequirements: requirements,

    matchedProperties: candidateProperties,

    referralStatus: conversation.referralStatus || "none",

    referralPersonName:
      settings.referral?.personName || env.referral.personName,
  });

  // ---------------------------------------------------------
  // GEMINI
  // ---------------------------------------------------------

  let result;

  try {
    result = await generateStructured({
      apiKey,

      systemInstruction,

      history: toGeminiHistory(recentMessages),

      responseSchema: REPLY_RESPONSE_SCHEMA,
    });
  } catch (err) {
    logger.error(`[ai] Gemini reply generation failed for lead ${lead._id}`, {
      error: err.message,
    });

    return;
  }

  const { parsed, raw } = result;

  // ---------------------------------------------------------
  // MERGE REQUIREMENTS
  // ---------------------------------------------------------

  const mergedRequirements = mergeRequirements(
    requirements,
    parsed.extractedRequirements,
  );

  conversation.collectedRequirements = mergedRequirements;

  conversation.lastIntent = parsed.intent;

  conversation.lastSentiment = parsed.sentiment;

  // ---------------------------------------------------------
  // RECOMMENDED PROPERTIES
  // ---------------------------------------------------------

  if (candidateProperties.length) {
    conversation.recommendedProperties = candidateProperties.map(
      (property) => property._id,
    );
  }

  // ---------------------------------------------------------
  // REFERRAL / MONICA HANDOFF
  // ---------------------------------------------------------

  let outboundText = parsed.reply;

  const referralPersonName =
    settings.referral?.personName || env.referral.personName;

  const referralContactNumber =
    settings.referral?.contactNumber || env.referral.contactNumber;

  const referralEnabled = settings.referral?.enabled ?? env.referral.enabled;

  if (
    referralEnabled &&
    conversation.referralStatus === "none" &&
    parsed.referralStage === "ask_now"
  ) {
    conversation.referralStatus = "asked";

    conversation.referralAskedAt = new Date();
  } else if (
    conversation.referralStatus === "asked" &&
    parsed.referralStage === "accepted"
  ) {
    conversation.referralStatus = "accepted";

    conversation.referralRespondedAt = new Date();

    if (referralContactNumber) {
      outboundText =
        `${parsed.reply}\n\n` +
        `${referralPersonName} ka number: ` +
        `${referralContactNumber}\n` +
        `Aap directly WhatsApp/call kar sakte hain 🙂`;
    } else {
      logger.warn(
        `[ai] Referral accepted for lead ${lead._id} but no referral contact number is configured`,
      );
    }
  } else if (
    conversation.referralStatus === "asked" &&
    parsed.referralStage === "declined"
  ) {
    conversation.referralStatus = "declined";

    conversation.referralRespondedAt = new Date();
  }

  // ---------------------------------------------------------
  // UPDATE LEAD
  // ---------------------------------------------------------

  const leadUpdates = {};

  if (mergedRequirements.city) {
    leadUpdates.city = mergedRequirements.city;
  }

  if (mergedRequirements.location) {
    leadUpdates.location = mergedRequirements.location;
  }

  if (mergedRequirements.budgetMin != null) {
    leadUpdates.budgetMin = mergedRequirements.budgetMin;
  }

  if (mergedRequirements.budgetMax != null) {
    leadUpdates.budgetMax = mergedRequirements.budgetMax;
  }

  if (Object.keys(leadUpdates).length) {
    await Lead.updateOne(
      {
        _id: lead._id,
      },
      {
        $set: leadUpdates,
      },
    );
  }

  // ---------------------------------------------------------
  // HUMAN-LIKE DELAY
  // ---------------------------------------------------------

  const replyDelayMs = 500 + Math.floor(Math.random() * 500);

  await new Promise((resolve) => setTimeout(resolve, replyDelayMs));

  // ---------------------------------------------------------
  // SEND WHATSAPP REPLY
  // ---------------------------------------------------------

  let outbound;

  try {
    const { messageId } = await metaWhatsappClient.sendToLead({
      phone: lead.phone,

      text: outboundText,
    });

    outbound = await recordOutboundMessage({
      conversationId: conversation._id,

      leadId: lead._id,

      text: outboundText,

      sender: "ai",

      whatsappMessageId: messageId || null,

      aiPrompt: systemInstruction,

      aiResponseRaw: raw,

      intent: parsed.intent,

      sentiment: parsed.sentiment,
    });
  } catch (err) {
    logger.error(
      `[ai] Failed to send AI reply for lead ${lead._id} via Meta WhatsApp Cloud API`,
      {
        error: err.response?.data || err.message,
      },
    );

    await Notification.create({
      userId: conversation.ownerId,

      type: "whatsapp_send_failed",

      title: `Couldn't message ${lead.name || "lead"} — WhatsApp send failed`,

      body: `Sending via WhatsApp failed for ${lead.phone}: ${err.message}`,

      link: `/leads/${lead._id}`,
    });

    emitToUser(conversation.ownerId, "notification:new", {
      leadId: lead._id,
    });

    return;
  }

  // ---------------------------------------------------------
  // SITE VISIT
  // ---------------------------------------------------------

  if (parsed.wantsSiteVisit) {
    await createSiteVisit({
      lead,

      conversation,

      date: parsed.proposedDate,

      time: parsed.proposedTime,

      property: candidateProperties[0],
    });
  }

  // ---------------------------------------------------------
  // CONVERSATION STATUS
  // ---------------------------------------------------------

  conversation.requirementsComplete = !!parsed.readyForPropertyRecommendation;

  await conversation.save();

  // ---------------------------------------------------------
  // SOCKET UPDATE
  // ---------------------------------------------------------

  emitToUser(conversation.ownerId, "conversation:aiReply", {
    conversationId: conversation._id,

    leadId: lead._id,

    message: outbound,
  });

  // ---------------------------------------------------------
  // ASYNC LEAD ANALYSIS
  // ---------------------------------------------------------

  analyzeConversationAsync({
    leadId: lead._id,

    conversationId: conversation._id,
  }).catch((err) =>
    logger.error(`[ai] Async lead analysis failed for lead ${lead._id}`, {
      error: err.message,
    }),
  );
}

/**
 * Sends the very first outbound WhatsApp message.
 */
async function startConversation({ lead, conversation }) {
  if (conversation.status !== "ai_active") {
    return {
      skipped: true,

      reason: "not_ai_active",
    };
  }

  const alreadyStarted = await Message.exists({
    conversationId: conversation._id,

    direction: "outbound",
  });

  if (alreadyStarted) {
    return {
      skipped: true,

      reason: "already_started",
    };
  }

  if (!env.metaWhatsapp.accessToken || !env.metaWhatsapp.phoneNumberId) {
    const err = new Error(
      "Meta WhatsApp Cloud API is not configured (META_WHATSAPP_ACCESS_TOKEN / META_WHATSAPP_PHONE_NUMBER_ID)",
    );

    err.code = "META_NOT_CONFIGURED";

    throw err;
  }

  const settings = await settingsService.getOrCreateSettings();

  if (settings.aiPaused || !settings.autoReplyEnabled) {
    return {
      skipped: true,

      reason: "ai_paused",
    };
  }

  if (settings.whatsappDisconnected) {
    return {
      skipped: true,

      reason: "whatsapp_disconnected",
    };
  }

  const openingText =
    settings.openingText ||
    env.metaWhatsapp.openingText ||
    settings.greetingMessage ||
    "Hi! Thanks for your interest. I'm here to help you find the right property 🙂";

  let outbound = null;
  let usedTemplate = false;

  try {
    const lastInboundAt = conversation.lastInboundAt
      ? new Date(conversation.lastInboundAt)
      : null;

    const isWindowOpen =
      lastInboundAt &&
      !Number.isNaN(lastInboundAt.getTime()) &&
      Date.now() - lastInboundAt.getTime() < 24 * 60 * 60 * 1000;

    if (isWindowOpen) {
      const { messageId } = await metaWhatsappClient.sendTextMessage({
        phone: lead.phone,

        text: openingText,
      });

      outbound = await recordOutboundMessage({
        conversationId: conversation._id,

        leadId: lead._id,

        text: openingText,

        sender: "ai",

        whatsappMessageId: messageId || null,
      });

      logger.info(
        `[ai] Opening text sent via Meta Cloud API for lead ${lead._id}`,
        {
          phone: lead.phone,

          reason: "24h-window-open",
        },
      );
    } else {
      const templateName =
        env.metaWhatsapp.openingTemplateName || settings.openingTemplate?.name;

      const templateLanguage =
        env.metaWhatsapp.openingTemplateLanguage ||
        settings.openingTemplate?.language;

      if (!templateName) {
        const err = new Error(
          "Opening template is not configured. Set META_WHATSAPP_OPENING_TEMPLATE_NAME.",
        );

        err.code = "OPENING_TEMPLATE_MISSING";

        throw err;
      }

      const components = [];

      const imageUrl = process.env.META_WHATSAPP_OPENING_TEMPLATE_IMAGE_URL;

      if (imageUrl) {
        components.push({
          type: "header",

          parameters: [
            {
              type: "image",

              image: {
                link: imageUrl,
              },
            },
          ],
        });
      }

      const { messageId } = await metaWhatsappClient.sendTemplateMessage({
        phone: lead.phone,

        templateName,

        languageCode: templateLanguage,

        components,
      });

      outbound = await recordOutboundMessage({
        conversationId: conversation._id,

        leadId: lead._id,

        text: `[Template: ${templateName}]`,

        sender: "ai",

        whatsappMessageId: messageId || null,
      });

      usedTemplate = true;

      logger.info(`[ai] Opening WhatsApp template sent for lead ${lead._id}`, {
        templateName,

        templateLanguage,

        reason: "24h-window-closed",
      });
    }
  } catch (err) {
    logger.error(
      `[ai] Failed to send opening WhatsApp message for lead ${lead._id}`,
      {
        error: err.metaError || err.response?.data || err.message,

        code: err.code,

        phone: lead.phone,
      },
    );

    throw err;
  }

  conversation.templateSent = usedTemplate;

  conversation.templateSentAt = usedTemplate ? new Date() : null;

  conversation.lastMessageAt = new Date();

  await conversation.save();

  emitToUser(conversation.ownerId, "conversation:aiReply", {
    conversationId: conversation._id,

    leadId: lead._id,

    message: outbound,
  });

  return {
    sent: true,

    usedTemplate,
  };
}

/**
 * Catch-up pending AI conversations.
 */
async function catchUpPendingConversations(brokerId) {
  const pending = await Conversation.find({
    ownerId: brokerId,

    status: "ai_active",
  })
    .select("_id leadId")
    .lean();

  if (!pending.length) {
    return;
  }

  const conversationIds = pending.map((c) => c._id);

  const leadIds = pending.map((c) => c.leadId);

  const [withMessages, blockedLeadIds] = await Promise.all([
    Message.distinct("conversationId", {
      conversationId: {
        $in: conversationIds,
      },
    }),

    OutboundJob.distinct("leadId", {
      leadId: {
        $in: leadIds,
      },

      status: {
        $in: ["failed", "cancelled"],
      },
    }),
  ]);

  const hasMessageSet = new Set(withMessages.map(String));

  const blockedSet = new Set(blockedLeadIds.map(String));

  const toQueue = pending
    .filter(
      (c) =>
        !hasMessageSet.has(String(c._id)) && !blockedSet.has(String(c.leadId)),
    )
    .map((c) => c.leadId);

  if (!toQueue.length) {
    return;
  }

  const { queued } = await enqueueLeads({
    ownerId: brokerId,

    leadIds: toQueue,
  });

  if (queued) {
    logger.info(
      `[ai] Catch-up: ${queued} pending conversation(s) queued for broker ${brokerId}`,
    );
  }
}

/**
 * Merge requirements without overwriting known values with blanks.
 */
function mergeRequirements(existing, incoming = {}) {
  const merged = {
    ...existing,
  };

  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (Array.isArray(value) && value.length === 0) {
      continue;
    }

    merged[key] = value;
  }

  return merged;
}

/**
 * Create / update site visit.
 */
async function createSiteVisit({ lead, conversation, date, time, property }) {
  const preferredDate =
    date || new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

  const preferredTime = time || "11:00";

  let meeting = await Meeting.findOne({
    leadId: lead._id,

    status: {
      $in: ["scheduled", "rescheduled"],
    },
  }).sort({
    createdAt: -1,
  });

  let isNew = false;

  if (meeting) {
    meeting.preferredDate = preferredDate;

    meeting.preferredTime = preferredTime;

    if (property?._id) {
      meeting.propertyId = property._id;
    }

    meeting.status = "scheduled";

    await meeting.save();
  } else {
    isNew = true;

    meeting = await Meeting.create({
      leadId: lead._id,

      ownerId: conversation.ownerId,

      propertyId: property?._id || null,

      preferredDate,

      preferredTime,

      status: "scheduled",
    });
  }

  conversation.meetingStatus = "scheduled";

  await Lead.updateOne(
    {
      _id: lead._id,
    },

    {
      $set: {
        status: "site_visit",
      },
    },
  );

  // ---------------------------------------------------------
  // GOOGLE CALENDAR
  // ---------------------------------------------------------

  try {
    if (meeting.googleEventId) {
      const event = await updateCalendarEvent({
        eventId: meeting.googleEventId,

        date: preferredDate,

        time: preferredTime,
      });

      if (event) {
        meeting.googleEventLink = event.eventLink;

        await meeting.save();
      }
    } else {
      const event = await createCalendarEvent({
        summary: `Site Visit — ${lead.name || lead.phone}${
          property ? ` (${property.projectName})` : ""
        }`,

        description: [
          `Lead: ${lead.name || "N/A"} (${lead.phone})`,

          property
            ? `Property: ${property.projectName}, ${property.city || ""}`
            : null,

          "Booked automatically by the AI WhatsApp assistant.",
        ]
          .filter(Boolean)
          .join("\n"),

        date: preferredDate,

        time: preferredTime,
      });

      if (event) {
        meeting.googleEventId = event.eventId;

        meeting.googleEventLink = event.eventLink;

        await meeting.save();
      }
    }
  } catch (err) {
    logger.error(
      `[calendar] Failed to sync Google Calendar event for lead ${lead._id}`,
      {
        error: err.message,
      },
    );
  }

  // ---------------------------------------------------------
  // NOTIFICATION
  // ---------------------------------------------------------

  if (isNew) {
    await Notification.create({
      userId: conversation.ownerId,

      type: "site_visit_scheduled",

      title: `Site visit scheduled — ${lead.name}`,

      body: `${preferredDate} at ${preferredTime}${
        property ? ` for ${property.projectName}` : ""
      }`,

      link: `/leads/${lead._id}`,
    });
  }

  emitToUser(conversation.ownerId, "meeting:created", {
    meeting,
  });

  return meeting;
}

module.exports = {
  handleInbound,
  scheduleInbound,
  createSiteVisit,
  startConversation,
  catchUpPendingConversations,
};
