import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HomeLanding from "@/components/home/HomeLanding";

const Index = () => {
  return (
    <div className="home-grid min-h-screen bg-background text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-4 focus:bg-background">
        Skip to main content
      </a>
      <Header />
      <main id="main-content">
        <HomeLanding />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
