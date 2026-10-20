/** Shared by browser and server: the exact text a wallet signs for a Pito action. */
export function buildActionMessage(action: "register" | "run" | "replan", target: string, wallet: string): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return [
    "Pito wants you to sign this action.",
    `Action: ${action}`,
    `Target: ${target}`,
    `Wallet: ${wallet}`,
    "Chain ID: 1",
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
    "This signature costs no gas and moves no funds.",
  ].join("\n");
}
