import type { Deal, DealScope } from "../deals/types/deal.types";

export type Role = "rep" | "manager";

export interface Session {
  userName: string;
  role: Role;
}

export interface Permissions {
  canViewTeam: boolean;
  canEditOthersDeals: boolean;
}

export const ROLE_LABELS: Record<Role, string> = {
  rep: "Sales Representative",
  manager: "Sales Manager",
};

export function getPermissions(session: Session): Permissions {
  const isManager = session.role === "manager";

  return {
    canViewTeam: isManager,
    canEditOthersDeals: isManager,
  };
}

export function allowedScope(session: Session, requested: DealScope): DealScope {
  return getPermissions(session).canViewTeam ? requested : "mine";
}

export function canViewDeal(session: Session, deal: Pick<Deal, "ownerName">): boolean {
  return getPermissions(session).canViewTeam || deal.ownerName === session.userName;
}

export function canEditDeal(session: Session, deal: Pick<Deal, "ownerName">): boolean {
  return getPermissions(session).canEditOthersDeals || deal.ownerName === session.userName;
}
