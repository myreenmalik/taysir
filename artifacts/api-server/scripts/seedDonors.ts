/**
 * Seed donor mock data across categories, tiers, personalities, and events.
 *
 * Run from the repo root:
 *   pnpm --filter @workspace/api-server run seed:donors
 *
 * Idempotent:
 *  - Donors are upserted by email (stable seed key).
 *  - Seeded donations + attendees are tagged with `[seed:v1]` in their notes
 *    field; a re-run deletes prior seeded rows before re-inserting them.
 *  - Existing (non-seeded) donations and attendees are left untouched.
 *
 * After seeding, recomputeDonorStats is run for every donor so totals,
 * dates, category, tier, and personality are derived from actual data.
 */
import { sql, eq, like, and } from "drizzle-orm";
import {
  db,
  donorsTable,
  donationsTable,
  attendeesTable,
  eventsTable,
} from "@workspace/db";
import { recomputeDonorStats } from "../src/lib/donorStats";

const SEED_TAG = "[seed:v1]";

// Today is treated as "now" for relative dates.
const TODAY = new Date();

function dateDaysAgo(days: number): string {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

type SeedDonation = {
  daysAgo: number;
  amount: number;
  cause: string;
  campaign?: string;
  season?: string;
  donationType?: string;
  eventId?: number | null;
};

type SeedAttendee = {
  eventId: number;
  donationAmount?: number;
  attendeeType?: string; // first-time, returning, vip, volunteer
  engagementLevel?: string; // low, medium, high
};

type SeedDonor = {
  id: number; // explicit id so we cover existing donor_id references
  name: string;
  email: string;
  phone: string;
  location: string;
  preferredContactFrequency?: string;
  notes?: string;
  seedDonations?: SeedDonation[];
  seedAttendees?: SeedAttendee[];
};

// Real event IDs in the DB are 1..10 (id 11 is a test import).
// Event themes for picking believable matches:
//   1 Ramadan Iftar (2024-03-25, Ramadan)
//   2 Palestine Emergency (2024-02-10, Winter, emergency)
//   3 Zakat Drive (2024-04-12, Spring, zakat)
//   4 Annual Gala (2024-07-20, Summer, general/major)
//   5 Back to School (2024-08-15, Summer, education)
//   6 Sudan Crisis (2024-06-05, Summer, emergency)
//   7 Eid ul-Adha (2024-06-16, Eid, orphan/general)
//   8 Autumn Gala (2025-10-15, Fall, general)
//   9 Winter Iftar Series (2025-12-01, Winter, year-end)
//  10 Spring Charity Walk (2026-03-22, Spring, general)

const DONORS: SeedDonor[] = [
  // ===== IDs 1–10: existing donations already attached =====
  {
    id: 1,
    name: "Ahmed Al-Farsi",
    email: "ahmed.alfarsi@example.com",
    phone: "(415) 555-0101",
    location: "San Francisco, CA",
    preferredContactFrequency: "monthly",
    notes: "Long-time supporter; prefers email outreach.",
    // Already: 5 donations $8,850, last 2026-04-02 (Major / Gold / Investor)
    seedDonations: [
      { daysAgo: 30, amount: 1500, cause: "Palestine Emergency", campaign: "Palestine Emergency", season: "Spring", eventId: 10 },
      { daysAgo: 200, amount: 1200, cause: "Orphan Sponsorship", campaign: "Year End Appeal", season: "Year-End", eventId: 9 },
    ],
    seedAttendees: [
      { eventId: 10, donationAmount: 1500, attendeeType: "vip", engagementLevel: "high" },
      { eventId: 9, donationAmount: 1200, attendeeType: "returning", engagementLevel: "high" },
    ],
  },
  {
    id: 2,
    name: "Fatima Hassan",
    email: "fatima.hassan@example.com",
    phone: "(212) 555-0102",
    location: "New York, NY",
    preferredContactFrequency: "quarterly",
    // Already: 2 donations $1,500, last 2024-03-25 (Lapsed / Silver)
  },
  {
    id: 3,
    name: "Omar Karimi",
    email: "omar.karimi@example.com",
    phone: "(310) 555-0103",
    location: "Los Angeles, CA",
    preferredContactFrequency: "annual",
    notes: "High-capacity gala donor; lapsed since 2024.",
    // Already: 1 donation $10,000, last 2024-07-20 (Lapsed / Platinum)
  },
  {
    id: 4,
    name: "Zainab Qureshi",
    email: "zainab.qureshi@example.com",
    phone: "(713) 555-0104",
    location: "Houston, TX",
    // Already: 1 donation $500 (Lapsed / Bronze)
  },
  {
    id: 5,
    name: "Yusuf Rahman",
    email: "yusuf.rahman@example.com",
    phone: "(312) 555-0105",
    location: "Chicago, IL",
    // Already: 1 donation $500 (Lapsed / Bronze)
  },
  {
    id: 6,
    name: "Sara Ahmed",
    email: "sara.ahmed@example.com",
    phone: "(617) 555-0106",
    location: "Boston, MA",
    preferredContactFrequency: "monthly",
    // Already: 2 donations $700; we add multi-year multi-cause history → Altruist / Silver
    seedDonations: [
      { daysAgo: 410, amount: 250, cause: "Water Wells", campaign: "Year End Appeal", season: "Year-End", eventId: 9 },
      { daysAgo: 240, amount: 300, cause: "Orphan Sponsorship", campaign: "Autumn Appeal", season: "Fall", eventId: 8 },
      { daysAgo: 90, amount: 200, cause: "Disaster Relief", campaign: "Spring 2026", season: "Spring", eventId: 10 },
      { daysAgo: 45, amount: 150, cause: "General Sadaqah", season: "Spring" },
      { daysAgo: 20, amount: 175, cause: "Back to School", campaign: "Education Aid" },
    ],
    seedAttendees: [
      { eventId: 9, donationAmount: 250, attendeeType: "returning", engagementLevel: "medium" },
      { eventId: 10, donationAmount: 200, attendeeType: "returning", engagementLevel: "high" },
    ],
  },
  {
    id: 7,
    name: "Bilal Iqbal",
    email: "bilal.iqbal@example.com",
    phone: "(602) 555-0107",
    location: "Phoenix, AZ",
    // Already: 1 donation $250 → Lapsed / Bronze
  },
  {
    id: 8,
    name: "Maryam Siddiqui",
    email: "maryam.siddiqui@example.com",
    phone: "(214) 555-0108",
    location: "Dallas, TX",
    // Already: 2 donations $4,000 in 2024 → Lapsed / Silver
  },
  {
    id: 9,
    name: "Tariq Hussain",
    email: "tariq.hussain@example.com",
    phone: "(305) 555-0109",
    location: "Miami, FL",
    // Already: 1 donation $750 → Lapsed / Bronze
  },
  {
    id: 10,
    name: "Nadia Osman",
    email: "nadia.osman@example.com",
    phone: "(206) 555-0110",
    location: "Seattle, WA",
    preferredContactFrequency: "quarterly",
    notes: "Major donor, emergency-focused.",
    // Already: 4 donations $5,900 → Major / Gold / Investor
    seedDonations: [
      { daysAgo: 60, amount: 1500, cause: "Sudan Crisis", campaign: "Sudan Emergency", season: "Spring" },
    ],
  },

  // ===== IDs 15–46: imported / spreadsheet donors, mostly recent activity =====
  {
    id: 15,
    name: "Imran Sayeed",
    email: "imran.sayeed@example.com",
    phone: "(216) 555-0115",
    location: "Cleveland, OH",
    // Already: 2 donations $500 (Zakat) → enrich into recurring Altruist
    seedDonations: [
      { daysAgo: 380, amount: 200, cause: "Ramadan/Iftar", campaign: "Ramadan 2025", season: "Ramadan" },
      { daysAgo: 220, amount: 150, cause: "Orphan Sponsorship", campaign: "Autumn Appeal", season: "Fall", eventId: 8 },
      { daysAgo: 80, amount: 250, cause: "Water Wells", campaign: "Spring 2026", season: "Spring" },
    ],
    seedAttendees: [
      { eventId: 8, donationAmount: 150, attendeeType: "first-time", engagementLevel: "medium" },
    ],
  },
  {
    id: 16,
    name: "Layla Mahmoud",
    email: "layla.mahmoud@example.com",
    phone: "(404) 555-0116",
    location: "Atlanta, GA",
    // Already: 3 donations $450 (Ramadan/Eid) → seasonal Repayer
    seedAttendees: [
      { eventId: 9, donationAmount: 100, attendeeType: "first-time", engagementLevel: "low" },
    ],
  },
  {
    id: 17,
    name: "Hassan Yousef",
    email: "hassan.yousef@example.com",
    phone: "(469) 555-0117",
    location: "Plano, TX",
    preferredContactFrequency: "annual",
    // Already: 2 donations $3,000 → Silver / Investor (avg $1,500)
    seedDonations: [
      { daysAgo: 300, amount: 2500, cause: "Palestine Emergency", campaign: "Palestine Emergency", season: "Fall", eventId: 8 },
    ],
    seedAttendees: [
      { eventId: 8, donationAmount: 2500, attendeeType: "vip", engagementLevel: "high" },
    ],
  },
  {
    id: 18,
    name: "Ayesha Khan",
    email: "ayesha.khan@example.com",
    phone: "(703) 555-0118",
    location: "Arlington, VA",
    // Already: 2 donations $100 (Zakat Al Fitr) → small seasonal
  },
  {
    id: 19,
    name: "Khalid Mansour",
    email: "khalid.mansour@example.com",
    phone: "(248) 555-0119",
    location: "Detroit, MI",
    // Already: 3 donations $225 → enrich into recurring Altruist
    seedDonations: [
      { daysAgo: 540, amount: 100, cause: "Disaster Relief", campaign: "Sudan Emergency", season: "Summer" },
      { daysAgo: 300, amount: 150, cause: "Water Wells", campaign: "Year End Appeal", season: "Year-End" },
      { daysAgo: 60, amount: 80, cause: "Ramadan/Iftar", season: "Spring" },
    ],
  },
  {
    id: 20,
    name: "Rania Saleh",
    email: "rania.saleh@example.com",
    phone: "(303) 555-0120",
    location: "Denver, CO",
    preferredContactFrequency: "monthly",
    notes: "Top giver in 2026; emergency responder.",
    // Already: 3 donations $10,150 → Major / Platinum / Investor
  },
  {
    id: 21,
    name: "Mohammed Ali",
    email: "mohammed.ali@example.com",
    phone: "(615) 555-0121",
    location: "Nashville, TN",
    // Already: 2 donations $600
  },
  {
    id: 22,
    name: "Hina Sheikh",
    email: "hina.sheikh@example.com",
    phone: "(503) 555-0122",
    location: "Portland, OR",
    preferredContactFrequency: "quarterly",
    // Already: 2 donations $2,400 → Silver / Investor (avg $1,200)
  },
  {
    id: 23,
    name: "Faisal Choudhury",
    email: "faisal.choudhury@example.com",
    phone: "(919) 555-0123",
    location: "Raleigh, NC",
    // Already: 2 donations $850
  },
  {
    id: 24,
    name: "Amira Nasser",
    email: "amira.nasser@example.com",
    phone: "(801) 555-0124",
    location: "Salt Lake City, UT",
    // Already: 2 donations $300
  },
  {
    id: 25,
    name: "Junaid Patel",
    email: "junaid.patel@example.com",
    phone: "(408) 555-0125",
    location: "San Jose, CA",
    // Already: 2 donations $1,200 → Silver
    seedDonations: [
      { daysAgo: 14, amount: 400, cause: "Spring Charity Walk", campaign: "Spring 2026", season: "Spring", eventId: 10 },
    ],
    seedAttendees: [
      { eventId: 10, donationAmount: 400, attendeeType: "returning", engagementLevel: "high" },
    ],
  },
  {
    id: 26,
    name: "Sumaiya Akter",
    email: "sumaiya.akter@example.com",
    phone: "(347) 555-0126",
    location: "Brooklyn, NY",
    // Already: 2 donations $170
  },
  {
    id: 27,
    name: "Adnan Faruk",
    email: "adnan.faruk@example.com",
    phone: "(813) 555-0127",
    location: "Tampa, FL",
    preferredContactFrequency: "annual",
    // Already: 2 donations $2,000
    seedDonations: [
      { daysAgo: 200, amount: 3500, cause: "Annual Gala", campaign: "Autumn Appeal", season: "Fall", eventId: 8 },
    ],
    seedAttendees: [
      { eventId: 8, donationAmount: 3500, attendeeType: "vip", engagementLevel: "high" },
    ],
  },
  {
    id: 28,
    name: "Saira Bano",
    email: "saira.bano@example.com",
    phone: "(623) 555-0128",
    location: "Scottsdale, AZ",
    // Already: 2 donations $500 → seasonal/Bronze
  },
  {
    id: 29,
    name: "Mahmoud El-Sayed",
    email: "mahmoud.elsayed@example.com",
    phone: "(857) 555-0129",
    location: "Cambridge, MA",
    // Already: 2 donations $150 → small seasonal
  },
  {
    id: 30,
    name: "Noor Jahan",
    email: "noor.jahan@example.com",
    phone: "(770) 555-0130",
    location: "Marietta, GA",
    // Already: 2 donations $1,000 → Silver
  },
  {
    id: 31,
    name: "Karim Hashemi",
    email: "karim.hashemi@example.com",
    phone: "(786) 555-0131",
    location: "Hialeah, FL",
    // Already: 2 donations $400
  },
  {
    id: 32,
    name: "Yasmin Bakr",
    email: "yasmin.bakr@example.com",
    phone: "(323) 555-0132",
    location: "Glendale, CA",
    // Already: 2 donations $700
  },
  {
    id: 33,
    name: "Ridwan Iqbal",
    email: "ridwan.iqbal@example.com",
    phone: "(984) 555-0133",
    location: "Durham, NC",
    // Already: 2 donations $250
  },
  {
    id: 34,
    name: "Salma Abdulaziz",
    email: "salma.abdulaziz@example.com",
    phone: "(908) 555-0134",
    location: "Edison, NJ",
    // Already: 2 donations $900
  },
  {
    id: 35,
    name: "Tahir Mehmood",
    email: "tahir.mehmood@example.com",
    phone: "(443) 555-0135",
    location: "Baltimore, MD",
    preferredContactFrequency: "quarterly",
    // Already: 2 donations $1,600 → Silver / Investor (avg $800 → Repayer? need season/event)
    seedDonations: [
      { daysAgo: 50, amount: 600, cause: "Ramadan/Iftar", campaign: "Year End Appeal", season: "Winter", eventId: 9 },
    ],
    seedAttendees: [
      { eventId: 9, donationAmount: 600, attendeeType: "returning", engagementLevel: "medium" },
    ],
  },
  {
    id: 36,
    name: "Nargis Begum",
    email: "nargis.begum@example.com",
    phone: "(484) 555-0136",
    location: "Allentown, PA",
    // Already: 2 donations $350
  },
  {
    id: 37,
    name: "Idris Suleiman",
    email: "idris.suleiman@example.com",
    phone: "(918) 555-0137",
    location: "Tulsa, OK",
    // Already: 3 donations $180 → enrich for Altruist (5 donations + 3 causes)
    seedDonations: [
      { daysAgo: 330, amount: 60, cause: "Water Wells", season: "Fall" },
      { daysAgo: 110, amount: 90, cause: "Orphan Sponsorship", season: "Winter" },
    ],
  },
  {
    id: 38,
    name: "Reema Hadi",
    email: "reema.hadi@example.com",
    phone: "(401) 555-0138",
    location: "Providence, RI",
    // Already: 2 donations $600
  },
  {
    id: 40,
    name: "Wasim Ghani",
    email: "wasim.ghani@example.com",
    phone: "(719) 555-0140",
    location: "Colorado Springs, CO",
    // Already: 1 donation $500 → one-time Bronze
  },
  {
    id: 41,
    name: "Hira Naseem",
    email: "hira.naseem@example.com",
    phone: "(959) 555-0141",
    location: "Hartford, CT",
    // Already: 1 donation $200
  },
  {
    id: 42,
    name: "Mustafa Doukouri",
    email: "mustafa.doukouri@example.com",
    phone: "(469) 555-0142",
    location: "Irving, TX",
    preferredContactFrequency: "annual",
    // Already: 1 donation $1,000 → Silver / Investor
    seedDonations: [
      { daysAgo: 230, amount: 4500, cause: "Annual Gala", campaign: "Autumn Appeal", season: "Fall", eventId: 8 },
    ],
    seedAttendees: [
      { eventId: 8, donationAmount: 4500, attendeeType: "vip", engagementLevel: "high" },
    ],
  },
  {
    id: 43,
    name: "Anisa Cheema",
    email: "anisa.cheema@example.com",
    phone: "(515) 555-0143",
    location: "Des Moines, IA",
    // Already: 1 donation $200
  },
  {
    id: 44,
    name: "Babar Tariq",
    email: "babar.tariq@example.com",
    phone: "(414) 555-0144",
    location: "Milwaukee, WI",
    // Already: 1 donation $99
  },
  {
    id: 45,
    name: "Sadia Imam",
    email: "sadia.imam@example.com",
    phone: "(727) 555-0145",
    location: "St. Petersburg, FL",
    // Already: 2 donations $1,000 → Silver
  },
  {
    id: 46,
    name: "Owais Hamid",
    email: "owais.hamid@example.com",
    phone: "(509) 555-0146",
    location: "Spokane, WA",
    // Already: 1 donation $250
  },

  // ===== IDs 48–62 =====
  {
    id: 48,
    name: "Rabia Anwar",
    email: "rabia.anwar@example.com",
    phone: "(509) 555-0148",
    location: "Yakima, WA",
    // Already: 2 donations $250
  },
  {
    id: 49,
    name: "Tanveer Aslam",
    email: "tanveer.aslam@example.com",
    phone: "(208) 555-0149",
    location: "Boise, ID",
    // Already: 1 donation $75
  },
  {
    id: 51,
    name: "Hamza Riaz",
    email: "hamza.riaz@example.com",
    phone: "(316) 555-0151",
    location: "Wichita, KS",
    // Already: 1 donation $60
  },
  {
    id: 52,
    name: "Iram Bashir",
    email: "iram.bashir@example.com",
    phone: "(225) 555-0152",
    location: "Baton Rouge, LA",
    // Already: 2 donations $600
  },
  {
    id: 54,
    name: "Mansoor Yaqub",
    email: "mansoor.yaqub@example.com",
    phone: "(913) 555-0154",
    location: "Overland Park, KS",
    // Already: 2 donations $400
  },
  {
    id: 55,
    name: "Naila Rauf",
    email: "naila.rauf@example.com",
    phone: "(331) 555-0155",
    location: "Aurora, IL",
    // Already: 2 donations $170
  },
  {
    id: 57,
    name: "Saeed Mubarak",
    email: "saeed.mubarak@example.com",
    phone: "(682) 555-0157",
    location: "Fort Worth, TX",
    // Already: 1 donation $150
  },
  {
    id: 58,
    name: "Mariyam Lone",
    email: "mariyam.lone@example.com",
    phone: "(346) 555-0158",
    location: "Sugar Land, TX",
    preferredContactFrequency: "quarterly",
    // Already: 2 donations $1,000 → Silver
    seedDonations: [
      { daysAgo: 25, amount: 350, cause: "Spring Charity Walk", campaign: "Spring 2026", season: "Spring", eventId: 10 },
    ],
    seedAttendees: [
      { eventId: 10, donationAmount: 350, attendeeType: "returning", engagementLevel: "medium" },
    ],
  },
  {
    id: 60,
    name: "Junayd Bhatti",
    email: "junayd.bhatti@example.com",
    phone: "(360) 555-0160",
    location: "Tacoma, WA",
    // Already: 2 donations $250
  },
  {
    id: 62,
    name: "Wafa Ismail",
    email: "wafa.ismail@example.com",
    phone: "(775) 555-0162",
    location: "Reno, NV",
    // Already: 2 donations $900
    seedDonations: [
      { daysAgo: 410, amount: 200, cause: "Ramadan/Iftar", campaign: "Ramadan 2025", season: "Ramadan" },
    ],
  },

  // ===== Brand-new donors (no donations yet → personality null) =====
  {
    id: 70,
    name: "Hadiya Wasim",
    email: "hadiya.wasim@example.com",
    phone: "(212) 555-0170",
    location: "Jersey City, NJ",
    notes: "Signed up at Spring Charity Walk; no gifts yet.",
  },
  {
    id: 71,
    name: "Zaid Mahmood",
    email: "zaid.mahmood@example.com",
    phone: "(312) 555-0171",
    location: "Naperville, IL",
    notes: "Newsletter signup, no gifts yet.",
  },
  {
    id: 72,
    name: "Lubna Aziz",
    email: "lubna.aziz@example.com",
    phone: "(415) 555-0172",
    location: "Oakland, CA",
    notes: "Referred by Ahmed Al-Farsi; not yet engaged.",
  },
  {
    id: 73,
    name: "Faraz Quraishi",
    email: "faraz.quraishi@example.com",
    phone: "(617) 555-0173",
    location: "Worcester, MA",
    notes: "Volunteer interest; no gifts yet.",
  },

  // ===== Extra Platinum / Major to ensure tier coverage =====
  {
    id: 80,
    name: "Dr. Hisham Karam",
    email: "hisham.karam@example.com",
    phone: "(202) 555-0180",
    location: "Washington, DC",
    preferredContactFrequency: "annual",
    notes: "Platinum-tier major donor; long-running gala patron.",
    seedDonations: [
      { daysAgo: 700, amount: 5000, cause: "Annual Gala", campaign: "Annual Gala", season: "Summer", eventId: 4 },
      { daysAgo: 380, amount: 4000, cause: "Annual Gala", campaign: "Autumn Appeal", season: "Fall", eventId: 8 },
      { daysAgo: 90, amount: 6000, cause: "Palestine Emergency", campaign: "Palestine Emergency", season: "Spring" },
    ],
    seedAttendees: [
      { eventId: 4, donationAmount: 5000, attendeeType: "vip", engagementLevel: "high" },
      { eventId: 8, donationAmount: 4000, attendeeType: "vip", engagementLevel: "high" },
    ],
  },
  {
    id: 81,
    name: "Aisha Bint Salem",
    email: "aisha.bintsalem@example.com",
    phone: "(646) 555-0181",
    location: "Manhattan, NY",
    preferredContactFrequency: "quarterly",
    notes: "Quiet major donor — prefers anonymity.",
    seedDonations: [
      { daysAgo: 180, amount: 12000, cause: "Orphan Sponsorship", campaign: "Year End Appeal", season: "Year-End", eventId: 9 },
    ],
    seedAttendees: [
      { eventId: 9, donationAmount: 12000, attendeeType: "vip", engagementLevel: "high" },
    ],
  },

  // ===== Lapsed donors with rich history (to exercise lapsed alerts) =====
  {
    id: 82,
    name: "Younus Karim",
    email: "younus.karim@example.com",
    phone: "(704) 555-0182",
    location: "Charlotte, NC",
    notes: "Lapsed since early 2025 — needs re-engagement.",
    seedDonations: [
      { daysAgo: 800, amount: 250, cause: "Ramadan/Iftar", campaign: "Ramadan 2024", season: "Ramadan", eventId: 1 },
      { daysAgo: 600, amount: 300, cause: "Eid Gift", campaign: "Eid 2024", season: "Eid", eventId: 7 },
      { daysAgo: 480, amount: 200, cause: "Sudan Crisis", campaign: "Sudan Emergency", season: "Summer", eventId: 6 },
    ],
    seedAttendees: [
      { eventId: 1, donationAmount: 250, attendeeType: "returning", engagementLevel: "medium" },
      { eventId: 7, donationAmount: 300, attendeeType: "returning", engagementLevel: "medium" },
    ],
  },
  {
    id: 83,
    name: "Sabeen Lateef",
    email: "sabeen.lateef@example.com",
    phone: "(773) 555-0183",
    location: "Chicago, IL",
    notes: "Lapsed major donor; high reactivation potential.",
    seedDonations: [
      { daysAgo: 720, amount: 3000, cause: "Annual Gala", campaign: "Annual Gala", season: "Summer", eventId: 4 },
      { daysAgo: 500, amount: 2500, cause: "Back to School", campaign: "Education Aid", season: "Summer", eventId: 5 },
    ],
    seedAttendees: [
      { eventId: 4, donationAmount: 3000, attendeeType: "vip", engagementLevel: "high" },
      { eventId: 5, donationAmount: 2500, attendeeType: "returning", engagementLevel: "medium" },
    ],
  },

  // ===== Recurring Altruist (5+ donations, 3+ causes, recent) =====
  {
    id: 84,
    name: "Halima Sadia",
    email: "halima.sadia@example.com",
    phone: "(513) 555-0184",
    location: "Cincinnati, OH",
    preferredContactFrequency: "monthly",
    notes: "Steady monthly giver across many causes.",
    seedDonations: [
      { daysAgo: 360, amount: 75, cause: "Water Wells", season: "Spring" },
      { daysAgo: 300, amount: 75, cause: "Orphan Sponsorship", season: "Summer" },
      { daysAgo: 240, amount: 75, cause: "Disaster Relief", season: "Fall" },
      { daysAgo: 180, amount: 75, cause: "Ramadan/Iftar", season: "Winter" },
      { daysAgo: 120, amount: 75, cause: "Back to School", season: "Winter" },
      { daysAgo: 60, amount: 75, cause: "General Sadaqah", season: "Spring" },
      { daysAgo: 15, amount: 75, cause: "Palestine Emergency", season: "Spring" },
    ],
  },

  // ===== Repayer (event-driven, mid value) =====
  {
    id: 85,
    name: "Imtiaz Bashir",
    email: "imtiaz.bashir@example.com",
    phone: "(714) 555-0185",
    location: "Anaheim, CA",
    notes: "Gives at events; not much outside of them.",
    seedDonations: [
      { daysAgo: 220, amount: 250, cause: "Annual Gala", campaign: "Autumn Appeal", season: "Fall", eventId: 8 },
      { daysAgo: 155, amount: 200, cause: "Year End Appeal", campaign: "Year End Appeal", season: "Year-End", eventId: 9 },
      { daysAgo: 45, amount: 300, cause: "Spring Charity Walk", campaign: "Spring 2026", season: "Spring", eventId: 10 },
    ],
    seedAttendees: [
      { eventId: 8, donationAmount: 250, attendeeType: "returning", engagementLevel: "high" },
      { eventId: 9, donationAmount: 200, attendeeType: "returning", engagementLevel: "high" },
      { eventId: 10, donationAmount: 300, attendeeType: "returning", engagementLevel: "high" },
    ],
  },
];

async function clearPriorSeed(): Promise<void> {
  // Delete prior seeded donations and attendees only (notes contain SEED_TAG).
  await db.delete(donationsTable).where(like(donationsTable.notes, `%${SEED_TAG}%`));
  await db.delete(attendeesTable).where(like(attendeesTable.notes, `%${SEED_TAG}%`));
}

async function upsertDonor(d: SeedDonor): Promise<number> {
  const [existing] = await db.select().from(donorsTable).where(eq(donorsTable.email, d.email));
  if (existing) {
    await db
      .update(donorsTable)
      .set({
        name: d.name,
        phone: d.phone,
        location: d.location,
        preferredContactFrequency: d.preferredContactFrequency ?? null,
        notes: d.notes ?? null,
      })
      .where(eq(donorsTable.id, existing.id));
    return existing.id;
  }
  // Insert with explicit id so existing donations resolve to a real donor.
  await db.insert(donorsTable).values({
    id: d.id,
    name: d.name,
    email: d.email,
    phone: d.phone,
    location: d.location,
    preferredContactFrequency: d.preferredContactFrequency ?? null,
    notes: d.notes ?? null,
  } as typeof donorsTable.$inferInsert);
  return d.id;
}

async function insertSeededDonations(donorId: number, donations: SeedDonation[]): Promise<void> {
  if (donations.length === 0) return;
  await db.insert(donationsTable).values(
    donations.map((s) => ({
      donorId,
      eventId: s.eventId ?? null,
      date: dateDaysAgo(s.daysAgo),
      amount: String(s.amount),
      cause: s.cause,
      campaign: s.campaign ?? null,
      season: s.season ?? null,
      donationType: s.donationType ?? "one-time",
      notes: SEED_TAG,
    })),
  );
}

async function insertSeededAttendees(
  donor: SeedDonor,
  donorId: number,
): Promise<void> {
  if (!donor.seedAttendees || donor.seedAttendees.length === 0) return;
  // Avoid duplicating attendee rows that already exist for this donor + event
  // (existing baseline rows are non-seeded — we leave them alone and skip
  // creating a parallel seeded duplicate for the same event).
  const existing = await db
    .select({ eventId: attendeesTable.eventId })
    .from(attendeesTable)
    .where(eq(attendeesTable.donorId, donorId));
  const existingEventIds = new Set(existing.map((a) => a.eventId));

  const rows = donor.seedAttendees
    .filter((a) => !existingEventIds.has(a.eventId))
    .map((a) => ({
      eventId: a.eventId,
      name: donor.name,
      email: donor.email,
      phone: donor.phone,
      attended: true,
      donated: a.donationAmount != null && a.donationAmount > 0,
      donationAmount: a.donationAmount != null ? String(a.donationAmount) : null,
      volunteerInterest: false,
      attendeeType: a.attendeeType ?? "returning",
      engagementLevel: a.engagementLevel ?? "medium",
      notes: SEED_TAG,
      donorId,
    }));
  if (rows.length === 0) return;
  await db.insert(attendeesTable).values(rows);
}

async function fixSerialSequence(): Promise<void> {
  // After explicit-id inserts, advance the donors id sequence past the max.
  await db.execute(
    sql`SELECT setval(pg_get_serial_sequence('donors','id'), GREATEST((SELECT COALESCE(MAX(id),1) FROM donors), 1))`,
  );
}

export async function seedDonors(): Promise<void> {
  console.log(`Seeding donors (today=${TODAY.toISOString().slice(0, 10)})...`);

  // Sanity: warn if any seeded eventId is not present.
  const events = await db.select({ id: eventsTable.id }).from(eventsTable);
  const eventIds = new Set(events.map((e) => e.id));
  for (const d of DONORS) {
    for (const dn of d.seedDonations ?? []) {
      if (dn.eventId != null && !eventIds.has(dn.eventId)) {
        console.warn(`  donor ${d.id}: donation references missing event ${dn.eventId}`);
      }
    }
    for (const a of d.seedAttendees ?? []) {
      if (!eventIds.has(a.eventId)) {
        console.warn(`  donor ${d.id}: attendee references missing event ${a.eventId}`);
      }
    }
  }

  await clearPriorSeed();

  let donorsUpserted = 0;
  let donationsAdded = 0;
  let attendeesAdded = 0;

  for (const d of DONORS) {
    const donorId = await upsertDonor(d);
    donorsUpserted++;
    if (d.seedDonations && d.seedDonations.length > 0) {
      await insertSeededDonations(donorId, d.seedDonations);
      donationsAdded += d.seedDonations.length;
    }
    if (d.seedAttendees && d.seedAttendees.length > 0) {
      const before = await db
        .select({ id: attendeesTable.id })
        .from(attendeesTable)
        .where(and(eq(attendeesTable.donorId, donorId), like(attendeesTable.notes, `%${SEED_TAG}%`)));
      await insertSeededAttendees(d, donorId);
      const after = await db
        .select({ id: attendeesTable.id })
        .from(attendeesTable)
        .where(and(eq(attendeesTable.donorId, donorId), like(attendeesTable.notes, `%${SEED_TAG}%`)));
      attendeesAdded += after.length - before.length;
    }
  }

  await fixSerialSequence();

  // Clean up orphan donations whose donor row no longer exists. (Carryover from
  // earlier prod data where a donor was deleted but their donations weren't.)
  const deletedOrphanDonations = await db.execute(
    sql`DELETE FROM donations WHERE donor_id NOT IN (SELECT id FROM donors)`,
  );
  const orphanDonationCount = deletedOrphanDonations.rowCount ?? 0;
  if (orphanDonationCount > 0) {
    console.log(`Orphan donations removed: ${orphanDonationCount}`);
  }

  // Clean up orphan donors that aren't part of this seed and have no donations.
  // (E.g. carryover rows from earlier production deploys before the seed existed.)
  const seedEmails = new Set(DONORS.map((d) => d.email.toLowerCase()));
  const allRows = await db.select().from(donorsTable);
  let orphansDeleted = 0;
  for (const row of allRows) {
    const isSeeded = row.email && seedEmails.has(row.email.toLowerCase());
    if (isSeeded) continue;
    const donationCount = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(donationsTable)
      .where(eq(donationsTable.donorId, row.id));
    if ((donationCount[0]?.c ?? 0) === 0) {
      await db.delete(attendeesTable).where(eq(attendeesTable.donorId, row.id));
      await db.delete(donorsTable).where(eq(donorsTable.id, row.id));
      orphansDeleted++;
    }
  }
  if (orphansDeleted > 0) {
    console.log(`Orphan donors removed: ${orphansDeleted}`);
  }

  // Recompute stats for every donor (uses the source-of-truth helper).
  const allDonors = await db.select({ id: donorsTable.id }).from(donorsTable);
  for (const d of allDonors) {
    await recomputeDonorStats(d.id);
  }

  // Quick distribution summary.
  const final = await db.select().from(donorsTable);
  const byCategory: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  const byPersonality: Record<string, number> = {};
  for (const d of final) {
    byCategory[d.donorCategory] = (byCategory[d.donorCategory] ?? 0) + 1;
    byTier[d.donorTier] = (byTier[d.donorTier] ?? 0) + 1;
    const p = d.donorPersonalityType ?? "(none)";
    byPersonality[p] = (byPersonality[p] ?? 0) + 1;
  }

  // Integrity check: every donations.donor_id must resolve to a real donor.
  const orphanRows = await db.execute(
    sql`SELECT DISTINCT d.donor_id AS donor_id FROM donations d LEFT JOIN donors dn ON dn.id = d.donor_id WHERE dn.id IS NULL`,
  );
  const orphanIds = (orphanRows.rows as Array<{ donor_id: number }>).map((r) => r.donor_id);
  if (orphanIds.length > 0) {
    throw new Error(
      `Orphan donations found referencing missing donor IDs: ${orphanIds.join(", ")}. ` +
        `Add donor entries for these IDs in DONORS[] in this script.`,
    );
  }

  console.log(`Donors upserted: ${donorsUpserted}`);
  console.log(`Seeded donations added: ${donationsAdded}`);
  console.log(`Seeded attendees added: ${attendeesAdded}`);
  console.log(`Total donors in DB: ${final.length}`);
  console.log(`By category: ${JSON.stringify(byCategory)}`);
  console.log(`By tier: ${JSON.stringify(byTier)}`);
  console.log(`By personality: ${JSON.stringify(byPersonality)}`);
}

// CLI entry lives in scripts/seedDonorsCli.ts so the bundled server build
// doesn't accidentally invoke + exit during startup.
