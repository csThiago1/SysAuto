import { redirect } from "next/navigation"

// v2 promovida pra rota principal — redirect preserva links antigos.

export default async function ServiceOrderV2Redirect({
  params,
}: {
  params: Promise<{ numero: string }>
}) {
  const { numero } = await params
  redirect(`/os/${numero}`)
}
