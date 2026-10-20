import type { Metadata } from "next";
import { Syne, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { WalletProvider, WalletButton } from "@/components/Wallet";
import "./globals.css";

const syne = Syne({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-syne" });
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "Pito · Every token gets a machine",
  description: "Launch your coin on Ethereum through Programmable, give it a mission, and its GPU machine builds an app for holders.",
};

function Mark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect x="3" y="3" width="26" height="26" rx="5" fill="var(--accent)" />
      <rect x="9" y="9" width="14" height="14" rx="2" fill="none" stroke="var(--accent-ink)" strokeWidth="2.4" />
      <circle cx="16" cy="16" r="2.6" fill="var(--accent-ink)" />
      <path d="M16 3v6M16 23v6M3 16h6M23 16h6" stroke="var(--accent-ink)" strokeWidth="2.4" />
    </svg>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${plex.variable} ${plexMono.variable}`}>
      <body>
        <WalletProvider>
          <header className="top">
            <div className="wrap">
              <a className="brand" href="/"><Mark />pito</a>
              <nav className="links">
                <a href="/#machines">Machines</a>
                <a href="/#launch">Launch</a>
                <a href="/#fees">Fees</a>
              </nav>
              <WalletButton />
              <a className="btn small primary" href="/#launch">Launch a token</a>
            </div>
          </header>
          {children}
          <footer>
            <div className="wrap">
              <span>pito · tokens with a machine · Ethereum mainnet</span>
              <span>Launches run on <a href="https://programmable.market" target="_blank" rel="noopener noreferrer">Programmable</a>. Not financial advice.</span>
            </div>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
