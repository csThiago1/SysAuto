import { redirect } from "next/navigation";

/**
 * Rota legada — mantida para não quebrar bookmarks antigos.
 * O fluxo de OS agora vive em /service-orders.
 */
export default function OsLegacyPage() {
  redirect("/service-orders");
}
