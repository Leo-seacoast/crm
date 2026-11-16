// Loads (or removes) realistic FAKE demo data, for showing the CRM.
//
//   npm.cmd run demo:load:staging      -> adds demo data to STAGING
//   npm.cmd run demo:remove:staging    -> removes it again
//
// Safety:
// - Refuses to run unless APP_ENV is "staging" or "development" (never production).
// - Everything is made up: emails use example.com/.org/.net (reserved, can never
//   receive mail) and phone numbers use 555-01xx (reserved for fiction).
// - Every demo record has source "Demo data" or the tag "demo", so it can be
//   removed cleanly without touching anything else.

import { createClient } from "@supabase/supabase-js";

const mode = process.argv[2];
const env = process.env.APP_ENV;
if (!["staging", "development"].includes(env)) {
  console.error(`Refusing to run: APP_ENV is "${env}". Demo data is only for staging or development.`);
  process.exit(1);
}
if (!["load", "remove"].includes(mode)) {
  console.error("Usage: node scripts/seed-demo.mjs load|remove");
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const DEMO_SOURCE = "Demo data";
const DEMO_TAG = "demo";

function must(result, what) {
  if (result.error) {
    console.error(`Failed: ${what}: ${result.error.message}`);
    process.exit(1);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
async function remove() {
  const contacts = must(await db.from("contacts").select("id").eq("source", DEMO_SOURCE), "find demo contacts");
  const companies = must(await db.from("companies").select("id").contains("tags", [DEMO_TAG]), "find demo companies");
  const contactIds = contacts.map((c) => c.id);
  const companyIds = companies.map((c) => c.id);

  // Notes and deals linked to demo records go first.
  if (contactIds.length || companyIds.length) {
    const orParts = [
      contactIds.length ? `contact_id.in.(${contactIds.join(",")})` : null,
      companyIds.length ? `company_id.in.(${companyIds.join(",")})` : null,
    ].filter(Boolean).join(",");
    const deals = must(await db.from("deals").select("id").or(orParts), "find demo deals");
    const dealIds = deals.map((d) => d.id);
    if (dealIds.length) must(await db.from("notes").delete().in("deal_id", dealIds), "remove deal notes");
    if (contactIds.length) must(await db.from("notes").delete().in("contact_id", contactIds), "remove contact notes");
    if (companyIds.length) must(await db.from("notes").delete().in("company_id", companyIds), "remove company notes");
    if (dealIds.length) must(await db.from("deals").delete().in("id", dealIds), "remove deals");
    console.log(`Removed ${dealIds.length} deals.`);
  }
  if (contactIds.length) must(await db.from("contacts").delete().in("id", contactIds), "remove contacts");
  if (companyIds.length) must(await db.from("companies").delete().in("id", companyIds), "remove companies");
  console.log(`Removed ${contactIds.length} contacts and ${companyIds.length} companies (and their notes).`);
}

// ---------------------------------------------------------------------------
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
const daysAhead = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

// Guest-facing demo: mid-term-rental (MTR) leads and guests, and membership-program members.
// Companies are the kinds of organisations that send MTR guests our way.
const COMPANIES = [
  { name: "Seacoast Travel Nurse Staffing", city: "Portsmouth", region: "NH", website: "https://seacoastnurses.example.com", tags: ["staffing agency"] },
  { name: "Granite Relocation Services", city: "Manchester", region: "NH", website: "https://granitereloc.example.com", tags: ["relocation"] },
  { name: "North Coast Medical Group", city: "Dover", region: "NH", tags: ["healthcare employer"] },
  { name: "Atlas Engineering Contractors", city: "Concord", region: "NH", tags: ["corporate housing"] },
  { name: "Bayside Claims Housing", city: "Portland", region: "ME", tags: ["insurance housing"] },
  { name: "Riverbend University Visiting Faculty", city: "Durham", region: "NH", tags: ["academic"] },
];

// [first, last, types, companyIndex|null, tz, emailConsent, smsConsent]
// Indexes 0–11: MTR leads · 12–19: guests · 20–29: members (some also guests)
const PEOPLE = [
  ["Daniel", "Okafor", ["lead"], 0, "America/New_York", "opted_in", "unknown"],
  ["Hannah", "Ostrowski", ["lead"], 0, "America/Chicago", "unknown", "unknown"],
  ["Arjun", "Mehta", ["lead"], 2, "America/Chicago", "opted_in", "opted_in"],
  ["Sofia", "Marquez", ["lead"], 1, "America/New_York", "opted_in", "unknown"],
  ["Samuel", "Adeyemi", ["lead"], null, "America/New_York", "opted_out", "opted_out"],
  ["Abigail", "Thornton", ["lead"], 3, "America/New_York", "opted_in", "unknown"],
  ["Evelyn", "Park", ["lead"], 5, "America/Los_Angeles", "opted_in", "unknown"],
  ["Ryan", "Sullivan", ["lead"], 4, "America/New_York", "unknown", "unknown"],
  ["Claire", "Fontaine", ["lead"], null, "America/Montreal", "opted_in", "unknown"],
  ["Tom", "Beaulieu", ["lead"], 1, "America/New_York", "unknown", "unknown"],
  ["Megan", "O'Brien", ["lead"], 0, "America/Denver", "opted_in", "opted_in"],
  ["Jamal", "Whitaker", ["lead"], 3, "America/New_York", "unknown", "unknown"],
  ["Priya", "Raman", ["guest"], 2, "America/Chicago", "opted_in", "unknown"],
  ["Marcus", "Lindqvist", ["guest"], null, "Europe/Stockholm", "opted_in", "unknown"],
  ["Lily", "Chen", ["guest"], 5, "America/New_York", "opted_in", "unknown"],
  ["Isabel", "Rocha", ["guest"], 0, "America/Sao_Paulo", "opted_in", "unknown"],
  ["Ben", "Nakamura", ["guest"], 3, "America/Los_Angeles", "opted_in", "opted_in"],
  ["Maya", "Goldberg", ["guest"], null, "America/Denver", "unknown", "unknown"],
  ["Oliver", "Grant", ["guest"], 4, "America/New_York", "opted_in", "unknown"],
  ["Rosa", "Delgado", ["guest"], 1, "America/New_York", "opted_in", "unknown"],
  ["Margaret", "Holloway", ["member", "guest"], null, "America/New_York", "opted_in", "opted_in"],
  ["Grace", "Whitfield", ["member"], null, "America/New_York", "opted_in", "opted_out"],
  ["Nora", "Fitzgerald", ["member", "guest"], null, "America/New_York", "opted_in", "opted_in"],
  ["George", "Hammond", ["member"], null, "America/New_York", "opted_in", "unknown"],
  ["Charlotte", "Barnes", ["member", "guest"], null, "America/New_York", "opted_in", "unknown"],
  ["Henry", "Ashford", ["member"], null, "America/New_York", "opted_in", "opted_in"],
  ["Ethan", "Caldwell", ["member"], null, "America/Chicago", "opted_in", "unknown"],
  ["Victor", "Moreau", ["member"], null, "America/New_York", "opted_in", "unknown"],
  ["Luke", "Desrosiers", ["member", "guest"], null, "America/New_York", "opted_in", "opted_in"],
  ["Kevin", "Pratt", ["member"], null, "America/New_York", "unknown", "unknown"],
];

// Membership details, in the same columns as the GHL export ("extra fields").
// [personIndex, memberSinceMonthsAgo, renewalInDays, creditsEarned, creditsUsed, perks]
const MEMBERS = [
  [20, 26, 45, 180, 120, 9], [21, 14, -12, 60, 60, 4], [22, 18, 9, 140, 40, 6], [23, 3, 270, 20, 0, 1],
  [24, 11, 20, 95, 55, 5], [25, 30, -40, 210, 210, 12], [26, 7, 150, 45, 10, 2], [27, 1, 330, 10, 0, 0],
  [28, 13, 2, 120, 70, 7], [29, 9, 95, 35, 35, 3],
];

const EMAIL_DOMAINS = ["example.com", "example.org", "example.net"];

// [title, pipeline, stage, contactIndex, companyIndex|null, value, daysUntilClose]
// MTR values = estimated total rent for the stay. Membership values = annual fee.
const DEALS = [
  ["Okafor — 13-week travel nurse stay", "MTR Pipeline", "New Lead Added", 0, 0, 10400, 30],
  ["Ostrowski — 3 months from Jan", "MTR Pipeline", "Needs Manual Review", 1, 0, 9600, 21],
  ["Mehta — 6-month contract", "MTR Pipeline", "Options Sent", 2, 2, 19800, 14],
  ["Marquez — relocation, family of 4", "MTR Pipeline", "Contract & Application Sent", 3, 1, 16500, 7],
  ["Adeyemi — 2 months", "MTR Pipeline", "Lead DND", 4, null, 6200, -10],
  ["Thornton — site engineer, 4 months", "MTR Pipeline", "Permission Granted", 5, 3, 13600, 18],
  ["Park — visiting faculty, spring term", "MTR Pipeline", "Application Approved", 6, 5, 15200, 5],
  ["Sullivan — insurance displacement", "MTR Pipeline", "Booked!", 7, 4, 8900, -6],
  ["Fontaine — summer 2027", "MTR Pipeline", "Long Term Nurture", 8, null, 7500, 200],
  ["Beaulieu — dates unknown", "MTR Pipeline", "Insufficient Info", 9, 1, 0, -3],
  ["O'Brien — 12 weeks, pet-friendly", "MTR Pipeline", "Options Sent", 10, 0, 9900, 10],
  ["Whitaker — crew of 3", "MTR Pipeline", "New Lead Added", 11, 3, 21000, 25],
  ["Nakamura — booked, Jan–Mar", "MTR Pipeline", "Booked!", 16, 3, 11400, -20],
  ["Holloway membership", "Membership Program", "Member Renewed 1st year", 20, null, 199, -60],
  ["Whitfield membership", "Membership Program", "Renewal Payment Failed", 21, null, 199, -12],
  ["Fitzgerald membership", "Membership Program", "Renewal Reminder", 22, null, 199, 9],
  ["Hammond membership", "Membership Program", "Active Members", 23, null, 199, -90],
  ["Barnes membership", "Membership Program", "Active Members", 24, null, 199, -300],
  ["Ashford membership", "Membership Program", "Lapsed", 25, null, 199, -40],
  ["Caldwell membership", "Membership Program", "Active Members", 26, null, 199, -210],
  ["Moreau membership", "Membership Program", "Member Unique Code Pending", 27, null, 199, -2],
  ["Desrosiers membership", "Membership Program", "Renewal Reminder", 28, null, 199, 2],
  ["Pratt membership", "Membership Program", "New Submission", 29, null, 199, 3],
];

const CONTACT_NOTES = [
  [0, "Travel nurse starting at North Coast Medical in January. Needs parking and in-unit laundry.", true, 6],
  [2, "Prefers text. Can sign as soon as options include a 2-bed near Dover.", false, 4],
  [4, "Asked us to stop contacting him. Marked DND.", true, 10],
  [12, "Stayed 3 months last year. Left a 5-star review; may return in the fall.", false, 90],
  [16, "Booked through Atlas Engineering. Invoice the company, not the guest.", true, 20],
  [20, "Long-time member. Uses credits mostly for late check-out. Asked about gifting a membership.", true, 30],
  [21, "Card declined on renewal. Asked us to email, not text.", true, 12],
  [25, "Membership lapsed — said she'd rejoin for the summer season.", false, 35],
  [28, "Renewal due in 2 days. Prefers a reminder by text.", false, 1],
];

const DEAL_NOTES = [
  [3, "Application sent. Waiting on employer letter from Granite Relocation.", 3],
  [6, "Approved by visiting faculty office. Needs to confirm dates before we book.", 2],
  [14, "Stripe: card declined twice. Follow up before access is paused.", 5],
];

// [personIndex, title, dueInDays, time|null, done]
const TASKS = [
  [0, "Send 2-bed options near Dover", 0, "10:00", false],
  [3, "Chase employer letter for application", -1, null, false],
  [21, "Email about failed renewal payment", 0, "14:00", false],
  [28, "Text renewal reminder", 1, null, false],
  [6, "Confirm spring-term dates", 2, null, false],
  [25, "Invite back to membership for summer", 14, null, false],
  [12, "Send fall availability", -5, null, true],
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** GHL-style membership fields for members; empty for everyone else. */
function memberFields(personIndex) {
  const m = MEMBERS.find(([pi]) => pi === personIndex);
  if (!m) return {};
  const [, sinceMonthsAgo, renewalInDays, earned, used, perks] = m;
  const since = new Date();
  since.setMonth(since.getMonth() - sinceMonthsAgo);
  const renewal = new Date(Date.now() + renewalInDays * 86_400_000).toISOString().slice(0, 10);
  return {
    "Unique Member Code": `M-${10200 + personIndex}`,
    "Member Since": `${MONTHS[since.getMonth()]} ${since.getFullYear()}`,
    "Renewal Date": renewal,
    "Credits Earned": String(earned),
    "Credits Used": String(used),
    "Credits Available": String(earned - used),
    "Total Perks Usage": String(perks),
    "Unique Referral Code": `REF${(personIndex * 37).toString(36).toUpperCase()}`,
  };
}

async function load() {
  const already = must(await db.from("contacts").select("id").eq("source", DEMO_SOURCE).limit(1), "check");
  if (already.length > 0) {
    console.error("Demo data is already loaded. Run the remove command first if you want to reload it.");
    process.exit(1);
  }

  // Attribute demo records to the first admin, so they look like normal records.
  const admins = must(await db.from("profiles").select("id").eq("role", "admin").is("archived_at", null).limit(1), "find admin");
  const adminId = admins[0]?.id ?? null;
  const who = adminId ? { created_by: adminId, owner_id: adminId } : {};

  // Pipelines and stages by name
  const pipelines = must(
    await db.from("pipelines").select("id, name, pipeline_stages(id, name, archived_at)").is("archived_at", null),
    "load pipelines",
  );
  const stageFor = (pipelineName, stageName) => {
    const p = pipelines.find((x) => x.name === pipelineName);
    const s = p?.pipeline_stages.find((x) => x.name === stageName && !x.archived_at);
    if (!p || !s) throw new Error(`Missing pipeline/stage: ${pipelineName} / ${stageName}`);
    return { pipeline_id: p.id, stage_id: s.id };
  };

  // Companies
  const companyRows = COMPANIES.map((c, i) => ({
    name: c.name,
    website: c.website ?? null,
    email: `office@${c.name.toLowerCase().replace(/[^a-z]+/g, "")}.example.net`,
    phone: `+16035550${150 + i}`, // 555-0150 … 555-0161 (fictional range)
    city: c.city,
    region: c.region,
    country: "USA",
    tags: [DEMO_TAG, ...c.tags],
    created_at: daysAgo(120 - i * 7),
    ...who,
  }));
  const companies = must(await db.from("companies").insert(companyRows).select("id, name"), "add companies");
  const companyId = (i) => (i === null ? null : companies.find((c) => c.name === COMPANIES[i].name).id);

  // Contacts
  const contactRows = PEOPLE.map(([first, last, types, co, tz, emailC, smsC], i) => {
    const consent = (status, channel) =>
      status === "unknown"
        ? { [`${channel}_consent`]: "unknown" }
        : {
            [`${channel}_consent`]: status,
            [`${channel}_consent_at`]: daysAgo(100 - i * 3),
            [`${channel}_consent_source`]:
              status === "opted_out" ? "Asked to stop" : i % 3 === 0 ? "Website form" : i % 3 === 1 ? "Verbal (phone call)" : "GHL import",
          };
    return {
      first_name: first,
      last_name: last,
      email: `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "") + "@" + EMAIL_DOMAINS[i % 3],
      phone: `+16035550${100 + i}`,
      types,
      company_id: companyId(co),
      time_zone: tz,
      city: co !== null ? COMPANIES[co].city : null,
      region: co !== null ? COMPANIES[co].region : null,
      source: DEMO_SOURCE,
      tags: types.includes("member") ? ["member"] : types.includes("guest") ? ["repeat guest"].slice(0, i % 2) : ["mtr"],
      extra_fields: memberFields(i),
      created_at: daysAgo(110 - i * 3),
      ...consent(emailC, "email"),
      ...consent(smsC, "sms"),
      ...who,
    };
  });
  const contacts = must(await db.from("contacts").insert(contactRows).select("id, first_name, last_name"), "add contacts");
  const contactId = (i) => contacts.find((c) => c.first_name === PEOPLE[i][0] && c.last_name === PEOPLE[i][1]).id;

  // Deals
  const dealRows = DEALS.map(([title, pipeline, stage, ci, coi, value, days], i) => ({
    title,
    ...stageFor(pipeline, stage),
    contact_id: contactId(ci),
    company_id: companyId(coi),
    value,
    expected_close_date: daysAhead(days),
    created_at: daysAgo(80 - i * 3),
    ...who,
  }));
  const deals = must(await db.from("deals").insert(dealRows).select("id, title"), "add deals");
  const dealId = (i) => deals.find((d) => d.title === DEALS[i][0]).id;

  // Notes
  const noteRows = [
    ...CONTACT_NOTES.map(([ci, body, pinned, days]) => ({
      contact_id: contactId(ci), deal_id: null, body, pinned, created_at: daysAgo(days), ...who,
    })),
    // Every row needs the same columns when inserted together.
    ...DEAL_NOTES.map(([di, body, days]) => ({
      contact_id: null, deal_id: dealId(di), body, pinned: false, created_at: daysAgo(days), ...who,
    })),
  ];
  const notes = must(await db.from("notes").insert(noteRows).select("id"), "add notes");

  // Tasks (due dates relative to today in New York)
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const dayFromToday = (n) => new Date(Date.parse(`${today}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const taskRows = TASKS.map(([pi, title, due, time, done]) => ({
    title, contact_id: contactId(pi), due_date: dayFromToday(due), due_time: time,
    status: done ? "done" : "open", ...who,
  }));
  const tasks = must(await db.from("tasks").insert(taskRows).select("id"), "add tasks");

  console.log(
    `Loaded demo data into ${env}: ${companies.length} companies, ${contacts.length} contacts, ` +
      `${deals.length} deals, ${notes.length} notes, ${tasks.length} tasks.`,
  );
}

if (mode === "remove") await remove();
else await load();
