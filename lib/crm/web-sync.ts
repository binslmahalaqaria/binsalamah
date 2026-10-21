/**
 * Keeps a property's website listing in step with the CRM (client 2026-10-21). A listing made with
 * «اعرضه في الموقع» stores `property_id`; whenever the property's status or its units' statuses
 * change in the CRM, the listing's unit statuses and sold percentage follow — a sold property
 * shows as sold on the site instead of staying «متاح».
 */
import { collection, getDocs, query, updateDoc, where, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { OfferUnit, UnitStatus } from "@/lib/types";
import type { Unit } from "./types";

const ST: Record<string, UnitStatus> = { "محجوز": "reserved", "مباع": "sold" };
const webStatus = (s: string | null | undefined): UnitStatus => ST[s || ""] || "available";

/** `patch` is what was just written to the property: `units` and/or `status`. */
export async function syncWebOffer(propertyId: string, patch: { units?: Unit[]; status?: string | null }) {
  if (!patch.units && patch.status === undefined) return;
  const snap = await getDocs(query(collection(db, "offers"), where("property_id", "==", propertyId)));
  for (const d of snap.docs) {
    const o = d.data() as { units?: OfferUnit[] };
    const out: Record<string, unknown> = { updated_at: serverTimestamp() };
    if (patch.units?.length && o.units?.length) {
      const units = o.units.map((u) => {
        const c = patch.units!.find((x) => x && x.name === u.name);
        return c ? { ...u, status: webStatus(c.status) } : u;
      });
      out.units = units;
      out.sold_percentage = Math.round((units.filter((u) => u.status === "sold").length / units.length) * 100);
    } else if (patch.status !== undefined) {
      out.sold_percentage = patch.status === "مباع" ? 100 : null;
    }
    await updateDoc(d.ref, out);
  }
}
