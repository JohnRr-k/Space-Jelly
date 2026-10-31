# Publication checklist

The site is built and tested, but it has **not** been deployed. Resolve every item below before running
`npm run build:public` and publishing. Items marked **blocking** should not be skipped.

## 1. Client and engagement approvals (blocking)

- [ ] Written permission to name **PT Pos Indonesia**, **PT Petrokimia Gresik** and **PT Solusi Energy Nusantara** publicly.
- [ ] The nine project descriptions are approved for public presentation as written (they are reproduced verbatim from the portfolio PDF).
- [ ] Projects 8 and 9 and Project 7 are described without a named client; confirm that is the intended presentation.

## 2. Supporting visuals (blocking)

All client-related visuals live in `assets/restricted/` and are excluded from the public edition (placeholders are shown instead).
Findings from the review of the supplied files:

| Project | Visual | What needs checking |
|---|---|---|
| 01 | Two meeting photographs | Show other people's names, faces, a third-party logo (BDO) and internal meeting content; low resolution. |
| 02 | Legal Due Diligence matrix | Internal legal analysis of a named client's policies. |
| 03 | Disciplinary violations matrix | Employment-matter analysis for a named client. |
| 04 | GCG harmonization working paper | Internal working paper of a named client. |
| 05 | BPM / CPM covers | Carry the client's logo ("sena"). |
| 06 | PDP guideline cover and matrix | Cover shows an internal document code; matrix is an internal working paper. |
| 07 | ISO 37301 cover and matrix | The matrix title contains **"PT PG"**, which contradicts presenting the client as undisclosed. |
| 09 | Contract template | Names two third-party companies in the title block. |
| 08 | Consumer Protection Act photo | Stock image, no client data. Published in both editions. |

To approve a visual: move the file from `assets/restricted/projects/` to `assets/open/projects/`, then move its object out of the
`PUBLIC_MODE ? [] : [ … ]` block in `content/site.ts`. Redact or crop first where a matrix names a client.

## 3. Personal data

- [ ] **Phone number** (listed in the portfolio) is intentionally *not* published. Confirm whether it may be added.
- [ ] Diploma preview is redacted (serial numbers, birth data, student number, ID photo). The transcript is **not** shown. Confirm this is acceptable.
- [ ] Group posters (BEM FH UNTAR 2022/2023 and 2023/2024) show other people and are **not** used. Their facts (roles and periods) are used as text only.

## 4. Credentials and wording

- [ ] **CLA:** the supplied document is a letter dated 28 August 2026 stating the formal certificate is still being issued. The site says exactly that. When the certificate arrives, update `credentials` in `content/site.ts` and add the document.
- [ ] **PKPA** is titled "Special Education for the Advocate Profession" (the certificates read *Pendidikan Khusus Profesi Advokat*) and is labelled a participation certificate, not an advocate licence.
- [ ] The two organizational role titles (Deputy Head of Department, Student Activities Unit, 2022–2023; Second Vice Chairperson, 2023–2024) are taken from the brief. The 2023/2024 poster does not itself say "Second". Confirm with an official document if available.
- [ ] The Leadership Training certificate shows no year; none is shown on the site.
- [ ] Two certificates print the name as "Fellicia Angellica Kholim" and "Fellicia Angelica K". They are shown as supplied; the surrounding text uses the correct name.
- [ ] Project 6 title: the PDF reads "…in the PDP policy their implementing regulations"; the site uses "…in the PDP Policy and Its Implementing Regulations" (grammar only).
- [ ] The opening sequence and hero describe her as "Certified Legal Auditor" / "CLA" as in her own portfolio. Decide whether to keep that wording prominently until the certificate is issued.

## 5. Deployment

- [ ] Choose a domain and set `SITE_URL` when building the public edition (Open Graph and canonical URLs).
- [ ] The private edition sends `noindex, nofollow`; the public edition sends `index, follow`.
- [ ] `assets/restricted/` is committed to this repository. Keep the repository private, or remove that folder before making it public.
