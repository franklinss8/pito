import { getAddress } from "viem";
import { env } from "@/lib/env";
import { findProgrammableLaunch, readCreatorFees } from "@/lib/eth";
import { fail, handleError, ok } from "@/lib/http";
import { getMachine } from "@/lib/machines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Creator fees waiting in the coin's ledger, and how to claim them into compute. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const m = await getMachine(params.id);
    if (!m) return fail(404, "not_found", "No machine with this id.");
    if (!m.token_address) return ok({ available: false, reason: "not_bound" });
    const launch = await findProgrammableLaunch(getAddress(m.token_address));
    if (!launch) return ok({ available: false, reason: "no_stamp" });
    const fees = await readCreatorFees(launch.hook);
    if (!fees) return ok({ available: false, reason: "no_ledger" });
    const native = fees.quote === "0x0000000000000000000000000000000000000000";
    return ok({
      available: true,
      ledger: fees.ledger, creator: fees.creator, quote: fees.quote, native,
      credited_wei: fees.creditedWei.toString(), claimed_wei: fees.claimedWei.toString(), claimable_wei: fees.claimableWei.toString(),
      treasury: env.treasury,
      note: native ? "Claiming pays ETH to the creator wallet; Pito then funds the machine from it." : "This coin's fees accrue in a paired token, not ETH. Claim on Programmable and fund the machine in ETH.",
    }, 200, "public, max-age=10");
  } catch (e) { return handleError(e); }
}
