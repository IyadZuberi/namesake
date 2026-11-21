import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui";
import { CompareTable } from "@/components/compare-table";
import { Stamp } from "@/components/stamp";
import { showcase as item } from "@/data/showcase";
import { scoreboard } from "@/data/stats";

const fade = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const STEPS = [
  ["01", "Alert", "A screening hit arrives with the name the bank checked."],
  ["02", "Records", "The account, login, or email finds the customer. KYC beats what they declared."],
  ["03", "Gates", "Type, death, place, time, date of birth, name, and agreement run together."],
  ["04", "Decision", "The first contradiction clears. Anything unknown stays a review."],
];

export function Overview() {
  return (
    <div>
      <section className="relative overflow-hidden px-1 pb-20 pt-10 sm:pt-16">
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
        <p className="relative text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">Sanctions and PEP screening</p>
        <h1 className="relative mt-4 max-w-4xl font-display text-5xl leading-[0.98] tracking-tight sm:text-7xl">
          Clear sanctions false positives safely, with proof.
        </h1>
        <p className="relative mt-6 max-w-xl text-lg text-muted-foreground">
          Namesake checks a hit against the bank’s own records and clears it only when a written rule proves it is a different person.
        </p>
        <div className="relative mt-8">
          <Button asChild size="lg">
            <Link to="/cases">Open the workbench</Link>
          </Button>
        </div>
      </section>

      <section className="border-t py-14" aria-label="Worked comparison">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Fig. 1 · {item.case_id} · invented name</p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-4xl">{item.title}</h2>
          <Stamp decision={item.decision.decision} />
        </div>
        <p className="mt-2 font-mono text-[12px] text-muted-foreground">{item.decision.reason_code}</p>
        <div className="mt-6">
          <CompareTable item={item} />
        </div>
        <p className="mt-4 max-w-3xl text-sm text-muted-foreground">{item.decision.reason}</p>
      </section>

      <section id="pipeline" className="border-t py-16" aria-label="How it works">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">How it works</p>
        <h2 className="mt-3 max-w-3xl font-display text-4xl sm:text-5xl">Four steps. The rules decide.</h2>
        <motion.ol
          className="mt-10 grid gap-8 sm:grid-cols-4"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.45 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
        >
          {STEPS.map(([n, title, copy]) => (
            <motion.li key={n} variants={fade}>
              <p className="font-mono text-sm text-emerald-700 dark:text-emerald-300">{n}</p>
              <h3 className="mt-2 font-display text-3xl">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
            </motion.li>
          ))}
        </motion.ol>
      </section>

      <section className="border-t py-16" aria-label="Problem">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">The problem</p>
        <h2 className="mt-3 max-w-3xl font-display text-4xl">Quoted as published.</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">The FCA figure is the share of firms with no true matches, not the share of alerts that are false positives.</p>
        <div className="mt-10 space-y-10">
          <Quote
            text="In 2024-25, 70% of firms making REP-CRIM returns said they used automated screening and 81% were performing repeat customer screening. Of these, 95% had not identified any true sanctions matches for their clients since 2022, and 98% had not identified any true sanctions matches for screened payments since 2022."
            source="Financial Conduct Authority, Sanctions systems and controls in our firms: our findings. 2026."
            href="https://www.fca.org.uk/publications/good-and-poor-practice/sanctions-systems-and-controls-our-firms-our-findings"
            label="fca.org.uk"
          />
          <Quote
            text="Many potential matches identified through screening are false positives."
            source="U.S. Treasury, Office of Foreign Assets Control, FAQ 5. Updated 9 September 2026. OFAC does not publish a false-positive percentage."
            href="https://ofac.treasury.gov/faqs/5"
            label="ofac.treasury.gov/faqs/5"
          />
          <Quote
            kicker="Vendor-commissioned study"
            text="The total cost of financial crime compliance in the U.S. and Canada has reached U.S.$61 billion."
            source="LexisNexis Risk Solutions press release, 21 February 2024. Forrester Consulting study, survey 2023. The findings deck says labour is 42% of the cost. That is financial-crime compliance as a whole, not sanctions screening alone."
            href="https://risk.lexisnexis.com/about-us/press-room/press-release/20240221-true-cost-of-compliance-us-ca"
            label="Press release"
          />
          <Quote
            text="Bank of America, N.A. … has agreed to pay $11,662,930 to settle its potential civil liability for 475 apparent violations of OFAC sanctions programs targeting Russia, Belarus, Iran, Burma, Somalia, narcotics, and global terrorism. The bank failed to appropriately prioritize alerts for customers who were exact name- and date of birth-matches to blocked persons."
            source="OFAC Enforcement Release, 13 October 2026."
            href="https://ofac.treasury.gov/media/937231/download"
            label="OFAC release"
          />
          <Quote
            text="As part of a combined $8.9 billion settlement with federal and state government agencies, the U.S. Department of the Treasury’s Office of Foreign Assets Control (OFAC) today announced a $963 million agreement with BNP Paribas SA (BNPP) to settle its potential liability for apparent violations of U.S. sanctions regulations."
            source="U.S. Department of the Treasury press release, 30 June 2014. The $8.9 billion is the combined settlement. The OFAC piece was $963 million."
            href="https://home.treasury.gov/news/press-releases/jl2447"
            label="Treasury release"
          />
        </div>
      </section>

      <section className="border-t py-16" aria-label="Real people">
        <h2 className="font-display text-4xl">Real people, real namesakes</h2>
        <ul className="mt-8 space-y-6">
          <li>
            <p className="font-medium">Tom Kubbany, 2007</p>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">An OFAC alert said “his middle name, Hassan, is an alias for Ali Saddam Hussein, purportedly a ‘son of Saddam Hussein.’” The list gave 1980 or 1983. He was born in Detroit in 1949.</p>
            <a className="text-[12px] underline" href="https://www.nbcnews.com/id/wbna17804809">Washington Post, via NBC News</a>
          </li>
          <li>
            <p className="font-medium">Sam Mugabe, 2008</p>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">“A London woman called Sam Mugabe had her wages frozen - because of sanctions against her namesake.” HSBC froze her £1,200 pay. The original Sun article was not independently loaded.</p>
            <a className="text-[12px] underline" href="https://bdaily.co.uk/articles/2008/07/14/banks-mugabe-mixup">Bdaily, 14 July 2008</a>
          </li>
          <li>
            <p className="font-medium">Aviad Shlomo Sarid, 2024</p>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">The US Treasury “confused Sarid with an uninvolved Israeli named Aviad Shlomo Sarid, listing the latter’s ID number and birthdate.” His account and card were blocked.</p>
            <a className="text-[12px] underline" href="https://www.timesofisrael.com/liveblog_entry/4-days-after-mixup-us-unsanctions-innocent-israeli-blacklists-similarly-named-activist/">The Times of Israel, 16 July 2024</a>
          </li>
        </ul>
      </section>

      <section className="border-t py-16" aria-label="Measured results">
        <h2 className="font-display text-4xl">Measured here</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{scoreboard.source} Estimate of machine time: about 6 seconds ÷ 819 hits. Analyst time was not measured.</p>
        <dl className="mt-8 grid gap-8 sm:grid-cols-4">
          {[
            ["100.0", "Practice score"],
            ["0", "Unsafe clears"],
            ["122/122", "Fire Drill"],
            ["17.6", "Name-only baseline"],
          ].map(([n, l]) => (
            <div key={l}>
              <dt className="font-display text-5xl">{n}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{l}</dd>
            </div>
          ))}
        </dl>
        <Link className="mt-8 inline-block text-sm underline" to="/results">Full results</Link>
      </section>
    </div>
  );
}

function Quote({ kicker, text, source, href, label }: { kicker?: string; text: string; source: string; href: string; label: string }) {
  return (
    <blockquote className="max-w-3xl border-l border-emerald-700/50 pl-5">
      {kicker ? <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200">{kicker}</p> : null}
      <p className="mt-1 text-lg leading-snug">“{text}”</p>
      <footer className="mt-3 text-[12px] text-muted-foreground">
        {source}{" "}
        <a className="underline" href={href}>{label}</a>
      </footer>
    </blockquote>
  );
}
