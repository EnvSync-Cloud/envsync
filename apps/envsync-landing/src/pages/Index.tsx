
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

const Index = () => {
  // Allways scroll to top on page load

  return (
    <div className="h-fit" onLoad={() => window.scrollTo(0, 0)}>
      <Header />
      <Hero />
      <Features />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;
