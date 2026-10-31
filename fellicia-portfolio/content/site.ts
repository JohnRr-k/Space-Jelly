/**
 * Central content file. Every piece of text on the site comes from here.
 * Project descriptions are the original English passages from the supplied
 * "Professional Portfolio" PDF and must not be shortened or rewritten.
 */

export const person = {
  name: 'Fellicia Angelica Kholim',
  nameUpper: 'FELLICIA ANGELICA KHOLIM',
  designation: 'S.H., CLA.',
  position: 'Junior Associate',
  firm: 'FRP Law Firm',
  email: 'felliciaangelicaa@gmail.com',
  linkedin: 'https://www.linkedin.com/in/fellicia-angelica-kholim-s-h-cla-716990224/',
  // The portfolio also lists a phone number. It is deliberately NOT published until the client confirms.
  positioning: ['Corporate Law', 'Regulatory Compliance', 'Legal Advisory'],
  disciplines: ['Corporate Law', 'Regulatory Compliance', 'Legal Advisory', 'Dispute Resolution', 'Corporate Governance'],
};

/** English passage of the "About Me" slide, verbatim. */
export const about = {
  text: 'I am a Bachelor of Laws graduate from Tarumanagara University with a GPA of 3.91/4.00 and a Certified Legal Auditor (CLA). Currently, I work as a Junior Associate at FRP Law Firm, with professional experience in corporate law, regulatory compliance, legal advisory, and dispute resolution. Throughout my career, I have been involved in various corporate legal projects, strengthening my analytical, problem-solving, and legal risk assessment skills.',
  closing:
    'I look forward to the opportunity to apply my legal expertise, analytical capabilities, and professional experience to contribute meaningfully to the company’s objectives, while continuously enhancing my competencies and delivering lasting value.',
};

export const nav = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'expertise', label: 'Expertise' },
  { id: 'experience', label: 'Experience' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'contact', label: 'Contact' },
] as const;

/* ------------------------------------------------------------------ */
/* Expertise                                                            */
/* ------------------------------------------------------------------ */

export type CategoryId = 'corporate-law' | 'regulatory-compliance' | 'legal-advisory' | 'dispute-resolution';

export const categories: { id: CategoryId; label: string; sub: string }[] = [
  { id: 'corporate-law', label: 'Corporate Law', sub: 'Corporate Governance' },
  { id: 'regulatory-compliance', label: 'Regulatory Compliance', sub: 'Personal Data Protection · ISO 37301 · Internal Regulatory Review' },
  { id: 'legal-advisory', label: 'Legal Advisory', sub: 'Employee Liability · ICT Infrastructure Contracts' },
  { id: 'dispute-resolution', label: 'Dispute Resolution', sub: 'Employee Disciplinary Dispute · Consumer Protection' },
];

export const relatedExperience = [
  'Corporate Governance',
  'Legal Due Diligence',
  'Personal Data Protection',
  'Contract Review',
  'Employee Relations and Disciplinary Matters',
  'Risk Assessment',
  'Consumer Protection',
  'ISO 37301 Compliance',
];

/* ------------------------------------------------------------------ */
/* Selected legal engagements                                           */
/* ------------------------------------------------------------------ */

export type Figure = {
  src: string; // path inside /media
  alt: string;
  caption: string;
  w: number;
  h: number;
  /** Client-related document or photograph: withheld in the public edition until approved. */
  restricted?: boolean;
};

/** Special popup element per engagement. Items are phrases taken from the engagement's own description. */
export type Scope =
  | { kind: 'count'; from: number; to: number; label: string; title: string; items: string[] }
  | { kind: 'flow' | 'stack' | 'orbit'; title: string; items: string[]; center?: string }
  | { kind: 'pair'; title: string; items: [string, string]; back: string[] };

export type Project = {
  id: string;
  n: string;
  title: string;
  /** Title as printed (in English) in the supplied portfolio. */
  formalTitle: string;
  organization: string;
  category: CategoryId;
  tags: string[];
  description: string;
  visual: 'duo' | 'wide' | 'arch' | 'doc';
  /** Colour world of the popup. */
  tone: 'dark' | 'ivory' | 'burg';
  scope: Scope;
  figures: Figure[];
};

import { PUBLIC_MODE } from '@/lib/media';

const projectData: Project[] = [
  {
    id: 'employee-liability-restructuring',
    n: '01',
    title: 'Employee Liability Restructuring',
    formalTitle: 'Legal Advisory on Employee Liability Restructuring, PT Pos Indonesia',
    organization: 'PT Pos Indonesia',
    category: 'legal-advisory',
    tags: ['Legal Advisory', 'Regulatory Compliance', 'Risk Assessment'],
    description:
      'Provided legal support in reviewing employee-related financial obligations, including the restructuring of liability components from seven to three. The assessment focused on regulatory compliance, alignment with applicable audit standards, and identification of potential legal risks arising from the restructuring process.',
    visual: 'duo',
    tone: 'dark',
    scope: { kind: 'count', from: 7, to: 3, label: 'Liability components', title: 'Restructuring of liability components', items: ['Regulatory compliance', 'Alignment with applicable audit standards', 'Potential legal risks'] },
    figures: PUBLIC_MODE
      ? []
      : [
          {
            src: 'projects/p01-meeting-2.webp',
            alt: 'Video-conference screen showing a coordination meeting room',
            caption: 'Coordination Meeting with the Board of Directors (BoD) of PT Pos Indonesia',
            w: 540,
            h: 648,
            restricted: true,
          },
          {
            src: 'projects/p01-meeting-1.webp',
            alt: 'Presentation screen showing an actuarial report during an explanation session',
            caption: 'Legal Assistance to PT Pos Indonesia During an Actuarial Presentation and Explanation Session',
            w: 456,
            h: 460,
            restricted: true,
          },
        ],
  },
  {
    id: 'legal-due-diligence-internal-regulatory-review',
    n: '02',
    title: 'Legal Due Diligence & Internal Regulatory Review',
    formalTitle: 'Legal Due Diligence & Internal Regulatory Review, PT Pos Indonesia',
    organization: 'PT Pos Indonesia',
    category: 'regulatory-compliance',
    tags: ['Regulatory Compliance', 'Legal Due Diligence', 'Personal Data Protection'],
    description:
      'Conducted a Legal Due Diligence (LDD) on internal policies and the Board of Directors’ decision-making structure, including the drafting and review of Board of Directors’ Resolutions concerning Personal Data Protection. The scope of work included assessing the compliance of internal policies with the Personal Data Protection Law, SOE regulations, and strengthening data protection governance within the company’s organizational structure.',
    visual: 'wide',
    tone: 'ivory',
    scope: { kind: 'stack', title: 'Scope of the review', items: ['Internal policies', 'Board of Directors’ decision-making structure', 'Board of Directors’ Resolutions on Personal Data Protection', 'Compliance with the Personal Data Protection Law and SOE regulations'] },
    figures: PUBLIC_MODE
      ? []
      : [
          {
            src: 'projects/p02-ldd-matrix.webp',
            alt: 'Spreadsheet matrix comparing provisions of the Personal Data Protection Law with internal policy articles, with analysis, conclusion and recommendation columns',
            caption: 'Illustrative Legal Due Diligence Implementation Matrix',
            w: 914,
            h: 448,
            restricted: true,
          },
        ],
  },
  {
    id: 'employee-disciplinary-dispute',
    n: '03',
    title: 'Employee Disciplinary Dispute',
    formalTitle: 'Legal Advisory on Employee Disciplinary Dispute, PT Pos Indonesia',
    organization: 'PT Pos Indonesia',
    category: 'dispute-resolution',
    tags: ['Dispute Resolution', 'Employee Relations and Disciplinary Matters', 'Risk Assessment'],
    description:
      'Provided legal support in an employment dispute involving a PT Pos Indonesia (Persero) employee who challenged disciplinary sanctions imposed following allegations of fraudulent conduct. The legal assessment focused on reviewing the grounds for disciplinary action, evaluating supporting evidence and internal investigation findings, and assessing compliance with applicable labor regulations and company policies. The engagement aimed to identify potential legal risks and formulate appropriate recommendations for dispute resolution while considering employee rights and corporate interests.',
    visual: 'wide',
    tone: 'burg',
    scope: { kind: 'flow', title: 'Legal assessment', items: ['Grounds for disciplinary action', 'Supporting evidence and internal investigation findings', 'Compliance with labor regulations and company policies', 'Recommendations for dispute resolution'] },
    figures: PUBLIC_MODE
      ? []
      : [
          {
            src: 'projects/p03-disciplinary-matrix.webp',
            alt: 'Matrix classifying types of alleged disciplinary violations against sanction levels',
            caption: 'Matrix for Assessing Alleged Employee Disciplinary Violations',
            w: 830,
            h: 549,
            restricted: true,
          },
        ],
  },
  {
    id: 'good-corporate-governance-harmonization',
    n: '04',
    title: 'Harmonization of Good Corporate Governance Framework',
    formalTitle: 'Harmonization of Good Corporate Governance Framework, PT Petrokimia Gresik',
    organization: 'PT Petrokimia Gresik',
    category: 'corporate-law',
    tags: ['Corporate Governance', 'Regulatory Compliance', 'SOE Regulations'],
    description:
      'Conducted a review and harmonization of Good Corporate Governance (GCG) assessment parameters and internal evaluation working papers to ensure alignment with applicable State-Owned Enterprise (SOE) regulations and good corporate governance principles. The scope of work included reviewing GCG assessment parameters, evaluating the Board Policy Manual (BPM) and Corporate Policy Manual (CPM), developing recommendations for policy improvements, and aligning corporate documents with GCG principles.',
    visual: 'wide',
    tone: 'ivory',
    scope: { kind: 'stack', title: 'Scope of work', items: ['GCG assessment parameters', 'Board Policy Manual (BPM)', 'Corporate Policy Manual (CPM)', 'Recommendations for policy improvements', 'Alignment with GCG principles'] },
    figures: PUBLIC_MODE
      ? []
      : [
          {
            src: 'projects/p04-gcg-harmonization.webp',
            alt: 'Working-paper spreadsheet mapping regulatory articles to internal corporate policy documents with a colour-coded alignment classification',
            caption:
              'Illustrative Results of Good Corporate Governance (GCG) Principles Harmonization within a Client Company’s Internal Policy and Regulatory Framework',
            w: 919,
            h: 532,
            restricted: true,
          },
        ],
  },
  {
    id: 'board-and-corporate-policy-manuals',
    n: '05',
    title: 'Development of Board Policy Manual & Corporate Policy Manual',
    formalTitle: 'Development of Board Policy Manual & Corporate Policy Manual, PT Solusi Energy Nusantara',
    organization: 'PT Solusi Energy Nusantara',
    category: 'corporate-law',
    tags: ['Corporate Governance', 'Policy Drafting', 'Risk Management'],
    description:
      'Developed the Board Policy Manual (BPM) and Corporate Policy Manual (CPM) for PT Solusi Energy Nusantara through comprehensive legal and regulatory analysis, formulation of internal corporate policies, and mapping of the authorities and responsibilities of corporate governing bodies. The manuals were developed using a compliance-based and risk management approach to strengthen oversight mechanisms, clarify decision-making processes, and enhance accountability, transparency, and the effective implementation of Good Corporate Governance (GCG) principles.',
    visual: 'duo',
    tone: 'dark',
    scope: { kind: 'pair', title: 'Two manuals', items: ['Board Policy Manual', 'Corporate Policy Manual'], back: ['Mapping of governing bodies’ authorities and responsibilities', 'Stronger oversight mechanisms', 'Clearer decision-making processes', 'Accountability and transparency'] },
    figures: PUBLIC_MODE
      ? []
      : [
          {
            src: 'projects/p05-bpm.webp',
            alt: 'Cover page of the Board Policy Manual, 2026',
            caption: 'Developed Board Policy Manual (BPM) for PT Solusi Energy Nusantara',
            w: 355,
            h: 556,
            restricted: true,
          },
          {
            src: 'projects/p05-cpm.webp',
            alt: 'Cover page of the Corporate Policy Manual, 2026',
            caption: 'Developed Corporate Policy Manual (CPM) for PT Solusi Energy Nusantara',
            w: 374,
            h: 536,
            restricted: true,
          },
        ],
  },
  {
    id: 'personal-data-protection-compliance',
    n: '06',
    title: 'Evaluation of Personal Data Protection Compliance',
    formalTitle: 'Evaluation of Personal Data Protection Compliance in the PDP Policy and Its Implementing Regulations, PT Petrokimia Gresik',
    organization: 'PT Petrokimia Gresik',
    category: 'regulatory-compliance',
    tags: ['Regulatory Compliance', 'Personal Data Protection', 'Gap Analysis'],
    description:
      'Prepared a comprehensive evaluation framework for PT Petrokimia Gresik’s Personal Data Protection (PDP) Guidelines to assess regulatory compliance with the Personal Data Protection Law. The assessment involved a legal gap analysis of existing internal policies and the formulation of strategic recommendations to enhance regulatory compliance, mitigate legal risks, and strengthen the company’s data governance framework.',
    visual: 'duo',
    tone: 'ivory',
    scope: { kind: 'flow', title: 'Assessment', items: ['Evaluation framework for the PDP Guidelines', 'Legal gap analysis of existing internal policies', 'Strategic recommendations'] },
    figures: PUBLIC_MODE
      ? []
      : [
          {
            src: 'projects/p06-pdp-cover.webp',
            alt: 'Chapter cover reading “Review and Evaluation of Personal Data Protection Guidelines”',
            caption: 'Illustration of Personal Data Protection Guidelines Evaluation',
            w: 408,
            h: 352,
            restricted: true,
          },
          {
            src: 'projects/p06-pdp-matrix.webp',
            alt: 'Working-paper matrix evaluating internal policy against the Personal Data Protection Law with colour-coded compliance results',
            caption: 'Illustration of Personal Data Protection Guidelines Evaluation (working paper)',
            w: 766,
            h: 320,
            restricted: true,
          },
        ],
  },
  {
    id: 'iso-37301-compliance-management-system',
    n: '07',
    title: 'ISO 37301-Based Compliance Management System',
    formalTitle: 'Compliance Assessment of ISO 37301-Based Compliance Management System for a Corporate Client',
    organization: 'Corporate Client',
    category: 'regulatory-compliance',
    tags: ['Regulatory Compliance', 'ISO 37301 Compliance', 'Gap Analysis', 'Risk Assessment'],
    description:
      'Provided comprehensive ISO 37301-based compliance analysis to ensure the alignment of internal policies and procedures with international standards and applicable legal requirements. Through a gap analysis and risk-based compliance approach, the engagement not only identified potential compliance gaps but also delivered actionable strategic recommendations to strengthen internal control systems, mitigate legal risks, and enhance corporate credibility and stakeholder confidence.',
    visual: 'duo',
    tone: 'burg',
    scope: { kind: 'orbit', title: 'Approach and outcomes', center: 'ISO 37301', items: ['Gap analysis', 'Risk-based compliance', 'Internal control systems', 'Legal risk mitigation', 'Stakeholder confidence'] },
    figures: PUBLIC_MODE
      ? []
      : [
          {
            src: 'projects/p07-iso-standard.webp',
            alt: 'Cover of the ISO 37301 international standard on compliance management systems',
            caption: 'Representation of ISO analysis prepared for a corporate client',
            w: 261,
            h: 246,
            restricted: true,
          },
          {
            src: 'projects/p07-iso-matrix.webp',
            alt: 'Matrix reviewing elements of the ISO 37301 standard with review results and recommendations',
            caption: 'Representation of ISO analysis prepared for a corporate client (matrix)',
            w: 687,
            h: 258,
            restricted: true,
          },
        ],
  },
  {
    id: 'digital-services-consumer-protection',
    n: '08',
    title: 'Digital Services & Consumer Protection Compliance',
    formalTitle: 'Digital Services & Consumer Protection Compliance',
    organization: 'FRP Law Firm',
    category: 'dispute-resolution',
    tags: ['Dispute Resolution', 'Consumer Protection', 'Regulatory Compliance'],
    description:
      'Provides legal assistance in consumer protection matters arising from digital platform-based services. The engagement includes assessing business compliance with service obligations, consumers’ rights to accurate and transparent information, and legal responsibilities arising from service deficiencies or disputes. FRP Law Firm conducts legal analysis, evaluates digital service compliance aspects, and develops strategic approaches for dispute resolution through consumer protection mechanisms, including assistance before the Consumer Dispute Resolution Body (BPSK), to safeguard the legal interests of the parties involved.',
    visual: 'arch',
    tone: 'ivory',
    scope: { kind: 'flow', title: 'Engagement', items: ['Compliance with service obligations', 'Consumers’ right to accurate and transparent information', 'Responsibility for service deficiencies or disputes', 'Dispute resolution, including before the BPSK'] },
    figures: [
      {
        src: 'projects/p08-consumer-protection-act.webp',
        alt: 'A book titled “Consumer Protection Act” with a gavel resting on it',
        caption: 'Consumer Protection Act (reference visual)',
        w: 883,
        h: 1249,
      },
    ],
  },
  {
    id: 'ict-infrastructure-contracts',
    n: '09',
    title: 'Legal Advisory & Review of ICT Infrastructure Contracts',
    formalTitle: 'Legal Advisory & Review of Information Technology (ICT) Infrastructure Contracts',
    organization: 'FRP Law Firm',
    category: 'legal-advisory',
    tags: ['Legal Advisory', 'Contract Review', 'Risk Assessment'],
    description:
      'Provides legal advisory services in the review and analysis of technology-based commercial agreements, including Information Technology (ICT) Infrastructure Agreements, Letters of Acceptance (LoA), and related contractual documents. The scope of work includes reviewing contractual structures, parties’ rights and obligations, payment provisions, contractual liabilities, and potential legal risks arising from technology project implementation. FRP Law Firm delivers legal analysis and strategic recommendations to ensure legal certainty, strengthen the client’s contractual position, and support the effective execution of technology-based business arrangements.',
    visual: 'doc',
    tone: 'dark',
    scope: { kind: 'orbit', title: 'Scope of review', center: 'ICT contracts', items: ['Contractual structures', 'Rights and obligations', 'Payment provisions', 'Contractual liabilities', 'Legal risks'] },
    figures: PUBLIC_MODE
      ? []
      : [
          {
            src: 'projects/p09-ict-contract.webp',
            alt: 'First page of a bilingual material and services procurement agreement template with blank fields highlighted',
            caption: 'Illustrative Representation of Information and Communication Technology Infrastructure Contract Assessment',
            w: 652,
            h: 636,
            restricted: true,
          },
        ],
  },
];

/**
 * Client-related figures sit behind `PUBLIC_MODE ? [] : [...]`. PUBLIC_MODE is a build-time constant,
 * so in the public edition the minifier drops those literals: neither files nor descriptions ship.
 */
export const projects: Project[] = projectData;

/* ------------------------------------------------------------------ */
/* Leadership                                                           */
/* ------------------------------------------------------------------ */

export const featuredRoles = [
  {
    period: '2022–2023',
    title: 'Deputy Head of Department, Student Activities Unit',
    org: 'Student Executive Board, Faculty of Law, Tarumanagara University',
  },
  {
    period: '2023–2024',
    title: 'Second Vice Chairperson',
    org: 'Student Executive Board, Faculty of Law, Tarumanagara University',
  },
];

/* ------------------------------------------------------------------ */
/* Education and credentials                                            */
/* ------------------------------------------------------------------ */

export const education = {
  qualification: 'Bachelor of Laws (S.H.)',
  institution: 'Tarumanagara University',
  period: '2021–2025',
  gpa: '3.91',
  gpaScale: '4.00',
  graduated: 'Graduated 17 January 2025',
};

export type DocFile = { src: string; thumb: string; alt: string; w: number; h: number };

export const credentialDocs: Record<'diploma' | 'pkpa1' | 'pkpa2' | 'cla', DocFile> = {
  diploma: {
    src: 'credentials/diploma-redacted.webp',
    thumb: 'credentials/diploma-redacted-thumb.webp',
    alt: 'Bachelor of Laws diploma from Universitas Tarumanagara, with identifying details redacted',
    w: 1023,
    h: 798,
  },
  pkpa1: {
    src: 'credentials/pkpa-1.webp',
    thumb: 'credentials/pkpa-1-thumb.webp',
    alt: 'PERADI certificate confirming attendance of the Special Education for the Advocate Profession, October 2025',
    w: 944,
    h: 668,
  },
  pkpa2: {
    src: 'credentials/pkpa-2.webp',
    thumb: 'credentials/pkpa-2-thumb.webp',
    alt: 'PERADI participant certificate for PKPA Class VIII, 3 to 18 October 2025',
    w: 944,
    h: 682,
  },
  cla: {
    src: 'credentials/cla-letter.webp',
    thumb: 'credentials/cla-letter-thumb.webp',
    alt: 'Letter of confirmation from LSP AHI announcing the result of the Certified Legal Auditor competency test',
    w: 768,
    h: 1088,
  },
};

export const credentials = [
  {
    id: 'llb',
    label: 'Bachelor’s Degree',
    title: 'Bachelor of Laws (S.H.)',
    issuer: 'Tarumanagara University',
    date: '2021–2025',
    status: 'Degree awarded',
    note: 'Graduated 17 January 2025. Cumulative GPA 3.91/4.00. Identifying details on the diploma preview are redacted.',
    docs: ['diploma'] as const,
  },
  {
    id: 'pkpa',
    label: 'Professional Education',
    title: 'Special Education for the Advocate Profession (PKPA)',
    issuer: 'Indonesian Advocates Association (PERADI)',
    date: 'October 2025',
    status: 'Participation certificate',
    note: 'PKPA PERADI Class VIII, held 3–18 October 2025. These certificates confirm completion of the education programme as a participant; they are not an advocate licence.',
    docs: ['pkpa1', 'pkpa2'] as const,
  },
  {
    id: 'cla',
    label: 'Professional Certification',
    title: 'Certified Legal Auditor (CLA)',
    issuer: 'Lembaga Sertifikasi Profesi Auditor Hukum Indonesia (LSP AHI)',
    date: 'August 2026',
    status: 'Certificate in process of issuance',
    note: 'The supplied document is a letter of confirmation issued by LSP AHI as a temporary official document concerning the CLA certification, affiliated with BNSP and Jimly Law School. It declares the participant competent following the assessment of 21–22 August 2026. The formal CLA certificate is currently still in the process of issuance.',
    docs: ['cla'] as const,
  },
];

/* ------------------------------------------------------------------ */
/* Certificates archive                                                 */
/* ------------------------------------------------------------------ */

export type CertCategory = 'achievement' | 'organisation' | 'committee';

export type Cert = {
  id: string;
  title: string;
  kind: string;
  issuer: string;
  period: string;
  year: string; // sort key
  category: CertCategory;
  summary: string;
  file: string;
  w: number;
  h: number;
  alt: string;
  /** Short label for the "further organisational experience" list. */
  role: string;
};

export const certCategoryLabels: Record<CertCategory, string> = {
  achievement: 'Achievements',
  organisation: 'Organisational roles',
  committee: 'Committees',
};

export const certs: Cert[] = [
  {
    id: 'debate',
    title: 'Third Place, Tarumanagara Internal Law Cup Debate Competition',
    kind: 'Certificate of achievement',
    issuer: 'Tarumanagara Internal Law Cup 2021, Faculty of Law, Tarumanagara University',
    period: '2021',
    year: '2021-1',
    category: 'achievement',
    summary: 'Awarded Third Place (Juara III) in the Tarumanagara Internal Law Cup 2021 debate competition.',
    file: 'certificates/debate',
    w: 983,
    h: 687,
    alt: 'Certificate awarding Fellicia Angelica Kholim Third Place in the Tarumanagara Internal Law Cup 2021 debate competition',
    role: 'Third Place, Debate Competition',
  },
  {
    id: 'young-member',
    title: 'Junior Member (Anggota Muda), Moot Court Community',
    kind: 'Certificate of membership',
    issuer: 'Moot Court Community (Komunitas Peradilan Semu), Faculty of Law, Tarumanagara University',
    period: '2021/2022',
    year: '2021-2',
    category: 'organisation',
    summary: 'Certificate recognising membership of the Moot Court Community as a Junior Member (Anggota Muda), period 2021/2022.',
    file: 'certificates/young-member',
    w: 828,
    h: 573,
    alt: 'Certificate naming Fellicia Angelica K as Junior Member of the Moot Court Community, 2021/2022',
    role: 'Junior Member',
  },
  {
    id: 'law-festival',
    title: 'Public Relations Division, Law Festival 2022',
    kind: 'E-certificate',
    issuer: 'Tarumanagara Law Festival 2022, Faculty of Law, Tarumanagara University',
    period: '7 January – 5 March 2022',
    year: '2022-1',
    category: 'committee',
    summary: 'Served in the Public Relations Division (Divisi Hubungan Masyarakat) of Law Festival 2022, themed “Bring Back the Excitement of Law”.',
    file: 'certificates/law-festival',
    w: 777,
    h: 547,
    alt: 'E-certificate for the Public Relations Division of Law Festival 2022',
    role: 'Public Relations Division, Law Festival 2022',
  },
  {
    id: 'moot',
    title: 'Third Place, Dean’s Trophy V Moot Court Competition',
    kind: 'Certificate of achievement',
    issuer: 'Moot Court Community (Komunitas Peradilan Semu), Faculty of Law, Tarumanagara University',
    period: '25 February 2022',
    year: '2022-2',
    category: 'achievement',
    summary: 'Awarded Third Place (Juara III) at the Dean’s Trophy V Moot Court Competition (Kompetisi Peradilan Semu Piala Dekan V), held on 25 February 2022.',
    file: 'certificates/moot',
    w: 828,
    h: 578,
    alt: 'Certificate awarding Fellicia Angelica Kholim Third Place at the Dean’s Trophy V Moot Court Competition',
    role: 'Third Place, Moot Court Competition',
  },
  {
    id: 'tilc-committee',
    title: 'Committee Member, Tarumanagara Internal Law Cup 2022',
    kind: 'Certificate of committee service',
    issuer: 'Tarumanagara Internal Law Cup IV, Faculty of Law, Tarumanagara University',
    period: '2022',
    year: '2022-3',
    category: 'committee',
    summary: 'Served as a committee member (Panitia) in the Tarumanagara Internal Law Cup 2022 programme (TILC IV).',
    file: 'certificates/tilc-committee',
    w: 798,
    h: 566,
    alt: 'Certificate naming Fellicia Angelica Kholim as committee member of Tarumanagara Internal Law Cup 2022',
    role: 'Committee Member, Tarumanagara Internal Law Cup 2022',
  },
  {
    id: 'end-year',
    title: 'Consumption Committee, End Year KPS 2022',
    kind: 'Certificate of participation',
    issuer: 'Moot Court Community (Komunitas Peradilan Semu), Faculty of Law, Tarumanagara University',
    period: '2022',
    year: '2022-4',
    category: 'committee',
    summary: 'Participated as a member of the Consumption Committee (Panitia Konsumsi) for End Year KPS 2022, “Create Solidarity and Together We Make Memories”.',
    file: 'certificates/end-year',
    w: 812,
    h: 570,
    alt: 'Certificate of participation as Consumption Committee for End Year KPS 2022',
    role: 'Consumption Committee, End Year KPS 2022',
  },
  {
    id: 'hrd-member',
    title: 'Member of Human Resource Development, Moot Court Community',
    kind: 'Certificate of membership',
    issuer: 'Moot Court Community (Komunitas Peradilan Semu), Faculty of Law, Tarumanagara University',
    period: '2022/2023',
    year: '2022-5',
    category: 'organisation',
    summary: 'Served as a Member of Human Resource Development in the Moot Court Community management, period 2022/2023.',
    file: 'certificates/hrd-member',
    w: 828,
    h: 572,
    alt: 'Certificate naming Fellicia Angelica Kholim as Member of Human Resource Development, KPS FH UNTAR 2022/2023',
    role: 'Member, Human Resource Development',
  },
  {
    id: 'leadership-training',
    title: 'Deputy Head of the Implementing Committee, Leadership Training',
    kind: 'Certificate of appreciation',
    issuer: 'Daily Management Board, Moot Court Community, Faculty of Law, Tarumanagara University',
    period: 'Year not stated on the certificate',
    year: '2022-6',
    category: 'organisation',
    summary: 'Certificate of appreciation (Sertifikat Penghargaan) for serving as Deputy Head of the Implementing Committee (Wakil Kepala Pelaksana) of the Leadership Training of the Daily Management Board of the Moot Court Community.',
    file: 'certificates/leadership-training',
    w: 777,
    h: 549,
    alt: 'Certificate of appreciation for serving as Deputy Head of the Implementing Committee of the Leadership Training',
    role: 'Deputy Head of Implementing Committee, Leadership Training',
  },
  {
    id: 'pr-coordinator',
    title: 'Coordinator, Public Relations Division, Pre-Higher Education 2023',
    kind: 'Certificate of committee service',
    issuer: 'Faculty of Law, Tarumanagara University',
    period: '2023',
    year: '2023-1',
    category: 'committee',
    summary: 'Served as Coordinator of the Public Relations Division (Koordinator Divisi Hubungan Masyarakat) for Pre-Higher Education (Pra-Pendidikan Tinggi) at the Faculty of Law, Tarumanagara University, 2023.',
    file: 'certificates/pr-coordinator',
    w: 757,
    h: 536,
    alt: 'Certificate naming Fellicia Angelica Kholim as Coordinator of the Public Relations Division, Pre-Higher Education 2023',
    role: 'Coordinator, Public Relations Division, Pre-Higher Education',
  },
];

export const achievements = certs.filter((c) => c.category === 'achievement');
