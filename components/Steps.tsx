const STEPS = [
  { n: "01", t: "Launch", p: "Create your coin on Programmable. It gets a Uniswap v4 pool on Ethereum and a launch stamp.", icon: <><circle cx="20" cy="20" r="14" /><circle cx="20" cy="20" r="5" /><path d="M20 6v9M20 25v9M6 20h9M25 20h9" /></> },
  { n: "02", t: "Give it a computer", p: "Paste the token address on Pito, pick a GPU and a mission, sign once. The machine is yours.", icon: <><ellipse cx="20" cy="11" rx="12" ry="4" /><path d="M8 11v18c0 2.2 5.4 4 12 4s12-1.8 12-4V11M8 20c0 2.2 5.4 4 12 4s12-1.8 12-4" /></> },
  { n: "03", t: "Fund", p: "Claim your creator fees into compute, or send ETH. Every hour of GPU and AI is metered.", icon: <><rect x="9" y="6" width="22" height="28" /><path d="M14 13h12M14 19h12M14 25h7" /></> },
  { n: "04", t: "Build", p: "The AI plans, codes and ships in public: live screen, every step, every reply to holders.", icon: <><path d="M20 5 33 12v16l-13 7-13-7V12z" /><path d="M20 19 33 12M20 19 7 12M20 19v16" /></> },
  { n: "05", t: "Share", p: "Holders use the app, vote on features and chat with the AI. Pito keeps the app online even when the GPU sleeps.", icon: <><circle cx="30" cy="9" r="4" /><circle cx="10" cy="20" r="4" /><circle cx="30" cy="31" r="4" /><path d="m13.5 18 13-7M13.5 22l13 7" /></> },
];

export function Steps() {
  return (
    <section className="block" id="how">
      <div className="wrap">
        <div className="steps5">
          {STEPS.map((s, i) => (
            <div className="step5" key={s.n}>
              <svg viewBox="0 0 40 40" aria-hidden="true">{s.icon}</svg>
              <div className="n">{s.n}</div>
              <div className="t">{s.t}</div>
              <p>{s.p}</p>
              {i < STEPS.length - 1 && <span className="arrow">→</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
