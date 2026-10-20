import "server-only";
import type { Address, Hex } from "viem";
import { eth } from "./eth";
import { db } from "./db";

/**
 * Wallet-signed actions. The browser builds the message with lib/message.ts,
 * the wallet signs it (personal_sign), and the server checks it here.
 * Works for regular wallets and smart-contract wallets (ERC-1271 / ERC-6492).
 */
export type Action = "register" | "run" | "replan";

export class AuthError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export async function verifyAction(input: {
  message: unknown;
  signature: unknown;
  action: Action;
  target: string;
}): Promise<Address> {
  const { message, signature, action, target } = input;
  if (typeof message !== "string" || message.length > 600) throw new AuthError("BAD_MESSAGE", "Missing or invalid signed message.");
  if (typeof signature !== "string" || !/^0x[0-9a-fA-F]+$/.test(signature)) throw new AuthError("BAD_SIGNATURE", "Missing or invalid signature.");

  const fields = Object.fromEntries(
    message.split("\n").slice(1).map((l) => {
      const i = l.indexOf(": ");
      return i > 0 ? [l.slice(0, i), l.slice(i + 2)] : [l, ""];
    }),
  ) as Record<string, string>;

  if (!message.startsWith("Pito wants you to sign this action.\n")) throw new AuthError("BAD_MESSAGE", "Unexpected message format.");
  if (fields["Action"] !== action) throw new AuthError("BAD_MESSAGE", "The signed action does not match this request.");
  if ((fields["Target"] || "").toLowerCase() !== target.toLowerCase()) throw new AuthError("BAD_MESSAGE", "The signed target does not match this request.");
  if (fields["Chain ID"] !== "1") throw new AuthError("BAD_MESSAGE", "The message must be for Ethereum mainnet.");
  const account = fields["Wallet"];
  if (!/^0x[0-9a-fA-F]{40}$/.test(account || "")) throw new AuthError("BAD_MESSAGE", "Missing wallet in message.");
  const issued = Date.parse(fields["Issued At"] || "");
  if (!Number.isFinite(issued) || Math.abs(Date.now() - issued) > 10 * 60_000) throw new AuthError("EXPIRED", "This signature has expired. Sign again.");
  const nonce = fields["Nonce"] || "";
  if (!/^[a-zA-Z0-9]{16,64}$/.test(nonce)) throw new AuthError("BAD_MESSAGE", "Invalid nonce.");

  const ok = await eth().verifyMessage({ address: account as Address, message, signature: signature as Hex });
  if (!ok) throw new AuthError("BAD_SIGNATURE", "The signature does not match the wallet.");

  const { error } = await db().from("used_nonces").insert({ nonce });
  if (error) throw new AuthError("REPLAY", "This signature was already used. Sign again.");

  return account.toLowerCase() as Address;
}
