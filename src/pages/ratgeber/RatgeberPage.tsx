import { useParams, Navigate } from "react-router-dom";
import RatgeberTemplate from "./RatgeberTemplate";
import { ratgeberPages } from "@/data/ratgeber/ratgeber-index";

const RatgeberPage = () => {
  const { slug } = useParams<{ slug: string }>();

  if (!slug || !ratgeberPages[slug]) {
    return <Navigate to="/ratgeber" replace />;
  }

  return <RatgeberTemplate config={ratgeberPages[slug]} />;
};

export default RatgeberPage;
