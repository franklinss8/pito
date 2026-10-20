import type { Metadata } from "next";
import { CATEGORIES, TEMPLATES } from "@/lib/templates";

export const metadata: Metadata = { title: "GPU templates · Pito", description: "Start your token's computer from a ready GPU template, then tell the AI how to improve it." };

export default function Templates({ searchParams }: { searchParams: { cat?: string } }) {
  const cat = CATEGORIES.find((c) => c.name === searchParams.cat)?.name;
  const list = cat ? TEMPLATES.filter((t) => t.category === cat) : TEMPLATES;
  return (
    <main className="wrap" style={{ paddingBlock: 40 }}>
      <div className="label">optional · {TEMPLATES.length} ready setups</div>
      <h1 style={{ fontSize: "clamp(38px,6vw,64px)", margin: "10px 0 14px" }}>Start from a ready GPU template.</h1>
      <p className="sub" style={{ fontSize: 15 }}>The GPU boots with the template already installed. The AI builds on it according to your description.</p>
      <div className="chips" style={{ margin: "20px 0 24px" }}>
        <a className={`chip ${!cat ? "active" : ""}`} href="/templates">All</a>
        {CATEGORIES.map((c) => <a key={c.name} className={`chip ${cat === c.name ? "active" : ""}`} href={`/templates?cat=${encodeURIComponent(c.name)}`}>{c.name}</a>)}
      </div>
      {cat && <p className="fine" style={{ marginBottom: 18 }}>{CATEGORIES.find((c) => c.name === cat)?.blurb}</p>}
      <div className="grid">
        {list.map((t) => (
          <a key={t.id} className="machine" href={`/launch?template=${t.id}`}>
            <div className="head"><div><div className="ticker" style={{ fontSize: 20 }}>{t.name}</div><div className="name">{t.category}</div></div><span className="status">{t.diskGb} GB</span></div>
            <div className="mission">{t.desc}</div>
            <div className="fine">{CATEGORIES.find((c) => c.name === t.category)?.blurb}</div>
            <span className="btn block">Use this template →</span>
          </a>
        ))}
      </div>
      <div style={{ marginTop: 32, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <span className="fine">Select a template above, or launch without one.</span>
        <a className="btn" href="/launch">Skip, describe from scratch →</a>
      </div>
    </main>
  );
}
