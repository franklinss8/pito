import type { Metadata } from "next";
import { Suspense } from "react";
import { LaunchMachine } from "@/components/LaunchMachine";

export const metadata: Metadata = { title: "Launch a machine · Pito", description: "Launch a coin on Programmable with a Pito computer: a GPU and an AI that builds for your holders." };

export default function Launch() {
  return <main className="wrap"><Suspense><LaunchMachine /></Suspense></main>;
}
