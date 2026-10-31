// Everything the house says about Nishant, in one place. The facts come from the "Ship Log" portfolio
// (My_portfolio/frontend/src/content); the short lines are what he says in each room, in speech bubbles.
// Edit this file to change the story without touching the scene.

export const profile = {
  name: "Nishant Sourav",
  role: "Frontend Engineer",
  location: "Noida, India",
  experience: "3+ years",
  availability: "Open to frontend roles",
  email: "nishant.sharma8507966@gmail.com",
  resumeUrl: "/Nishant-Sourav-Resume.pdf",
  headline: "I ship frontends that hold up in production.",
  summary:
    "Frontend engineer building React and Next.js products for real users: an AI tools platform, multi-provider billing for an Instagram automation SaaS, and emissions-reporting dashboards. I measure the work: Lighthouse 62 → 91, page loads 35% faster.",
  links: {
    github: "https://github.com/Remaker00",
    linkedin: "https://www.linkedin.com/in/nishant-sourav-bb5b02269/",
    source: "https://github.com/Remaker00/my_house",
  },
} as const;

export type RoomId = "attic" | "library" | "workshop" | "office" | "door";

/** Rooms in story order: the order of the words under the house and of the text version. */
export const ROOM_ORDER: readonly RoomId[] = ["attic", "library", "workshop", "office", "door"];

export interface Chapter {
  id: RoomId;
  name: string; // the room, as written under the house
  title: string; // the chapter's heading in the notebook
  /** What he says when he gets there: one bubble per entry, a few short lines each. */
  lines: readonly (readonly string[])[];
}

export const CHAPTERS: Record<RoomId, Chapter> = {
  attic: {
    id: "attic",
    name: "attic",
    title: "Where I began",
    lines: [
      ["This is where it started.", "Electrical & Electronics, 2019–2023."],
      ["Circuits first.", "Then a deliberate switch to software."],
      ["A year of full-stack training", "at Sharpener, and I was hooked."],
    ],
  },
  library: {
    id: "library",
    name: "library",
    title: "What I know",
    lines: [
      ["React, Next.js and TypeScript", "are the books I reach for most."],
      ["The worn ones on this shelf:", "performance, Core Web Vitals, Playwright."],
    ],
  },
  workshop: {
    id: "workshop",
    name: "workshop",
    title: "What I built",
    lines: [
      ["Things I've shipped.", "Each one is live."],
      ["Pick one up.", "I'll tell you how it was made."],
    ],
  },
  office: {
    id: "office",
    name: "office",
    title: "Where I worked",
    lines: [
      ["Two years at ByteQuest,", "shipping for thousands of users."],
      ["Lighthouse 62 → 91.", "Page loads 35% faster."],
    ],
  },
  door: {
    id: "door",
    name: "front door",
    title: "Say hello",
    lines: [
      ["I'm open to frontend roles.", "The door's open too."],
      ["My email and résumé", "are right here."],
    ],
  },
};

/** What he says when you first arrive, and when you point at him. */
export const HELLO = {
  arrive: [["Hi, I'm Nishant."], ["I build frontends", "that hold up in production."], ["Have a look around.", "Pick any room."]],
  poke: [["Hi!"], ["Still here."], ["Pick a room,", "I'll show you."], ["Hello again."]],
} as const;

// ── The workshop: projects ─────────────────────────────────────────────────────

export type ProjectId = "poweredbyai" | "zaprep" | "envirobyte";

export interface Project {
  id: ProjectId;
  product: string;
  category: string;
  period: string;
  url: string;
  urlLabel: string;
  summary: string;
  metrics: readonly { value: string; label: string }[];
  scope: readonly string[]; // what I owned and built
  quality?: readonly string[]; // how it was verified before it shipped
  stack: readonly string[];
  /** What he says holding it up. */
  line: readonly string[];
}

export const PROJECTS: readonly Project[] = [
  {
    id: "poweredbyai",
    product: "PoweredByAI",
    category: "AI tools platform",
    period: "Oct 2025 – Jul 2026",
    url: "https://poweredbyai.app/",
    urlLabel: "poweredbyai.app",
    summary:
      "An AI-powered discovery platform that scaled past 10,000 tool listings. I optimized its frontend architecture and rendering pipeline and shipped its AI-powered features.",
    metrics: [
      { value: "35%", label: "faster app performance" },
      { value: "10+", label: "AI features shipped" },
      { value: "10,000+", label: "tool listings" },
    ],
    scope: [
      "Reworked the frontend architecture and rendering pipeline (caching, code splitting, lazy loading and asset optimization) for a 35% performance gain.",
      "Built and shipped 10+ AI-powered features and API-driven workflows.",
      "Implemented authentication, search and analytics across the platform.",
    ],
    quality: [
      "Introduced Playwright end-to-end tests covering the critical user journeys.",
      "Catches regressions early and strengthens release confidence.",
    ],
    stack: ["Next.js", "React", "TypeScript", "Caching", "Playwright", "SEO"],
    line: ["PoweredByAI: 10,000+ AI tools.", "I made it 35% faster."],
  },
  {
    id: "zaprep",
    product: "Zaprep",
    category: "Instagram automation & engagement platform",
    period: "Jul 2026 – Sep 2026",
    url: "https://www.zaprep.com/",
    urlLabel: "zaprep.com",
    summary:
      "An Instagram DM automation platform for creators and businesses, built on the official Meta API. I engineered its billing system.",
    metrics: [{ value: "3", label: "payment providers unified" }],
    scope: [
      "Engineered a centralized billing module integrating Razorpay, Dodo Payments and Stripe behind one interface.",
      "Implemented reusable payment, subscription, checkout, refund, cancellation and webhook workflows.",
      "Standardized billing operations across all three providers, reducing integration complexity.",
    ],
    stack: ["Next.js", "TypeScript", "Stripe", "Razorpay", "Dodo Payments", "Webhooks"],
    line: ["Zaprep: three payment providers,", "one billing module."],
  },
  {
    id: "envirobyte",
    product: "EnviroByte",
    category: "Sustainability & emissions reporting",
    period: "Jul 2025 – Oct 2025",
    url: "https://www.envirobyte.com/",
    urlLabel: "envirobyte.com",
    summary: "A sustainability and emissions reporting platform for regulated facilities. I built its interactive reporting dashboards.",
    metrics: [{ value: "30%", label: "more efficient reporting" }],
    scope: [
      "Developed interactive sustainability and emissions dashboards in React and Next.js.",
      "Built reusable UI components and scalable data-visualization interfaces.",
      "Improved maintainability and the day-to-day reporting experience.",
    ],
    stack: ["Next.js", "React", "Data visualization"],
    line: ["EnviroByte: emissions dashboards.", "Reporting got 30% more efficient."],
  },
];

// ── The office: work and study ───────────────────────────────────────────────

export interface CareerEntry {
  id: string;
  period: string;
  role: string;
  organization: string;
  note: string;
  impact?: readonly { value: string; label: string }[];
}

export const CAREER: readonly CareerEntry[] = [
  {
    id: "bytequest",
    period: "Jul 2024 – Sep 2026 · Noida",
    role: "Frontend Developer",
    organization: "ByteQuest Softwares (011BQ)",
    note: "Architected and maintained high-performance React and Next.js applications serving thousands of users (PoweredByAI, Zaprep and EnviroByte) with a focus on responsiveness, SEO and production reliability.",
    impact: [
      { value: "62 → 91", label: "Lighthouse performance" },
      { value: "−35%", label: "page load time" },
      { value: "40+", label: "reusable components" },
      { value: "20+", label: "production features" },
      { value: "50+", label: "production issues resolved" },
      { value: "−25%", label: "recurring defects" },
    ],
  },
  {
    id: "sharpener",
    period: "Jun 2023 – May 2024",
    role: "Full-Stack Course",
    organization: "Sharpener Tech",
    note: "Intensive project-based training across React, Node.js, Express, databases and deployment.",
  },
  {
    id: "mvit",
    period: "Aug 2019 – May 2023",
    role: "B.E. Electrical & Electronics",
    organization: "Sir M. Visvesvaraya Institute of Technology",
    note: "Engineering foundation, then a deliberate switch into software.",
  },
];

// ── The library: skills ──────────────────────────────────────────────────────

export type SkillGroup = "build" | "optimize" | "integrate";

export const SKILL_GROUPS: Record<SkillGroup, string> = {
  build: "Build",
  optimize: "Optimize & verify",
  integrate: "Integrate & ship",
};

/** Core skills are the thick, worn books. */
export const SKILLS: readonly { name: string; group: SkillGroup; core?: boolean }[] = [
  { name: "React", group: "build", core: true },
  { name: "Next.js", group: "build", core: true },
  { name: "TypeScript", group: "build", core: true },
  { name: "JavaScript", group: "build" },
  { name: "Redux", group: "build" },
  { name: "Tailwind CSS", group: "build" },
  { name: "SSR / SSG", group: "build" },
  { name: "System Design", group: "build" },
  { name: "Core Web Vitals", group: "optimize", core: true },
  { name: "Performance", group: "optimize", core: true },
  { name: "Caching & Revalidation", group: "optimize" },
  { name: "Playwright", group: "optimize", core: true },
  { name: "SEO", group: "optimize" },
  { name: "REST APIs", group: "integrate" },
  { name: "Payments", group: "integrate" },
  { name: "Node.js", group: "integrate" },
  { name: "Express", group: "integrate" },
  { name: "RAG", group: "integrate" },
  { name: "Postman", group: "integrate" },
  { name: "Git & GitHub", group: "integrate" },
  { name: "Vercel", group: "integrate" },
];
