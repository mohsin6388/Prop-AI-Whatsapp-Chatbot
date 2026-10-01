# Fixes — Smooth WhatsApp Flow

Ye file batati hai ki code mein kya galat tha, kya theek kiya gaya, aur deploy karne se pehle kya karna hai.

## 🔴 Sabse bade bugs (flow tod rahe the)

### 1. AI jo seekhta tha, wo kabhi save nahi hota tha
`promptBuilder.js` ka naya schema ye fields bhejta hai: `name, budget, location_preference, assistant_interest, ...`.
Lekin `conversationEngine.js` abhi bhi purane fields padh raha tha: `extractedRequirements, referralStage, wantsSiteVisit, proposedDate`. Ye sab hamesha `undefined` the. Nateeja:
- Customer ka naam, city, budget, BHK kabhi save nahi hota tha. Monica wahi sawaal dobara poochti thi.
- Property matching bina filter ke chalti thi.
- "Monica as assistant" offer ka status kabhi aage nahi badhta tha, isliye offer baar-baar pooch sakti thi.
- Site visit kabhi book nahi hoti thi.

**Fix:** Naya `src/services/ai/aiResultAdapter.js` AI ke har field ko sahi jagah map karta hai. Budget text ko number mein badalta hai ("50-60 lakh" → 50,00,000–60,00,000; "1.2 cr", "AED 1.5M" bhi chalta hai). Date aur time ko validate karta hai. Conversation model mein `location, purpose, timeline, language, budgetText, notes` fields jod diye hain. Pehle Mongoose inhe chupchaap drop kar deta tha.

### 2. Ek customer ke 3 messages = 3 alag AI replies
WhatsApp par log aise likhte hain: "hi" / "2bhk chahiye" / "noida". Har message par alag AI turn chalta tha, jisse double ya ulte order mein replies jaate the.

**Fix:** Ab har chat ke liye system **3 second** rukta hai. Uske baad saare messages ko saath padhkar **ek hi reply** jaata hai. Ek chat par kabhi do AI turns ek saath nahi chalte. (Test: pehle 3 replies jaati thi, ab 1.)

### 3. Gemini ka reply beech mein kat jaata tha
Gemini 2.5 ke "thinking" tokens 512-token limit kha jaate the, aur JSON adhoora aata tha ("AI returned an unparseable response").

**Fix:**
- Thinking budget 0 kiya aur limit 1024 ki.
- 429, 5xx aur timeout par retry lagaya.
- JSON parsing ab code-fence (```json) wala jawab bhi sambhal leti hai.
- Default model ab `gemini-2.5-flash` hai.

### 4. AI fail hone par customer "seen" par atka rehta tha
**Fix:** Gemini down ho ya quota khatam ho, toh customer ko ek polite fallback message jaata hai, aur broker ko notification milti hai. Ye message 30 minute mein ek hi baar jaata hai, taaki spam na ho.

### 5. Site visit galat date/time par book ho jaati thi
- Date na mile toh code apne aap "2 din baad 11 baje" book kar deta tha.
- Google Calendar mein time server ke timezone se jaata tha. UTC server par 11:00 IST ki visit 16:30 IST par lagti thi.

**Fix:** Visit tabhi book hoti hai jab customer ne date **aur** time dono diye hon. Tab tak meeting "proposed" rehti hai. Calendar ab sahi timezone mein event banata hai. Prompt ko aaj ki date bhi di jaati hai, taaki "kal" aur "Sunday" ko sahi date mein badal sake.

## 🟡 Chhote bugs

| Kya tha | Fix |
|---|---|
| `paused` status wali chat par bhi AI reply karta tha | Ab AI sirf `ai_active` chats mein reply karta hai. Gemini ke jawab ke baad, bhejne se pehle, status dobara check hota hai (agar beech mein broker ne takeover kiya ho) |
| Voice note / photo par "[audio message — not yet supported]" jaata tha | Ab "[Customer sent a voice note]" jaata hai, aur Monica politely type karne ko kehti hai. Location, contact aur caption bhi padhe jaate hain |
| 👍 reaction par bhi AI reply karta tha | Reactions ab ignore hote hain |
| Ek saath aaye messages mein `unreadCount` galat ginta tha | Update ab atomic `$inc` se hota hai |
| Meta ka duplicate webhook race mein crash kar sakta tha | Unique index error ab chupchaap handle hota hai |
| "read" ke baad der se aaya "delivered" status ko peeche kar deta tha | Status ab sirf aage badhta hai |
| Batch ka ek kharab message baaki messages ko bhi rok deta tha | Har message ab alag try/catch mein hai |
| Customer ka WhatsApp nickname hi lead name reh jaata tha | Customer ne asli naam bataya toh wo save hota hai. Broker ka likha naam kabhi nahi badalta |
| Daily report tabhi jaati thi jab tick exactly usi minute par chale | Ab "time ho gaya aur aaj nahi gayi" par jaati hai, aur fail hone par 15 minute baad retry |
| Lead scoring har message par ek extra Gemini call karta tha | Ab ek chat mein 2 minute mein max ek baar |
| Referral number prompt mein hardcoded tha | Ab Settings ya `REFERRAL_CONTACT_NUMBER` se aata hai (default 8750200899) |
| Har AI message ke saath ~10KB ka poora prompt DB mein save hota tha | Band kar diya. Debug ke liye `AI_STORE_PROMPTS=true` karein |
| ~1,400 lines commented-out purana code | Hata diya (promptBuilder, whatsappController, geminiClient, settingsService) |

## ✅ Test kaise hua
Asli MongoDB-compatible database par poora webhook flow chalaya gaya, Meta aur Gemini ko mock karke. Ye sab pass hua:
- 3 messages ka burst → 1 reply; duplicate webhook ignore hua; naam, city aur budget save hue
- Yaad rakhi gayi details agle prompt mein pahunchi; "5 pm" → 17:00 par visit book hui
- Date/time ke bina koi fake booking nahi hui
- Offer: asked → accepted, number sirf ek baar gaya
- Gemini down → fallback ek hi baar gaya
- Takeover ke baad AI chup raha
- Status ulte order mein aaya toh bhi "read" bana raha
- Voice note ka placeholder bana aur uska jawab gaya

Server boot bhi check hua: `/api/health` aur webhook verify dono OK.

## ⚙️ Deploy se pehle
1. `.env.example` ko copy karke `.env` banayein aur values bharein.
2. **Zaroori:**
   - `META_WHATSAPP_APP_SECRET` set karein. Iske bina koi bhi fake webhook bhej sakta hai.
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` aur `ENCRYPTION_KEY` mein lambi random values daalein.
3. `GEMINI_MODEL=gemini-2.5-flash` rakhein. Purana `gemini-2.0-flash` band ho sakta hai.
4. Server **ek hi instance** mein chalayein. Debounce/lock memory mein hai, isliye do instances hon toh Redis lock chahiye.
5. `npm install` chalayein, phir `npm start`.
