import { MotionConfig } from "framer-motion";
import { Route, Routes } from "react-router-dom";
import { Shell } from "@/components/layout";
import { CasesPage } from "@/pages/cases";
import { GraphPage, RulesPage } from "@/pages/graph-page";
import { Overview } from "@/pages/overview";
import { Results } from "@/pages/results";
import { SecondPage } from "@/pages/second";
import { JudgesPage } from "@/pages/judges";
import { HowPage } from "@/pages/soon";

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
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
          <Route path="/judges" element={<JudgesPage />} />
          <Route path="/second-opinion" element={<SecondPage />} />
        </Routes>
      </Shell>
    </MotionConfig>
  );
}
