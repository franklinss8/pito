"use client";
import { useEffect, useState } from "react";

/** Global toast: call toast("text") from any client component. */
export function toast(text: string, kind: "ok" | "err" = "ok") {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("pito-toast", { detail: { text, kind } }));
}

export function Toaster() {
  const [items, setItems] = useState<{ id: number; text: string; kind: "ok" | "err" }[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const { text, kind } = (e as CustomEvent<{ text: string; kind: "ok" | "err" }>).detail;
      const id = Date.now() + Math.random();
      setItems((x) => [...x.slice(-2), { id, text, kind }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), kind === "err" ? 6000 : 3200);
    };
    window.addEventListener("pito-toast", on);
    return () => window.removeEventListener("pito-toast", on);
  }, []);
  if (!items.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((i) => <div key={i.id} className={`toast ${i.kind === "err" ? "toast-err" : ""}`}>{i.text}</div>)}
    </div>
  );
}
