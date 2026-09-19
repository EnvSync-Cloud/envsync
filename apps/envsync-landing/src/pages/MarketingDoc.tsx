import { useLocation } from "react-router-dom";
import MarketingPage from "@/components/MarketingPage";
import { docByPath } from "@/content/marketing";
import NotFound from "@/pages/NotFound";

const MarketingDoc = () => {
  const { pathname } = useLocation();
  const doc = docByPath(pathname);
  if (!doc) {
    return <NotFound />;
  }
  return <MarketingPage doc={doc} />;
};

export default MarketingDoc;
