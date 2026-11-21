import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function HowRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/", { replace: true });
    const timer = window.setTimeout(() => document.getElementById("pipeline")?.scrollIntoView(), 0);
    return () => window.clearTimeout(timer);
  }, [navigate]);
  return null;
}
