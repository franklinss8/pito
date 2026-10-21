import type { Metadata } from "next";
import { Suspense } from "react";
import { LaunchCoin } from "@/components/LaunchCoin";

export const metadata: Metadata = { title: "Launch a Coin · Pito", description: "Launch a coin on Programmable with a Pito computer: a GPU and an AI that builds for your holders." };

export default function Launch() {
  return <main className="wrap"><Suspense><LaunchCoin /></Suspense></main>;
}
