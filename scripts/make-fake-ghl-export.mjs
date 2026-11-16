// Makes a FAKE GoHighLevel contacts export (CSV) for testing and demos.
//
//   node scripts/make-fake-ghl-export.mjs <rows> <output.csv>
//
// Everything is made up: emails use example.com/.org/.net (reserved, can never
// receive mail); phones use 555-0100…0199 (reserved for fiction), so only some
// rows have a phone. It deliberately includes messy data a real export has:
// duplicate emails, invalid emails/phones, DND contacts, rows with no name/email/phone,
// mixed date formats, and the membership/referral columns from our GHL account.

import { writeFileSync } from "node:fs";

const total = Number(process.argv[2] ?? 50);
const out = process.argv[3] ?? "fake-ghl-contacts.csv";

const FIRST = ["Olivia", "Liam", "Emma", "Noah", "Ava", "Elijah", "Sophia", "James", "Isabella", "Lucas", "Mia", "Mason",
  "Amelia", "Ethan", "Harper", "Logan", "Evelyn", "Aiden", "Abigail", "Jackson", "Ella", "Sebastian", "Scarlett", "Mateo",
  "José", "Zoë", "Siobhan", "François", "Ngozi", "Hiroshi", "Anaïs", "Björn"];
const LAST = ["Smith", "Johnson", "Brown", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Thompson", "White", "Harris", "Clark", "O'Neill",
  "Nguyen", "Kowalski", "de la Cruz", "Müller", "Fitzgerald"];
const BUSINESSES = ["", "", "", "Harbor Light Realty", "Summit Peak Cleaning Co.", "Seacoast Stays LLC",
  "Granite State Plumbing", "White Mountain Rentals Group", "Kittery Point Holdings LLC", "Ogunquit Beach Cottages",
  "harbor light realty", "Lakes Region Property Partners", "Smith, Jones & Partners"];
const TAGS = ["owner", "guest", "vip", "newsletter", "repeat guest", "referral", "ski season", "summer 2024", "lead"];
const SOURCES = ["Website", "Airbnb", "VRBO", "Referral", "Facebook ad", "Walk-in", ""];
const DOMAINS = ["example.com", "example.org", "example.net"];

let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rand() * a.length)];

const HEADERS = [
  "Contact Id", "First Name", "Last Name", "Contact name", "Phone", "Email", "Business Name",
  "Created (EST)", "Last Activity (EST)", "Tags", "Source", "DND", "Timezone",
  "Unique Member Code", "Member Since", "Renewal Date", "Credits Earned", "Credits Used",
  "Total Perks Usage", "Unique Referral Code", "Credits Available", "Referral code used",
];

const cell = (v) => {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const pad = (n) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function ghlDate(i) {
  const d = new Date(Date.UTC(2019, 0, 1) + Math.floor(rand() * 6 * 365) * 86_400_000 + (i % 86_400) * 1000);
  const h12 = d.getUTCHours() % 12 || 12;
  const ampm = d.getUTCHours() < 12 ? "AM" : "PM";
  // GHL exports vary by account; mix the common formats.
  return i % 3 === 0
    ? `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`
    : i % 3 === 1
      ? `${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${d.getUTCFullYear()} ${pad(h12)}:${pad(d.getUTCMinutes())} ${ampm}`
      : `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${d.getUTCFullYear()} ${h12}:${pad(d.getUTCMinutes())} ${ampm}`;
}

const lines = [HEADERS.map(cell).join(",")];
for (let i = 1; i <= total; i++) {
  const first = pick(FIRST);
  const last = pick(LAST);
  const member = rand() < 0.35;
  let email = `${first}.${last}.${i}`.toLowerCase().normalize("NFD").replace(/[^a-z0-9.]/g, "") + "@" + pick(DOMAINS);
  let phone = "";
  if (i <= 100) {
    const n = 100 + (i - 1);
    phone = pick([`(603) 555-0${n}`, `603.555.0${n}`, `+1 603 555 0${n}`, `6035550${n}`]);
  }

  // Messy rows, like a real export
  if (i % 97 === 0) email = `${first}.${last}.${i - 1}`.toLowerCase().normalize("NFD").replace(/[^a-z0-9.]/g, "") + "@" + DOMAINS[(i - 1) % 3]; // possible duplicate
  if (i % 211 === 0) email = "not-an-email";
  if (i % 389 === 0) phone = "12345";
  const noIdentity = i % 523 === 0;

  const credits = member ? Math.floor(rand() * 200) : "";
  const used = member ? Math.floor(rand() * Number(credits || 0)) : "";
  const r = [
    `ghl_${(1e9 + i * 7919).toString(36)}`,
    noIdentity ? "" : first,
    noIdentity ? "" : last,
    noIdentity ? "" : `${first} ${last}`,
    noIdentity ? "" : phone,
    noIdentity ? "" : email,
    pick(BUSINESSES),
    ghlDate(i),
    ghlDate(i + 1),
    [...new Set([pick(TAGS), rand() < 0.5 ? pick(TAGS) : ""])].filter(Boolean).join(", "),
    pick(SOURCES),
    i % 41 === 0 ? "true" : "",
    pick(["", "", "America/New_York", "America/Chicago", "America/Los_Angeles", "Eastern Time"]),
    member ? `M-${10000 + i}` : "",
    member ? `${pick(MONTHS)} ${2018 + Math.floor(rand() * 6)}` : "",
    member ? `${2025 + Math.floor(rand() * 2)}-${pad(1 + Math.floor(rand() * 12))}-01` : "",
    credits,
    used,
    member ? Math.floor(rand() * 15) : "",
    member ? `REF${(i * 31).toString(36).toUpperCase()}` : "",
    member ? Number(credits) - Number(used) : "",
    rand() < 0.1 ? `REF${Math.floor(rand() * 9999).toString(36).toUpperCase()}` : "",
  ];
  lines.push(r.map(cell).join(","));
}

writeFileSync(out, "﻿" + lines.join("\r\n") + "\r\n", "utf8");
console.log(`Wrote ${total} fake GHL contacts to ${out}`);
