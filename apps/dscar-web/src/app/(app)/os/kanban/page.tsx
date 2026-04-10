import { redirect } from "next/navigation";

/**
 * Rota legada — o Kanban agora vive em /service-orders/kanban.
 */
export default function OsKanbanLegacyPage() {
  redirect("/service-orders/kanban");
}
