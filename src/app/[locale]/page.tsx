import Link from "next/link";
import { ArrowUpRight, BrainCircuit, Command, LibraryBig, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getMessages(locale);
  return (
    <div className="page-shell">
      <section className="hero-grid container-shell">
        <div className="hero-copy">
          <Badge variant="outline"><Sparkles size={13} /> {t.home.eyebrow}</Badge>
          <h1>{t.home.title}</h1>
          <p className="hero-lede">{t.home.lede}</p>
          <div className="hero-actions">
            <Button asChild size="lg"><Link href={`/${locale}/studio`}>{t.home.primaryCta}<ArrowUpRight size={17} /></Link></Button>
            <Button asChild variant="ghost" size="lg"><Link href={`/${locale}/login`}>{t.home.secondaryCta}</Link></Button>
          </div>
          <div className="signal-row"><span><span className="signal-dot" /> {t.home.signal}</span><span>⌘ K</span></div>
        </div>
        <div className="hero-console" aria-label="Knowledge Core workspace preview">
          <div className="console-top"><span className="window-dots"><i /><i /><i /></span><span>workspace / overview</span><span className="console-live">LIVE</span></div>
          <div className="console-body">
            <div className="console-sidebar"><span className="sidebar-mark">KC</span><span className="sidebar-line active" /><span className="sidebar-line" /><span className="sidebar-line" /><span className="sidebar-line short" /></div>
            <div className="console-main"><p className="console-kicker">TODAY · 09:41</p><h2>Make ideas legible.</h2><p>One calm surface for notes, essays, and the conversations around them.</p><div className="console-card"><div><span className="mini-icon"><BrainCircuit size={15} /></span><span>Writing system</span></div><span className="console-arrow">↗</span></div><div className="console-card muted"><div><span className="mini-icon"><LibraryBig size={15} /></span><span>Knowledge base</span></div><span className="console-arrow">↗</span></div></div>
          </div>
        </div>
      </section>
      <section id="principles" className="principles container-shell">
        <div><p className="eyebrow">{t.home.principlesEyebrow}</p><h2>{t.home.principlesTitle}</h2></div>
        <div className="principle-list"><article><Command size={18} /><h3>{t.home.principleOneTitle}</h3><p>{t.home.principleOneBody}</p></article><article><BrainCircuit size={18} /><h3>{t.home.principleTwoTitle}</h3><p>{t.home.principleTwoBody}</p></article><article><LibraryBig size={18} /><h3>{t.home.principleThreeTitle}</h3><p>{t.home.principleThreeBody}</p></article></div>
      </section>
    </div>
  );
}
