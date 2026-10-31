/**
 * Single source of truth for all portfolio copy.
 * Every claim below is taken from Juvenn_Ravelliyo_Portfolio.pdf. Edit here, not in components.
 */

export type Img = { src: string; alt: string; w: number; h: number; caption?: string };
export type Stat = { value: string; label: string; scope: string };

export type ProjectKind = "hovarlay" | "npea" | "transcosmos" | "wushu";

export type Project = {
  slug: string;
  kind: ProjectKind;
  index: string;
  title: string;
  short: string;
  org: string;
  role: string;
  period: string;
  place: string;
  discipline: string;
  tagline: string;
  summary: string;
  context: string[];
  did: string[];
  stats: Stat[];
  outcome: string;
  tint: string; // css gradient used for project highlight chrome
  cover: Img | null;
  gallery: Img[];
  logo?: { src: string; alt: string };
};

const img = (src: string, w: number, h: number, alt: string, caption?: string): Img => ({
  src: `/img/${src}.webp`,
  w,
  h,
  alt,
  caption,
});

export const projects: Project[] = [
  {
    slug: "hovarlay-brand-content",
    kind: "hovarlay",
    index: "01",
    title: "HOVARLAY",
    short: "Brand system, content and outreach",
    org: "HOVARLAY",
    role: "Brand Strategist (Internship)",
    period: "Mar – Jul 2026",
    place: "Jakarta · Singapore-headquartered no-code AR MarTech startup",
    discipline: "Brand & content strategy",
    tagline: "A reusable brand kit, an education-led content series and the pitch material to carry both.",
    summary:
      "Inside a four-person core team, I built the systems that kept HOVARLAY's content consistent and the material that took its AR story to brands.",
    context: [
      "HOVARLAY is a Singapore-headquartered, no-code AR MarTech startup. I worked from Jakarta as a Brand Strategist intern from March to July 2026, alongside a core team of four that included both co-founders.",
      "The content I worked on argues that packaging doesn't have to be a one-way message: it can become a direct communication channel between a brand and its customers. My job was to make that idea easy to understand, easy to repeat on-brand, and easy to pitch.",
    ],
    did: [
      "Built a reusable brand template kit so every post, carousel and certificate stayed on-brand without starting from scratch",
      "Wrote the “Live Case Study” series that turned real AR campaigns into client education content",
      "Built the EN/ID pitch deck and partnership one-pagers for business development",
      "Sourced and qualified brand-partner leads with Apollo and SalesQL, then ran AR use-case outreach",
      "Produced AR workshop recap and testimonial videos and localized web copy into Bahasa Indonesia",
    ],
    stats: [
      { value: "4", label: "core team members, including both co-founders", scope: "Team context" },
      { value: "10+", label: "video edits of workshop recaps and testimonials", scope: "Produced by me" },
      { value: "EN / ID", label: "pitch deck, one-pagers and web copy", scope: "Bilingual delivery" },
    ],
    outcome:
      "The portfolio documents deliverables rather than measured business results for this part of the internship, so none are claimed here. The evidence is the work itself: the kit, the series, the decks and the videos.",
    tint: "linear-gradient(135deg, #1b3a8a 0%, #0f6a7f 55%, #d4542f 130%)",
    cover: img("work/hov-workshop", 586, 800, "Poster for The Augmented Designer Workshop at Design Centre FSRD ITB, 23 April 2026"),
    gallery: [
      img("work/hov-workshop", 586, 800, "The Augmented Designer Workshop poster, 23 April 2026", "Augmented Designer Workshop · 23 April 2026"),
      img("work/hov-webinar-duo", 566, 644, "Exclusive webinar poster featuring two speakers", "HOVARLAY × Creativeans webinar · 31 March 2026"),
      img("work/hov-listens", 567, 644, "Carousel slide: Most packaging talks, but it never listens", "“Most packaging talks, but it never listens.”"),
      img("work/hov-three-gaps", 567, 644, "Carousel slide listing three things brands don't know about customers", "Three things brands rarely know"),
      img("work/hov-didyouknow", 567, 644, "Did you know slide about digital ad reacquisition costs", "“Did you know?” data slide"),
      img("work/hov-webinar-invite", 566, 644, "Webinar invitation carousel slide", "Webinar invitation"),
    ],
    logo: { src: "/img/logos/hovarlay.png", alt: "HOVARLAY logo" },
  },
  {
    slug: "nusantara-packaging-experience-awards",
    kind: "npea",
    index: "02",
    title: "Nusantara Packaging Experience Awards 2026",
    short: "A national AR packaging design competition",
    org: "HOVARLAY",
    role: "Brand Strategist (Internship)",
    period: "Within Mar – Jul 2026",
    place: "Jakarta · National competition, theme “Oleh-Oleh Nusantara”",
    discipline: "Campaign content & outreach",
    tagline: "The content engine, jury handbook and outreach behind a national AR packaging competition.",
    summary:
      "I owned the content calendar, wrote the voice, authored the jury handbook and carried the sponsor and university outreach for a student design competition.",
    context: [
      "The Nusantara Packaging Experience Awards 2026 is an AR packaging student design competition under HOVARLAY, themed “Oleh-Oleh Nusantara”. The posters invite students to submit AR-enabled packaging concepts in English or Bahasa, with the Top 20 receiving nationwide recognition and rewards.",
      "A competition like this only works if three audiences move at once: students who submit, a jury that judges, and sponsors and universities that give it weight. My work sat across all three.",
    ],
    did: [
      "Owned the content calendar across IG, LinkedIn and Facebook: 20–30 posters, carousels and ad creatives",
      "Built the template system that kept every sponsor, jury and MoU post on-brand",
      "Wrote the voice: captions, ad copy, sponsor spotlights and official certificates",
      "Authored the Jury Handbook from scratch and coordinated with the 5-member panel",
      "Sent thousands of cold emails to recruit sponsors and universities, tracked in a spreadsheet",
      "Handled MOU/MOA documentation across 45–50 universities and polytechnics",
      "QA-tested the submission, judge and admin portals before major milestones",
    ],
    stats: [
      { value: "300+", label: "submissions to the competition", scope: "Competition result, not a personal metric" },
      { value: "IDR 80M+", label: "in prizes on offer", scope: "Competition prize pool" },
      { value: "40+", label: "content pieces for the campaign", scope: "Campaign output, as stated in the portfolio" },
      { value: "45–50", label: "universities and polytechnics in MOU/MOA documentation", scope: "Handled by me" },
    ],
    outcome:
      "The competition drew 300+ submissions with IDR 80M+ in prizes. These are results of the whole competition and its team; my documented contribution is the content, the jury handbook, the outreach and the MOU/MOA paperwork listed above.",
    tint: "linear-gradient(135deg, #d4542f 0%, #8a3a2a 60%, #0a374e 130%)",
    cover: img("work/npea-prizes", 623, 800, "Competition poster: prizes worth IDR 80M+ and Top 20 recognition"),
    gallery: [
      img("work/npea-prizes", 623, 800, "Prizes and recognition poster", "Prizes & recognition"),
      img("work/npea-jury", 640, 784, "Meet your jury poster", "Jury announcement"),
      img("work/npea-sponsors", 640, 798, "Call for sponsors and partners poster", "Call for sponsors & partners"),
      img("work/npea-asmat", 526, 656, "Educational slide about Papuan Asmat carving and AR", "Educational slide: Papuan Asmat"),
      img("work/npea-mockup", 526, 656, "Submission mockup example slide", "Mockup examples for submissions"),
      img("work/npea-scan", 525, 656, "One scan, many possibilities slide", "“One scan. Many possibilities.”"),
      img("work/npea-phygital", 526, 656, "What is phygital design slide", "“What is phygital design?”"),
    ],
    logo: { src: "/img/logos/hovarlay.png", alt: "HOVARLAY logo" },
  },
  {
    slug: "transcosmos-strategic-planning",
    kind: "transcosmos",
    index: "03",
    title: "Transcosmos",
    short: "New-business research and pitch material",
    org: "Transcosmos",
    role: "Strategic Planner (Internship)",
    period: "Sep 2025 – Feb 2026",
    place: "Jakarta · Japan-headquartered BPO and marketing agency",
    discipline: "Strategic planning & research",
    tagline: "Prospect research turned into pitch-ready decks for a new-business push across three industries.",
    summary:
      "I researched prospective accounts, mapped how brands could win attention in Indonesia, and turned that into proposal decks refined under manager review.",
    context: [
      "Transcosmos is a Japan-headquartered BPO and digital marketing business. I joined its Jakarta team as a Strategic Planner intern from September 2025 to February 2026, supporting a new-business push across three industries: automotive, F&B and fintech.",
      "The brief was research first: understand each prospective account, then decide what a pitch to them should say.",
    ],
    did: [
      "Researched 10–15 prospective accounts across automotive, F&B and fintech, notably Hyundai Capital, Pilot Pen, Warung Tani and Inaco",
      "Mapped how brands could enter and win attention in the Indonesian market",
      "Turned research into pitch-ready deck content in Figma, Canva and PowerPoint",
      "Refined every proposal under manager review through a live pitch cycle",
      "Supported a Japan-headquartered BPO and digital marketing company's new-business push across 3 industries",
    ],
    stats: [
      { value: "10–15", label: "prospective accounts researched", scope: "Researched by me" },
      { value: "3", label: "industries: automotive, F&B and fintech", scope: "Scope of the push" },
      { value: "2 weeks", label: "to run the invite-only promotional webinar", scope: "As stated in the portfolio" },
    ],
    outcome:
      "These organisations were researched prospects, not confirmed clients, and the portfolio documents no results for this work, so none are claimed. What it shows is the research-to-pitch discipline: proposals that were reviewed, tightened and tested in a live pitch cycle.",
    tint: "linear-gradient(135deg, #0a374e 0%, #0f6a7f 60%, #3aa0b5 130%)",
    cover: null,
    gallery: [
      img("work/tc-inaco", 511, 800, "Inaco and Buah creative, used as a prospect research reference", "Prospect research reference: Inaco"),
    ],
    logo: { src: "/img/logos/transcosmos.png", alt: "Transcosmos logo" },
  },
  {
    slug: "wushu-student-organization",
    kind: "wushu",
    index: "04",
    title: "Wushu Student Organization",
    short: "Webinar, talkshow identity and team coaching",
    org: "UKM Wushu, BINUS University",
    role: "Regional Secretary & Coach · Project Manager · Lead Creative",
    period: "Aug 2023 – Feb 2025",
    place: "BINUS University, Jakarta",
    discipline: "Project management & creative lead",
    tagline: "Three roles in one student organisation: run it, make it look right, and fill the room.",
    summary:
      "A 626-registration webinar, a talkshow identity delivered ahead of schedule, 3–4 events on tight budgets and 30+ members coached.",
    context: [
      "UKM Wushu is the Wushu student activity unit at BINUS University. Over eighteen months I held three roles in it: Regional Secretary & Coach, Project Manager and Lead Creative.",
      "It was my first place to practise what I now do professionally: plan something, bring people to it, and make it look like it deserves them.",
    ],
    did: [
      "Drove 626 registrations as Project Manager of the “Transforming Stress to Strength” webinar, using social campaigns and partnerships while leading marketing, design and operations",
      "Set the visual identity for the “Achieving Athletic Prestige in University” talkshow as Lead Creative, delivering assets ahead of schedule",
      "Ran records, communications and logistics as Secretary, delivering 3–4 events on IDR 2–3M budgets each",
      "Coached 30+ members as team coach",
    ],
    stats: [
      { value: "626", label: "webinar registrations driven through social media and partnership campaigns", scope: "Led by me as Project Manager" },
      { value: "30+", label: "members coached in Wushu training", scope: "As team coach" },
      { value: "3–4", label: "events coordinated, IDR 2–3M budget each", scope: "As Secretary" },
    ],
    outcome:
      "The webinar “Transforming Stress to Strength: Conquering Physical and Mental Health” took place on 20 December 2024 and drew 626 registrations. The talkshow identity was delivered ahead of schedule for the 30 November 2024 event. Certificates for both roles are in the credentials section.",
    tint: "linear-gradient(135deg, #8c2230 0%, #4c2b3b 55%, #0a374e 130%)",
    cover: img("work/wu-webinar", 450, 582, "Poster for the Wushu webinar Transforming Stress to Strength"),
    gallery: [
      img("work/wu-webinar", 450, 582, "Webinar poster: Transforming Stress to Strength", "Webinar · 20 Dec 2024"),
      img("work/wu-talkshow", 450, 582, "Talkshow poster: Achieving Athletic Prestige in University", "Talkshow · 30 Nov 2024"),
      img("work/wu-proposal", 565, 732, "Media partnership proposal cover", "Media partnership proposal"),
      img("work/wu-join", 565, 800, "Wushu BINUS recruitment poster", "Recruitment poster"),
      img("work/wu-recap", 653, 718, "Recap of Wushu routine training", "Training recap"),
      img("work/wu-appreciation", 718, 564, "Appreciation post collage", "Appreciation post"),
      img("work/wu-idulfitri", 526, 680, "Idul Fitri greeting post", "Holiday greetings"),
    ],
    logo: { src: "/img/logos/wushu.png", alt: "UKM Wushu BINUS logo" },
  },
];

export const getProject = (slug: string) => projects.find((p) => p.slug === slug);

export const evidence = [
  { value: 626, suffix: "", label: "webinar registrations", detail: "“Transforming Stress to Strength”, Wushu BINUS", scope: "I was Project Manager", who: "mine" },
  { value: 300, suffix: "+", label: "competition submissions", detail: "Nusantara Packaging Experience Awards 2026", scope: "Competition result. I ran content, jury and outreach", who: "team" },
  { value: 45, suffix: "–50", label: "universities & polytechnics", detail: "MOU/MOA documentation, NPEA 2026", scope: "Documentation I handled", who: "mine" },
  { value: 30, suffix: "+", label: "members coached", detail: "Wushu training, BINUS University", scope: "I was team coach", who: "mine" },
] as const;

export const evidenceMini = [
  "20–30 posters, carousels & ad creatives owned",
  "10+ video edits",
  "IDR 80M+ competition prizes",
  "3–4 events delivered",
  "EN/ID bilingual",
];

export const stages = [
  { n: "01", name: "Decode", line: "Find the real problem hiding behind the brief." },
  { n: "02", name: "Brainstorm", line: "Throw rough ideas on the board. Keep what bites." },
  { n: "03", name: "Position", line: "One sharp angle: who it's for, what we say, why it wins." },
  { n: "04", name: "Sharpen", line: "Cut everything that doesn't earn its place." },
  { n: "05", name: "Deliver", line: "Turn strategy into work that works in the real world." },
];

export const threeA = [
  { word: "Assess", line: "the situation." },
  { word: "Assemble", line: "the right plan and people." },
  { word: "Action", line: "it." },
];

export const experience = [
  {
    id: "hovarlay",
    role: "Brand Strategist",
    type: "Internship",
    org: "HOVARLAY",
    meta: "Jakarta · Singapore-headquartered no-code AR MarTech startup",
    dates: "Mar – Jul 2026",
    points: projects[0].did.slice(0, 3).concat(projects[1].did.slice(0, 1)),
    slug: projects[0].slug,
    logo: "/img/logos/hovarlay.png",
  },
  {
    id: "transcosmos",
    role: "Strategic Planner",
    type: "Internship",
    org: "Transcosmos",
    meta: "Jakarta · Japan-headquartered BPO and marketing agency",
    dates: "Sep 2025 – Feb 2026",
    points: projects[2].did.slice(0, 4),
    slug: projects[2].slug,
    logo: "/img/logos/transcosmos.png",
  },
  {
    id: "wushu",
    role: "Regional Secretary & Coach · Project Manager · Lead Creative",
    type: "Student organization",
    org: "UKM Wushu, BINUS University",
    meta: "BINUS University, Jakarta",
    dates: "Aug 2023 – Feb 2025",
    points: projects[3].did,
    slug: projects[3].slug,
    logo: "/img/logos/wushu.png",
  },
];

export const coreSkills = [
  { name: "Market Research", note: "Benchmarking, prospect and market mapping" },
  { name: "Brand Strategy", note: "Positioning: who it's for, what we say, why it wins" },
  { name: "Content Strategy", note: "Calendars, templates, voice and copy" },
  { name: "Strategic Planning", note: "Plans, pitch decks and the people to carry them" },
];

export const tools = {
  build: ["Figma", "Canva", "CapCut", "Google Workspace", "PowerPoint"],
  ai: ["Claude", "ChatGPT", "Gemini"],
  outreach: ["Apollo", "SalesQL"],
};

export const education = {
  degree: "BSc Information Systems & BA Management",
  school: "BINUS University (Bina Nusantara University)",
  dates: "Aug 2022 – Dec 2026",
  facts: [
    { k: "Credits", v: "All 180 completed" },
    { k: "GPA", v: "3.4 / 4.00" },
    { k: "Graduating", v: "December 2026" },
  ],
  courses: [
    "Digital Market Research",
    "User Experience Research & Design",
    "Operations Management",
    "Enterprise Systems",
    "Information Systems Concept",
  ],
  research: {
    title: "Analyzing AI Algorithms: Phenomenon of Relevance in Optimizing Content and Accelerating Digital Advancement",
    authors: "Juvenn Elkins Ravelliyo, Yulius Lie and Lasmy Lasmy",
    where: "Presented at the International Conference on ICT for Smart Society (ICISS) 2026, an IEEE international conference, Institut Teknologi Bandung, 26–27 August 2026",
  },
  earlier: {
    school: "Christian Kanaan Vocational School",
    detail: "Multimedia, 2019–2022. 1st place in a language and design poster competition.",
  },
};

export type Cert = { src: string; title: string; detail: string; date: string; alt: string };
export const certs: Cert[] = [
  {
    src: "/img/certs/iciss.webp",
    title: "Presenter, ICISS 2026",
    detail: "International Conference on ICT for Smart Society, Institut Teknologi Bandung",
    date: "26–27 Aug 2026",
    alt: "Certificate of appreciation naming Juvenn Elkins Ravelliyo as presenter at ICISS 2026",
  },
  {
    src: "/img/certs/binus-secretary.webp",
    title: "Secretary, Wushu 2024/2025",
    detail: "Certificate of Appreciation, BINUS University",
    date: "12 Mar 2025",
    alt: "BINUS University certificate of appreciation for Juvenn Elkins Ravelliyo as Secretary of Wushu 2024/2025",
  },
  {
    src: "/img/certs/committee-pm.webp",
    title: "Project Manager, health webinar",
    detail: "Certificate of Committee, “Transforming Stress to Strength”",
    date: "20 Dec 2024",
    alt: "Certificate of committee naming Juvenn Elkins Ravelliyo as Project Manager of the health webinar",
  },
  {
    src: "/img/certs/creative-division.webp",
    title: "Creative Division, talkshow",
    detail: "Certificate of Appreciation, “Achieving Athletic Prestige in University”",
    date: "30 Nov 2024",
    alt: "Certificate of appreciation for Juvenn Elkins Ravelliyo, Creative Division of the talkshow",
  },
];

export const logos = [
  { src: "/img/logos/hovarlay.png", alt: "HOVARLAY", w: 90 },
  { src: "/img/logos/transcosmos.png", alt: "Transcosmos", w: 110 },
  { src: "/img/logos/binus.png", alt: "BINUS University", w: 100 },
  { src: "/img/logos/wushu.png", alt: "UKM Wushu BINUS", w: 86 },
];
