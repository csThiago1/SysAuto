import { redirect } from "next/navigation"

// OS creation is now handled by NewOSDrawer (Sheet) on the list and kanban pages.
// Accessing /service-orders/new directly redirects to the list where the drawer can be opened.
export default function NewServiceOrderPage() {
  redirect("/service-orders")
}

export const metadata = { title: "Nova OS — DS Car" }
