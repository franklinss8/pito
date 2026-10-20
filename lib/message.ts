/** Shared by browser and server: the exact text a wallet signs for a Pito action. */
export type ActionName = "register" | "run" | "replan" | "create" | "bind" | "message" | "vote" | "rent" | "stop" | "resume" | "request";
export function buildActionMessage(action: ActionName, target: string, wallet: string): string {
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
