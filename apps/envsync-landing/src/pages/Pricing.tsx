import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PricingPlans from "@/components/PricingPlans";
import NewCTA from "@/components/NewCTA";

const Pricing = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main-content">
        <PricingPlans />
        <NewCTA />
      </main>
      <Footer />
    </div>
  );
};

export default Pricing;
