import { redirect } from "next/navigation";

/**
 * Rota legada — o detalhe de OS agora vive em /service-orders/{id}.
 */
interface Props {
  params: Promise<{ id: string }>;
}

export default async function OsDetailLegacyPage({ params }: Props) {
  const { id } = await params;
  redirect(`/service-orders/${id}`);
}
