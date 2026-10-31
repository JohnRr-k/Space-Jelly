import Hero from "@/components/Hero";
import About from "@/components/About";
import Evidence from "@/components/Evidence";
import Work from "@/components/Work";
import Approach from "@/components/Approach";
import Experience from "@/components/Experience";
import Skills from "@/components/Skills";
import Credentials from "@/components/Credentials";
import Contact from "@/components/Contact";

export default function Home() {
  return (
    <main id="main">
      <Hero />
      <About />
      <Evidence />
      <Work />
      <Approach />
      <Experience />
      <Skills />
      <Credentials />
      <Contact />
    </main>
  );
}
