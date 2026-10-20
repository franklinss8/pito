"use client";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem("pito-theme") === "light") { setLight(true); document.documentElement.dataset.theme = "light"; } } catch {}
  }, []);
  function toggle() {
    const next = !light; setLight(next);
    if (next) document.documentElement.dataset.theme = "light"; else delete document.documentElement.dataset.theme;
    try { localStorage.setItem("pito-theme", next ? "light" : "dark"); } catch {}
  }
  return (
    <button className="iconbtn" type="button" onClick={toggle} aria-label={light ? "Switch to dark theme" : "Switch to light theme"} title="Theme">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
        {light ? <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z" /> : <><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" /></>}
      </svg>
    </button>
  );
}
