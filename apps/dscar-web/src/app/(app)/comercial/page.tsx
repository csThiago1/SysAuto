import { redirect } from "next/navigation";

import { areaHome } from "@/components/dock/areas";

export default function Page(): never {
  redirect(areaHome("comercial"));
}
