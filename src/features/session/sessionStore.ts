import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { CURRENT_USER } from "../../config/currentUser";
import { getPermissions, type Permissions, type Role, type Session } from "./permissions";

export const sessionStore = createStore<Session>(() => ({
  userName: CURRENT_USER,
  role: "rep",
}));

export function getSession(): Session {
  return sessionStore.getState();
}

export function setRole(role: Role): void {
  sessionStore.setState({ role });
}

export function useSession(): Session {
  return useStore(sessionStore);
}

export function usePermissions(): Permissions {
  return getPermissions(useSession());
}
