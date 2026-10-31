export const site = {
  name: "Juvenn Elkins Ravelliyo",
  short: "Juvenn Ravelliyo",
  role: "Brand strategy · Market research · Content strategy",
  email: "juvennelkins51@gmail.com",
  linkedin: "https://linkedin.com/in/juvennelkins",
  location: "North Jakarta, Indonesia",
  timezone: "Asia/Jakarta",
  pdf: "/Juvenn_Ravelliyo_Portfolio.pdf",
  // Set NEXT_PUBLIC_SITE_URL at build time once a real domain exists. No domain is assumed.
  url: process.env.NEXT_PUBLIC_SITE_URL || "",
};

export function mailto(subject: string, body = "") {
  const q = `subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ""}`;
  return `mailto:${site.email}?${q}`;
}

export const nav = [
  { label: "Work", href: "#work" },
  { label: "Approach", href: "#approach" },
  { label: "Experience", href: "#experience" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];
