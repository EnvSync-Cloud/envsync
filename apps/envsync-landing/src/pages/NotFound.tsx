import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/primitives/Button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h1 className="font-mono text-[clamp(6rem,18vw,10rem)] font-medium leading-none text-accent-ink">
            404
          </h1>
          <p className="mt-4 text-lead text-muted-foreground">
            The page you're looking for doesn't exist.
          </p>
          <Link to="/" className="mt-8 inline-block">
            <Button variant="primary" size="lg">
              <ArrowLeft className="h-4 w-4" />
              Return to Home
            </Button>
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default NotFound;
