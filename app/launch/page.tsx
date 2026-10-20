import type { Metadata } from "next";
import { Suspense } from "react";
import { LaunchWizard } from "@/components/LaunchWizard";

export const metadata: Metadata = { title: "Launch a token · Pito", description: "A token created on Programmable with a Pito computer, a detailed AI build brief, and secure compute funding." };

export default function Launch() {
  return (
    <main className="wrap" style={{ paddingBlock: 40, maxWidth: 980 }}>
      <div className="label acc">token + computer</div>
      <h1 style={{ fontSize: "clamp(38px,6vw,64px)", margin: "8px 0 10px" }}>Launch your idea.</h1>
      <p className="sub" style={{ fontSize: 15 }}>Define the token. Describe what its computer should do. Give it a place to begin.</p>
      <Suspense><LaunchWizard /></Suspense>
    </main>
  );
}
