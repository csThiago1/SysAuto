/**
 * @/components/ui — Barrel Export
 *
 * Importação unificada de todos os componentes UI.
 * Uso: import { Button, Card, StatusBadge, RoleBadge } from "@/components/ui"
 *
 * Componentes shadcn/ui (primitivos)
 */
export { Button, type ButtonProps } from "./button";
export { Input } from "./input";
export { PhoneInput, CpfCnpjInput, formatPhone, formatCpfCnpj } from "./masked-input";
export { Label } from "./label";
export { Textarea } from "./textarea";
export { Skeleton } from "./skeleton";
export { TableSkeleton } from "./table-skeleton";
export { Badge, badgeVariants, type BadgeProps } from "./badge";

// Card
export {
  Card, CardContent, CardDescription,
  CardFooter, CardHeader, CardTitle,
} from "./card";

// Dialog / Modal
export {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "./dialog";
export { ConfirmDialog } from "./ConfirmDialog";

// Sheet / Drawer
export {
  Sheet, SheetContent, SheetDescription,
  SheetFooter, SheetHeader, SheetTitle, SheetTrigger, SheetOverlay, SheetPortal, SheetClose,
} from "./sheet";

// Select
export {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "./select";

// Table
export {
  Table, TableBody, TableCaption, TableCell,
  TableFooter, TableHead, TableHeader, TableRow,
} from "./table";
export { DataTable } from "./data-table";

/**
 * Componentes de domínio DS Car (não shadcn puro)
 * Tipados com @paddock/types e @paddock/utils
 */
export { StatusBadge } from "./status-badge";
export { StatusPill } from "./status-pill";
export { SectionDivider } from "./section-divider";
export { RoleBadge } from "./role-badge";
export { Avatar } from "./avatar";
export { PageHeader } from "./page-header";
export { EmptyState } from "./empty-state";
