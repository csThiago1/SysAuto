import { redirect } from "next/navigation";

export default function AppRootPage(): never {
  redirect("/dashboard");
}
