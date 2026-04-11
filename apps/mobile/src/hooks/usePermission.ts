import { useAuthStore } from '@/stores/auth.store';

const ROLE_HIERARCHY = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  CONSULTANT: 2,
  STOREKEEPER: 1,
} as const;

type Role = keyof typeof ROLE_HIERARCHY;

export function usePermission(minimumRole: Role): boolean {
  const role = useAuthStore((s) => s.user?.role);
  if (!role) return false;
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimumRole];
}
