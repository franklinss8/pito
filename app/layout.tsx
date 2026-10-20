import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { WalletProvider, WalletButton } from "@/components/Wallet";
import { Mark, Wordmark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-grotesk" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Pito · Give your token a computer",
  description: "Launch a token on Ethereum through Programmable and give it a machine: a GPU and an AI that builds for your holders, in public.",
};

const NAV = [["Discover", "/"], ["Computers", "/computers"], ["Originals", "/originals"], ["Templates", "/templates"], ["API", "/developers"], ["How it works", "/how-it-works"]];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <WalletProvider>
          <header className="top">
            <div className="wrap">
              <a className="brand" href="/"><Mark />pito</a>
              <span className="badge">MAINNET</span>
              <nav className="links">{NAV.map(([n, h]) => <a key={h} href={h}>{n}</a>)}</nav>
              <div className="right">
                <ThemeToggle />
                <WalletButton />
                <a className="btn small primary" href="/launch">Launch a token</a>
              </div>
            </div>
          </header>
          {children}
          <footer>
            <div className="wrap">
              <div>
                <Wordmark className="word" />
                <div className="tag" style={{ marginTop: 18 }}>Tokens<br />Compute<br />Agents<br />A more capable internet</div>
              </div>
              <ul>{NAV.map(([n, h]) => <li key={h}><a href={h}>{n}</a></li>)}</ul>
              <ul>
                <li><a href="/launch">Launch a token</a></li>
                <li><a href="/rent">Rent a computer</a></li>
                <li><a href="https://programmable.market" target="_blank" rel="noopener noreferrer">Programmable</a></li>
                <li><a href="https://github.com/franklinss8/pito" target="_blank" rel="noopener noreferrer">Source</a></li>
              </ul>
              <ul>
                <li>pito · tokens with their own computer</li>
                <li>© 2026 Pito · Ethereum mainnet</li>
                <li>Not financial advice. Tokens may lose all value.</li>
              </ul>
            </div>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
