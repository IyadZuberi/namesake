import { MotionConfig } from "framer-motion";
import { useEffect } from "react";
import { useTheme } from "next-themes";
import { Route, Routes, useSearchParams } from "react-router-dom";
import { Shell } from "@/components/layout";
import { CasesPage } from "@/pages/cases";
import { GraphPage, RulesPage } from "@/pages/graph-page";
import { Overview } from "@/pages/overview";
import { Results } from "@/pages/results";
import { SecondPage } from "@/pages/second";
import { JudgesPage } from "@/pages/judges";
import { PolicyPage } from "@/pages/policy";
import { HowPage } from "@/pages/soon";

function ThemeQuery() {
  const [params] = useSearchParams();
  const { setTheme } = useTheme();
  useEffect(() => {
    const theme = params.get("theme");
    if (theme === "light" || theme === "dark") setTheme(theme);
  }, [params, setTheme]);
  return null;
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ThemeQuery />
      <Shell>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/how" element={<HowPage />} />
          <Route path="/cases" element={<CasesPage />} />
          <Route path="/cases/:id" element={<CasesPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/graph/:id" element={<GraphPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/results" element={<Results />} />
          <Route path="/policy" element={<PolicyPage />} />
          <Route path="/judges" element={<JudgesPage />} />
          <Route path="/second-opinion" element={<SecondPage />} />
        </Routes>
      </Shell>
    </MotionConfig>
  );
}
