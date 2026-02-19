
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Features from "@/components/Features";
import CLIShowcase from "@/components/CLIShowcase";
import Compare from "@/components/Compare";
import SocialProof from "@/components/SocialProof";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="h-fit" onLoad={() => window.scrollTo(0, 0)}>
      <Header />
      <Hero />
      <HowItWorks />
      <Features />
      <CLIShowcase />
      <Compare />
      <SocialProof />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;
