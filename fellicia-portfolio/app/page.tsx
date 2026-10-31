import About from '@/components/About';
import AssetBand from '@/components/AssetBand';
import Contact from '@/components/Contact';
import Credentials from '@/components/Credentials';
import Engagements from '@/components/Engagements';
import Expertise from '@/components/Expertise';
import Footer from '@/components/Footer';
import Hero from '@/components/Hero';
import Intro from '@/components/Intro';
import Leadership from '@/components/Leadership';
import Nav from '@/components/Nav';
import ScrollEffects from '@/components/ScrollEffects';
import Ticker from '@/components/Ticker';
import { person } from '@/content/site';
import { SITE_URL } from '@/lib/media';

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: person.name,
  honorificSuffix: person.designation,
  jobTitle: person.position,
  worksFor: { '@type': 'Organization', name: person.firm },
  alumniOf: { '@type': 'CollegeOrUniversity', name: 'Tarumanagara University' },
  email: `mailto:${person.email}`,
  url: SITE_URL,
  sameAs: [person.linkedin],
};

export default function Page() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Intro />
      <ScrollEffects />
      <Nav />
      <main id="main">
        <Hero />
        <Ticker />
        <About />
        <AssetBand />
        <Expertise />
        <Engagements />
        <Leadership />
        <Credentials />
        <Contact />
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
