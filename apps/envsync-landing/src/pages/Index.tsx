import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NewHero from "@/components/NewHero";
import NewFeatures from "@/components/NewFeatures";
import NewHowItWorks from "@/components/NewHowItWorks";
import NewIntegrations from "@/components/NewIntegrations";
// import NewTestimonial from "@/components/NewTestimonial";
import NewCompare from "@/components/NewCompare";
import NewCTA from "@/components/NewCTA";
import { ActivityStream } from "@/components/activity/ActivityStream";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-4 focus:bg-background">
        Skip to main content
      </a>
      <Header />
      <main id="main-content">
        <NewHero />
        <NewFeatures />
        <ActivityStream />
        <NewHowItWorks />
        <NewIntegrations />
        {/*<NewTestimonial />*/}
        <NewCompare />
        <NewCTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
