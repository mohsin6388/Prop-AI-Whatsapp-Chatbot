// End-to-end webhook flow test (Meta + Gemini mocked). Needs a local MongoDB on
// 127.0.0.1:27017 (it drops the "wa_flow_test" database). Run: npm run test:flow
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/wa_flow_test";
process.env.GEMINI_API_KEY = "test-key";
process.env.META_WHATSAPP_ACCESS_TOKEN = "x";
process.env.META_WHATSAPP_PHONE_NUMBER_ID = "123";
process.env.AI_REPLY_DEBOUNCE_MS = "400";
process.env.GEMINI_MAX_RETRIES = "0";
process.env.AI_ANALYSIS_MIN_INTERVAL_MS = "999999999";

const path = require("path");
const ROOT = process.argv[2] || path.join(__dirname, "..");
const r = (p) => require(path.join(ROOT, p));
const mongoose = require(path.join(ROOT, "node_modules/mongoose"));
const assert = require("assert");

const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

(async () => {
  mongoose.set("autoIndex", false);
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.db.dropDatabase();

  const User = r("src/models/User");
  const Lead = r("src/models/Lead");
  const Conversation = r("src/models/Conversation");
  const Message = r("src/models/Message");
  const Meeting = r("src/models/Meeting");
  await Message.createIndexes();
  await Conversation.createIndexes();
  await Lead.collection.createIndex({ ownerId: 1, phone: 1 }, { unique: true });

  // ---- mocks ----
  const meta = r("src/services/whatsapp/metaWhatsappClient");
  const sent = [];
  let n = 0;
  meta.sendToLead = async ({ phone, text }) => { sent.push({ phone, text }); return { messageId: `wamid.out${++n}` }; };
  meta.sendTextMessage = meta.sendToLead;
  meta.markAsRead = async () => {};

  const geminiQueue = [];
  const geminiRequests = [];
  global.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    geminiRequests.push(body);
    const next = geminiQueue.shift();
    if (next === "FAIL") return { ok: false, status: 503, text: async () => "overloaded" };
    const payload = next || { reply: "analysis", score: 50, level: "warm", summary: "s", reason: "r", nextFollowUpDate: "not-a-date", nextFollowUpMessage: "m", urgency: "low" };
    return { ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(payload) }] } }] }) };
  };

  const base = { name: null, phone: null, preferred_language: "Hinglish", property_type: null, budget: null, location_preference: null, city: null, bhk: null, purpose: null, timeline: null, interest_level: "pata nahi", verified: false, notes: null, lead_type: "buyer", assistant_interest: "pata nahi", send_property_media: false, property_reference: null, wants_site_visit: false, visit_date: null, visit_time: null, assistant_offer_asked: false };

  const owner = await User.create({ name: "Broker", email: "b@x.com", passwordHash: "x", role: "broker" });
  await r("src/models/Settings").create({});
  const { handleWebhook } = r("src/services/whatsapp/webhookHandler");
  const hook = (id, text, from = "919876543210", extra = {}) => handleWebhook({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ field: "messages", value: { contacts: [{ wa_id: from, profile: { name: "Rahul WA" } }], messages: [{ from, id, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: text }, ...extra }] } }] }],
  });

  // ---- 1. burst of 3 messages -> exactly ONE reply, requirements saved ----
  geminiQueue.push({ ...base, reply: "Hi Rahul! Noida mein 2BHK, 50-60 lakh — noted 🙂 Kab tak shift karna hai?", name: "Rahul Sharma", city: "Noida", location_preference: "Sector 150, Noida", bhk: "2BHK", budget: "50-60 lakh", purpose: "buy" });
  await hook("wamid.in1", "hi");
  await hook("wamid.in2", "2bhk chahiye noida sector 150");
  await hook("wamid.in3", "budget 50-60 lakh");
  await hook("wamid.in3", "budget 50-60 lakh"); // Meta retry (duplicate)
  await sleep(1500);

  assert.strictEqual(sent.length, 1, `expected 1 reply for burst, got ${sent.length}`);
  const firstReq = geminiRequests[0];
  assert.strictEqual(firstReq.contents.length, 1, "burst should be merged into one user turn");
  assert.ok(firstReq.contents[0].parts[0].text.includes("budget 50-60 lakh"));
  assert.deepStrictEqual(firstReq.generationConfig.thinkingConfig, { thinkingBudget: 0 });
  assert.strictEqual(await Message.countDocuments({ direction: "inbound" }), 3, "duplicate delivery must be ignored");

  let lead = await Lead.findOne({ phone: "919876543210" });
  let conv = await Conversation.findOne({ leadId: lead._id });
  assert.strictEqual(lead.name, "Rahul Sharma", "placeholder name should be replaced");
  assert.strictEqual(lead.city, "Noida");
  assert.strictEqual(lead.budgetMin, 5000000);
  assert.strictEqual(lead.budgetMax, 6000000);
  assert.strictEqual(conv.collectedRequirements.location, "Sector 150, Noida");
  assert.strictEqual(conv.collectedRequirements.budgetText, "50-60 lakh");
  assert.strictEqual(conv.unreadCount, 3);
  console.log("✓ burst -> 1 reply, dedup, requirements + name saved");

  // ---- 2. prompt now contains remembered facts ----
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  geminiQueue.push({ ...base, reply: `Done! ${tomorrow} ko 5 PM visit note kar liya.`, wants_site_visit: true, visit_date: tomorrow, visit_time: "5 pm", interest_level: "serious", verified: true });
  await hook("wamid.in4", "kal 5 baje site visit kar sakte hain?");
  await sleep(1200);
  const sys = geminiRequests.filter((b) => b.generationConfig.responseJsonSchema?.properties?.reply).pop().system_instruction.parts[0].text;
  assert.ok(sys.includes("Required city: Noida") && sys.includes("Budget (as told by customer): 50-60 lakh"), "memory must reach the prompt");
  assert.ok(sys.includes("Today's date is"), "prompt must know today's date");
  const meeting = await Meeting.findOne({ leadId: lead._id });
  assert.ok(meeting, "meeting should be created");
  assert.strictEqual(meeting.preferredDate, tomorrow);
  assert.strictEqual(meeting.preferredTime, "17:00");
  console.log("✓ memory in prompt, site visit booked with normalized time");

  // ---- 3. site visit without time -> no booking, meeting 'proposed' ----
  geminiQueue.push({ ...base, name: "Priya", reply: "Kis din aana chahenge?", wants_site_visit: true });
  await hook("wamid.p1", "mujhe site visit karni hai", "919999999999");
  await sleep(1000);
  const lead2 = await Lead.findOne({ phone: "919999999999" });
  assert.strictEqual(await Meeting.countDocuments({ leadId: lead2._id }), 0);
  assert.strictEqual((await Conversation.findOne({ leadId: lead2._id })).meetingStatus, "proposed");
  console.log("✓ no fake booking without date/time");

  // ---- 4. referral offer state machine ----
  geminiQueue.push({ ...base, reply: "Waise, kya aap meri saheli Monica ko apni assistant ke jaise rakhna chahenge? 😊", assistant_offer_asked: true });
  await hook("wamid.in5", "thanks, sab clear hai");
  await sleep(1000);
  conv = await Conversation.findOne({ leadId: lead._id });
  assert.strictEqual(conv.referralStatus, "asked");
  geminiQueue.push({ ...base, reply: "Bilkul 😊 lijiye, aap humein is number par contact kar sakte hain: 8750200899", assistant_interest: "yes" });
  await hook("wamid.in6", "haan bilkul");
  await sleep(1000);
  conv = await Conversation.findOne({ leadId: lead._id });
  assert.strictEqual(conv.referralStatus, "accepted");
  assert.strictEqual((sent[sent.length - 1].text.match(/8750200899/g) || []).length, 1, "number must appear exactly once");
  console.log("✓ referral asked -> accepted, number sent once");

  // ---- 5. Gemini down -> fallback reply once ----
  const before = sent.length;
  geminiQueue.push("FAIL");
  await hook("wamid.in7", "hello?");
  await sleep(1000);
  assert.strictEqual(sent.length, before + 1);
  assert.ok(/team will get back/i.test(sent[sent.length - 1].text));
  geminiQueue.push("FAIL");
  await hook("wamid.in8", "koi hai?");
  await sleep(1000);
  assert.strictEqual(sent.length, before + 1, "fallback must not spam");
  console.log("✓ fallback reply when Gemini fails (no spam)");

  // ---- 6. manual takeover -> AI silent ----
  await Conversation.updateOne({ _id: conv._id }, { $set: { status: "manual" } });
  const b2 = sent.length;
  await hook("wamid.in9", "broker se baat karni hai");
  await sleep(1000);
  assert.strictEqual(sent.length, b2);
  console.log("✓ taken-over chat gets no AI reply");

  // ---- 7. status events out of order ----
  const out = await Message.findOne({ direction: "outbound" }).sort({ timestamp: 1 });
  const status = (st) => handleWebhook({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { statuses: [{ id: out.whatsappMessageId, status: st }] } }] }] });
  await status("read");
  await status("delivered");
  assert.strictEqual((await Message.findById(out._id)).status, "read");
  console.log("✓ read status not downgraded by late 'delivered'");

  // ---- 8. voice note -> placeholder, still answered ----
  await Conversation.updateOne({ _id: conv._id }, { $set: { status: "ai_active" } });
  geminiQueue.push({ ...base, reply: "Sorry, voice note yahan nahi sun pa rahi — please type kar dijiye 🙏" });
  await handleWebhook({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { messages: [{ from: "919876543210", id: "wamid.v1", timestamp: String(Math.floor(Date.now() / 1000)), type: "audio", audio: { id: "a1" } }] } }] }] });
  await sleep(1000);
  const vn = await Message.findOne({ whatsappMessageId: "wamid.v1" });
  assert.strictEqual(vn.text, "[Customer sent a voice note]");
  console.log("✓ voice note stored as readable placeholder and answered");

  console.log("\nALL FLOW TESTS PASSED");
  await mongoose.disconnect();
  process.exit(0);
})().catch(async (e) => {
  console.error("TEST FAILED:", e.message);
  console.error(e.stack);
  process.exit(1);
});
