import { describe, expect, it } from "vitest";
import {
  allowedScope,
  canEditDeal,
  canViewDeal,
  getPermissions,
  type Session,
} from "./permissions";

const rep: Session = { userName: "Rahul Sharma", role: "rep" };
const manager: Session = { userName: "Rahul Sharma", role: "manager" };
const ownDeal = { ownerName: "Rahul Sharma" };
const teammateDeal = { ownerName: "Priya Singh" };

describe("sales representative", () => {
  it("cannot see the team, even when asking for it", () => {
    expect(getPermissions(rep).canViewTeam).toBe(false);
    expect(allowedScope(rep, "all")).toBe("mine");
  });

  it("can see and change only their own deals", () => {
    expect(canViewDeal(rep, ownDeal)).toBe(true);
    expect(canEditDeal(rep, ownDeal)).toBe(true);
    expect(canViewDeal(rep, teammateDeal)).toBe(false);
    expect(canEditDeal(rep, teammateDeal)).toBe(false);
  });
});

describe("sales manager", () => {
  it("can see the whole team or only their own deals", () => {
    expect(allowedScope(manager, "all")).toBe("all");
    expect(allowedScope(manager, "mine")).toBe("mine");
  });

  it("can see and change any deal", () => {
    expect(canViewDeal(manager, teammateDeal)).toBe(true);
    expect(canEditDeal(manager, teammateDeal)).toBe(true);
  });
});
