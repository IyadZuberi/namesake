import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui";
import { Stamp } from "@/components/stamp";
import { showcase as item } from "@/data/showcase";
import { scoreboard } from "@/data/stats";
const ease = [0.22, 1, 0.36, 1] as const;

export function Overview() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div initial={{ opacity: 1, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">Sanctions and PEP screening</p>
          <h1 className="mt-3 max-w-xl font-display text-5xl leading-[1.02] tracking-tight text-foreground sm:text-6xl">
            Clear sanctions false positives safely, with proof.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Namesake checks every screening hit against the bank's own records and clears it only when a written rule proves it's a different person.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/cases/S-0072">Walk through a case</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/results">See results</Link>
            </Button>
          </div>
        </motion.div>
        <motion.figure
          initial={{ opacity: 1, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease }}
          className="rounded-2xl border bg-card/70 p-4 shadow-[0_24px_80px_-36px_rgba(16,185,129,0.35)] backdrop-blur"
        >
          <figcaption className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Fig. 1 · {item.case_id} · invented name</figcaption>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_1.2fr_auto_0.8fr] sm:items-stretch">
            <div className="rounded-xl border bg-background/60 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Hit</p>
              <p className="mt-2 text-sm font-medium">{item.title}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">{item.hit.hit_id}</p>
            </div>
            <div className="hidden items-center text-muted-foreground sm:flex" aria-hidden="true">→</div>
            <ul className="space-y-1">
              {(item.trace?.gates ?? []).map((g) => (
                <li key={g.gate} className="flex items-center justify-between gap-2 rounded-md border bg-background/40 px-2 py-1">
                  <span className="font-mono text-[10px]">{g.gate}</span>
                  <span className="text-[11px] capitalize text-muted-foreground">{g.result.replaceAll("_", " ")}</span>
                </li>
              ))}
            </ul>
            <div className="hidden items-center text-muted-foreground sm:flex" aria-hidden="true">→</div>
            <div className="flex flex-col justify-between rounded-xl border bg-background/60 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Outcome</p>
              <Stamp decision={item.decision.decision} />
              <p className="mt-2 font-mono text-[11px]">{item.decision.reason_code}</p>
            </div>
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">The reason is the engine's template, filled from this hit's own trace.</p>
        </motion.figure>
      </section>

      <section aria-label="Pipeline" className="grid gap-2 sm:grid-cols-4">
        {[
          ["01", "Load", "Alerts, customers, KYC, notes"],
          ["02", "Resolve", "Account, login, or email"],
          ["03", "Seven gates", "Side by side. One contradiction wins"],
          ["04", "Proof", "Reason, evidence ids, graph"],
        ].map(([n, t, d]) => (
          <div key={n} className="rounded-xl border bg-card/60 p-3">
            <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">{n}</p>
            <p className="mt-1 font-medium">{t}</p>
            <p className="text-[12px] text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>

      <section aria-label="Problem">
        <h2 className="font-display text-3xl">The problem</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Quoted as published. The FCA figure is the share of firms with no true matches, not the share of alerts that are false positives.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <article className="rounded-2xl border bg-card/70 p-4 backdrop-blur">
            <p className="text-sm leading-relaxed">“In 2024-25, 70% of firms making REP-CRIM returns said they used automated screening and 81% were performing repeat customer screening. Of these, 95% had not identified any true sanctions matches for their clients since 2022, and 98% had not identified any true sanctions matches for screened payments since 2022.”</p>
            <p className="mt-3 text-[12px] text-muted-foreground">Financial Conduct Authority, Sanctions systems and controls in our firms: our findings. 2026 (published 28 May 2026; figures for 2024–25 returns).</p>
            <a className="mt-1 inline-block text-[12px] underline" href="https://www.fca.org.uk/publications/good-and-poor-practice/sanctions-systems-and-controls-our-firms-our-findings">fca.org.uk</a>
          </article>
          <article className="rounded-2xl border bg-card/70 p-4 backdrop-blur">
            <p className="text-sm leading-relaxed">“Many potential matches identified through screening are false positives.”</p>
            <p className="mt-3 text-[12px] text-muted-foreground">U.S. Treasury, Office of Foreign Assets Control, FAQ 5. Updated 9 September 2026 (originally released 30 January 2015). OFAC does not publish a false-positive percentage.</p>
            <a className="mt-1 inline-block text-[12px] underline" href="https://ofac.treasury.gov/faqs/5">ofac.treasury.gov/faqs/5</a>
          </article>
          <article className="rounded-2xl border bg-card/70 p-4 backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200">Vendor-commissioned study</p>
            <p className="mt-2 text-sm leading-relaxed">“The total cost of financial crime compliance in the U.S. and Canada has reached U.S.$61 billion.” The findings deck states “Labor Is The Biggest Cost Driver For Financial Institutions In The US And Canada,” with the cost split “42% Labor, 32% Technology, 12% Outsourcing, 14% Infrastructure.”</p>
            <p className="mt-3 text-[12px] text-muted-foreground">LexisNexis Risk Solutions press release, 21 February 2024. Figures from the True Cost of Financial Crime Compliance Study – U.S. and Canada, commissioned from Forrester Consulting (survey May–June 2023). Labour is the cost of financial-crime compliance as a whole, not sanctions screening alone.</p>
            <a className="mt-1 inline-block text-[12px] underline" href="https://risk.lexisnexis.com/about-us/press-room/press-release/20240221-true-cost-of-compliance-us-ca">Press release</a>
            {" · "}
            <a className="text-[12px] underline" href="https://www.corporatecomplianceinsights.com/wp-content/uploads/2024/02/Forrester-LexisNexis-Risk-Solutions-True-Cost-of-Financial-Crime-Compliance-Study-2023.pdf">Findings deck</a>
          </article>
          <article className="rounded-2xl border bg-card/70 p-4 backdrop-blur">
            <p className="text-sm leading-relaxed">“Bank of America, N.A. … has agreed to pay $11,662,930 to settle its potential civil liability for 475 apparent violations of OFAC sanctions programs targeting Russia, Belarus, Iran, Burma, Somalia, narcotics, and global terrorism.” OFAC states the bank “failed to appropriately prioritize alerts for customers who were exact name- and date of birth-matches to blocked persons,” and that in some cases “the payments were identified as false positives and approved for processing by analysts.”</p>
            <p className="mt-3 text-[12px] text-muted-foreground">OFAC Enforcement Release, 13 October 2026.</p>
            <a className="mt-1 inline-block text-[12px] underline" href="https://ofac.treasury.gov/media/937231/download">ofac.treasury.gov enforcement release</a>
          </article>
          <article className="rounded-2xl border bg-card/70 p-4 backdrop-blur lg:col-span-2">
            <p className="text-sm leading-relaxed">“As part of a combined $8.9 billion settlement with federal and state government agencies, the U.S. Department of the Treasury’s Office of Foreign Assets Control (OFAC) today announced a $963 million agreement with BNP Paribas SA (BNPP) to settle its potential liability for apparent violations of U.S. sanctions regulations.”</p>
            <p className="mt-3 text-[12px] text-muted-foreground">U.S. Department of the Treasury press release, 30 June 2014. The $8.9 billion is the combined interagency settlement. The OFAC piece was $963 million.</p>
            <a className="mt-1 inline-block text-[12px] underline" href="https://home.treasury.gov/news/press-releases/jl2447">home.treasury.gov/news/press-releases/jl2447</a>
          </article>
        </div>
      </section>

      <section aria-label="Real people">
        <h2 className="font-display text-3xl">Real people, real namesakes</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border bg-card/70 p-4 backdrop-blur">
            <h3 className="font-medium">Tom Kubbany, 2007</h3>
            <p className="mt-2 text-sm text-muted-foreground">His TransUnion credit report carried an OFAC alert that “his middle name, Hassan, is an alias for Ali Saddam Hussein, purportedly a ‘son of Saddam Hussein.’” The list entry gave a date of birth of 1980 or 1983; Kubbany was born in Detroit in 1949.</p>
            <p className="mt-3 text-[12px] text-muted-foreground">Ellen Nakashima, “Ordinary customers flagged as terrorists,” The Washington Post, 27 March 2007. Full text verified on the NBC News reprint.</p>
            <a className="mt-1 inline-block text-[12px] underline" href="https://www.nbcnews.com/id/wbna17804809">NBC News reprint</a>
          </article>
          <article className="rounded-2xl border bg-card/70 p-4 backdrop-blur">
            <h3 className="font-medium">Sam Mugabe, 2008</h3>
            <p className="mt-2 text-sm text-muted-foreground">“A London woman called Sam Mugabe had her wages frozen - because of sanctions against her namesake. The HSBC mistook Sam, 23, for a relative of Robert Mugabe and froze her £1,200 pay cheque, reports The Sun.”</p>
            <p className="mt-3 text-[12px] text-muted-foreground">Bdaily, 14 July 2008, summarising a report in The Sun. The original Sun article was not independently loaded.</p>
            <a className="mt-1 inline-block text-[12px] underline" href="https://bdaily.co.uk/articles/2008/07/14/banks-mugabe-mixup">bdaily.co.uk</a>
          </article>
          <article className="rounded-2xl border bg-card/70 p-4 backdrop-blur">
            <h3 className="font-medium">Aviad Shlomo Sarid, 2024</h3>
            <p className="mt-2 text-sm text-muted-foreground">“Four days after wrongly sanctioning an Israeli man after confusing him with a similarly-named right-wing activist, the US Treasury finally fixes the error and puts the correct individual on its blacklist.” The Treasury had “confused Sarid with an uninvolved Israeli named Aviad Shlomo Sarid, listing the latter’s ID number and birthdate.”</p>
            <p className="mt-3 text-[12px] text-muted-foreground">The Times of Israel, 16 July 2024.</p>
            <a className="mt-1 inline-block text-[12px] underline" href="https://www.timesofisrael.com/liveblog_entry/4-days-after-mixup-us-unsanctions-innocent-israeli-blacklists-similarly-named-activist/">timesofisrael.com</a>
          </article>
        </div>
      </section>

      <section aria-label="Solution" className="grid gap-3 md:grid-cols-3">
        {[
          ["01", "Find the customer", "Follow the account, login, or email. Merge records only on a phone plus a full date of birth, or a shared document."],
          ["02", "Seven gates", "Type, death, place, time, date of birth, name, and agreement run side by side. Only a contradiction clears."],
          ["03", "Show the proof", "The reason names the records. The graph shows which gate decided it."],
        ].map(([n, t, d]) => (
          <div key={n} className="rounded-2xl border bg-card/70 p-4 backdrop-blur">
            <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground">{n}</p>
            <h2 className="mt-2 font-display text-2xl">{t}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>

      <section aria-label="Estimate" className="rounded-2xl border bg-card/70 p-5 backdrop-blur">
        <h2 className="font-display text-3xl">Impact, as an estimate</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Estimate of machine time per hit on the recorded dev run: about 6 seconds ÷ 819 hits. That is how long the engine took, not time saved against an analyst. Analyst time was not measured, so it is not estimated here.
        </p>
      </section>

      <section aria-label="Measured results" className="rounded-2xl border bg-card/70 p-6 backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Measured results</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{scoreboard.source}</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/results">Full results</Link>
          </Button>
        </div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-4">
          {[
            ["100.0", "Practice decision score", "Recorded, not recomputed here"],
            ["0", "Unsafe clears", "Practice labels and Fire Drill"],
            ["122/122", "Fire Drill traps", "Recomputed on this machine"],
            ["17.6", "Name-only baseline", "Practice labels, not recomputed here"],
          ].map(([n, l, s]) => (
            <div key={l} className="rounded-xl bg-secondary/70 px-4 py-3">
              <dd className="font-mono text-2xl font-medium tracking-tight">{n}</dd>
              <dt className="mt-1 text-sm font-medium">{l}</dt>
              <p className="text-[12px] text-muted-foreground">{s}</p>
            </div>
          ))}
        </dl>
      </section>

      <section aria-label="Trust" className="grid gap-4 sm:grid-cols-4">
        {[
          ["Synthetic data", "Every name on this site comes from the Fire Drill set. It carries a SYNTHETIC marker."],
          ["Deterministic", "Same files, same decisions. The committed dev output sha256 starts f454c71d."],
          ["No keys in the browser", "The site is a static build. It does not call a model and it does not upload a case."],
          ["Rules decide", "The scored engine is Python. A missing fact stays unknown and goes to a person."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
