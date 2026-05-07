/**
 * Shared interfaces for OS detail tabs and modals.
 *
 * These types provide a consistent contract for all tab and modal components
 * inside the [id] route so each component doesn't need to redeclare them.
 */

import type { ServiceOrder } from "@paddock/types"

/** Props shared by all OS detail tab components */
export interface TabProps {
  orderId: string
  order?: ServiceOrder
}

/** Props shared by all modal/drawer components inside the OS detail page */
export interface ModalProps {
  open: boolean
  onClose: () => void
}
