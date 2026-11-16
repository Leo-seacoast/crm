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

const COMPANIES = [
  { name: "Harbor Light Realty", city: "Portsmouth", region: "NH", website: "https://harborlight.example.com", tags: ["referral partner"] },
  { name: "Summit Peak Cleaning Co.", city: "North Conway", region: "NH", website: "https://summitpeak.example.com", tags: ["cleaning"] },
  { name: "Granite State Plumbing", city: "Concord", region: "NH", tags: ["maintenance"] },
  { name: "Seaside Linen Service", city: "Hampton", region: "NH", tags: ["linens"] },
  { name: "White Mountain Rentals Group", city: "Lincoln", region: "NH", tags: ["owner group"] },
  { name: "Kittery Point Holdings LLC", city: "Kittery", region: "ME", tags: ["owner group"] },
  { name: "Bretton Woods Event Planners", city: "Bretton Woods", region: "NH", tags: ["events"] },
  { name: "Coastal Hot Tub Care", city: "Rye", region: "NH", tags: ["maintenance"] },
  { name: "Lakes Region Property Partners", city: "Meredith", region: "NH", tags: ["referral partner"] },
  { name: "Ogunquit Beach Cottages", city: "Ogunquit", region: "ME", tags: ["owner group"] },
  { name: "Notch View Landscaping", city: "Franconia", region: "NH", tags: ["maintenance"] },
  { name: "Atlantic Insurance Advisors", city: "Dover", region: "NH", tags: ["insurance"] },
];

// [first, last, types, companyIndex|null, tz, emailConsent, smsConsent]
const PEOPLE = [
  ["Margaret", "Holloway", ["owner", "client"], 5, "America/New_York", "opted_in", "opted_in"],
  ["Daniel", "Okafor", ["lead"], null, "America/New_York", "opted_in", "unknown"],
  ["Priya", "Raman", ["guest"], null, "America/Chicago", "opted_in", "unknown"],
  ["Tom", "Beaulieu", ["vendor"], 1, "America/New_York", "unknown", "unknown"],
  ["Sofia", "Marquez", ["lead", "owner"], null, "America/New_York", "opted_in", "opted_in"],
  ["Ethan", "Caldwell", ["partner"], 0, "America/New_York", "opted_in", "unknown"],
  ["Grace", "Whitfield", ["owner", "client"], 9, "America/New_York", "opted_in", "opted_out"],
  ["Marcus", "Lindqvist", ["guest"], null, "Europe/Stockholm", "opted_in", "unknown"],
  ["Hannah", "Ostrowski", ["lead"], null, "America/New_York", "unknown", "unknown"],
  ["Jamal", "Whitaker", ["vendor"], 2, "America/New_York", "unknown", "unknown"],
  ["Claire", "Fontaine", ["owner"], null, "America/Montreal", "opted_in", "unknown"],
  ["Ben", "Nakamura", ["guest", "lead"], null, "America/Los_Angeles", "opted_in", "opted_in"],
  ["Rosa", "Delgado", ["vendor"], 3, "America/New_York", "unknown", "unknown"],
  ["Oliver", "Grant", ["partner"], 8, "America/New_York", "opted_in", "unknown"],
  ["Nora", "Fitzgerald", ["owner", "client"], 4, "America/New_York", "opted_in", "opted_in"],
  ["Samuel", "Adeyemi", ["lead"], null, "America/New_York", "opted_out", "unknown"],
  ["Lily", "Chen", ["guest"], null, "America/New_York", "opted_in", "unknown"],
  ["Victor", "Moreau", ["vendor"], 7, "America/New_York", "unknown", "unknown"],
  ["Abigail", "Thornton", ["lead", "owner"], null, "America/New_York", "opted_in", "unknown"],
  ["Kevin", "Pratt", ["vendor"], 10, "America/New_York", "unknown", "unknown"],
  ["Isabel", "Rocha", ["guest"], null, "America/Sao_Paulo", "opted_in", "unknown"],
  ["George", "Hammond", ["owner"], 5, "America/New_York", "opted_in", "unknown"],
  ["Megan", "O'Brien", ["partner"], 6, "America/New_York", "opted_in", "unknown"],
  ["Arjun", "Mehta", ["lead"], null, "America/Chicago", "opted_in", "opted_in"],
  ["Charlotte", "Barnes", ["guest", "client"], null, "America/New_York", "opted_in", "unknown"],
  ["Luke", "Desrosiers", ["vendor"], 1, "America/New_York", "unknown", "unknown"],
  ["Evelyn", "Park", ["owner", "lead"], null, "America/New_York", "opted_in", "unknown"],
  ["Ryan", "Sullivan", ["partner"], 11, "America/New_York", "opted_in", "unknown"],
  ["Maya", "Goldberg", ["guest"], null, "America/Denver", "unknown", "unknown"],
  ["Henry", "Ashford", ["owner"], 9, "America/New_York", "opted_in", "opted_in"],
];

const EMAIL_DOMAINS = ["example.com", "example.org", "example.net"];

// [title, pipeline, stage, contactIndex, companyIndex|null, value, daysUntilClose]
const DEALS = [
  ["Holloway cottage — full management", "Owner onboarding", "Onboarding", 0, 5, 14400, 10],
  ["Marquez lake house management", "Owner onboarding", "Property visit", 4, null, 9600, 30],
  ["Whitfield beach cottage", "Owner onboarding", "Live", 6, 9, 12000, -20],
  ["Fontaine ski condo", "Owner onboarding", "Agreement sent", 10, null, 8400, 14],
  ["Fitzgerald portfolio (3 units)", "Owner onboarding", "Live", 14, 4, 36000, -45],
  ["Thornton mountain cabin", "Owner onboarding", "Inquiry", 18, null, 7200, 45],
  ["Hammond duplex", "Owner onboarding", "Not proceeding", 21, 5, 10800, -10],
  ["Park farmhouse", "Owner onboarding", "Inquiry", 26, null, 9000, 60],
  ["Ashford oceanfront home", "Owner onboarding", "Agreement sent", 29, 9, 18000, 7],
  ["Okafor — weekend retreat booking", "Sales", "New lead", 1, null, 1850, 21],
  ["Nakamura family reunion (2 houses)", "Sales", "Proposal sent", 11, null, 6400, 12],
  ["Ostrowski — corporate offsite", "Sales", "Contacted", 8, null, 4200, 25],
  ["Bretton Woods wedding block", "Sales", "Negotiation", 22, 6, 15500, 18],
  ["Lakes Region referral package", "Sales", "Won", 13, 8, 5000, -5],
  ["Adeyemi — summer rental", "Sales", "Lost", 15, null, 3200, -15],
  ["Mehta — ski week", "Sales", "Proposal sent", 23, null, 2900, 9],
  ["Harbor Light co-marketing", "Sales", "Won", 5, 0, 2500, -30],
  ["Barnes — anniversary stay", "Sales", "New lead", 24, null, 1400, 35],
  ["Insurance partnership", "Sales", "Contacted", 27, 11, 1200, 40],
  ["Chen — fall foliage trip", "Sales", "Negotiation", 16, null, 2100, 6],
];

const CONTACT_NOTES = [
  [0, "Prefers phone calls in the morning. Owns two cottages; wants the second one onboarded next spring.", true, 40],
  [0, "Walkthrough done. Gate code changes monthly — owner will text it to us.", false, 12],
  [2, "Stayed in July. Left a 5-star review and asked about returning for Christmas.", false, 90],
  [3, "Reliable, turns over a 3-bed in under 3 hours. Invoice by the 5th of each month.", true, 60],
  [6, "Asked us to stop texting — use email only.", true, 25],
  [10, "Speaks French and English. Condo has a ski locker; key is with the front desk.", false, 15],
  [14, "Very happy with Q3 occupancy (84%). Interested in adding a 4th unit.", false, 8],
  [15, "Went with another manager on price. Revisit next season.", false, 14],
  [17, "Hot tub service every other Tuesday. Emergency line: ask for Victor.", false, 70],
  [22, "Coordinates 6–8 weddings a year at Bretton Woods. Wants a room-block discount.", true, 20],
];

const DEAL_NOTES = [
  [0, "Contract signed. Photos booked for next Tuesday; listing goes live after.", 9],
  [10, "Sent proposal for both houses, 4 nights. Waiting on headcount (likely 18).", 5],
  [12, "Asked for 10% off for 8+ nights. Checking with owners before we answer.", 3],
  [8, "Agreement sent by email. Owner's lawyer reviewing the cancellation clause.", 2],
];

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
  const pipelines = must(await db.from("pipelines").select("id, name, pipeline_stages(id, name, archived_at)"), "load pipelines");
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
      tags: types.includes("owner") ? ["owner"] : types.includes("guest") ? ["repeat guest"].slice(0, i % 2) : [],
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

  console.log(
    `Loaded demo data into ${env}: ${companies.length} companies, ${contacts.length} contacts, ` +
      `${deals.length} deals, ${notes.length} notes.`,
  );
}

if (mode === "remove") await remove();
else await load();
