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
  description: "Launch a token on Ethereum through Programmable and give it a machine: a GPU and an AI agent that builds for your holders.",
};

const DOCS = "https://github.com/franklinss8/pito#readme";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <WalletProvider>
          <header className="top">
            <div className="wrap">
              <a className="brand" href="/"><Mark />pito</a>
              <span className="badge">MAINNET</span>
              <nav className="links">
                <a href="/">Discover</a>
                <a href="/#machines">Computers</a>
                <a href="/#templates">Templates</a>
                <a href={DOCS} target="_blank" rel="noopener noreferrer">Docs</a>
              </nav>
              <div className="right">
                <ThemeToggle />
                <WalletButton />
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
              <ul>
                <li><a href="/">Discover</a></li>
                <li><a href="/#machines">Computers</a></li>
                <li><a href="/#templates">Templates</a></li>
                <li><a href={DOCS} target="_blank" rel="noopener noreferrer">Docs</a></li>
              </ul>
              <ul>
                <li><a href="https://etherscan.io" target="_blank" rel="noopener noreferrer">Ethereum Mainnet</a></li>
                <li><a href="https://programmable.market" target="_blank" rel="noopener noreferrer">Programmable</a></li>
                <li><a href="/#fees">Fees</a></li>
              </ul>
              <ul>
                <li>© 2026 Pito</li>
                <li>Not financial advice.</li>
                <li>Tokens may lose all value.</li>
              </ul>
            </div>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
