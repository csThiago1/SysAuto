import { redirect } from "next/navigation";

import { areaHome, defaultAreaForRole } from "@/components/dock/areas";
import { auth } from "@/lib/auth";

export default async function AppRootPage(): Promise<never> {
  const session = await auth();
  redirect(areaHome(defaultAreaForRole(session?.role)));
}
