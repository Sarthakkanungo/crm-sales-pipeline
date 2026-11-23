import {
  DEAL_STAGES,
  type Deal,
  type DealStage,
} from "../types/deal.types";
import {
  classifyFollowUpTime,
  computeDealKeys,
  getDayBounds,
  getFollowUpTiming,
  isOpenStage,
  type DealKeysLookup,
} from "./dealQuery";

export interface DashboardData {
  activeDeals: number;
  dueToday: number;
  overdue: number;
  wonDeals: number;
  stageCounts: Record<DealStage, number>;
  activeValue: number;
  dueTodayValue: number;
  overdueValue: number;
  stageValues: Record<DealStage, number>;
}

export interface ViewTabCounts {
  all: number;
  active: number;
  overdue: number;
  dueToday: number;
  updatedToday: number;
}

export function createEmptyStageCounts(): Record<DealStage, number> {
  return Object.fromEntries(DEAL_STAGES.map((stage) => [stage, 0])) as Record<
    DealStage,
    number
  >;
}

export function buildDashboard(
  deals: readonly Deal[],
  now: Date,
  getKeys: DealKeysLookup = computeDealKeys
): DashboardData {
  const stageCounts = createEmptyStageCounts();
  const stageValues = createEmptyStageCounts();
  const bounds = getDayBounds(now);
  let activeDeals = 0;
  let dueToday = 0;
  let overdue = 0;
  let activeValue = 0;
  let dueTodayValue = 0;
  let overdueValue = 0;

  for (const deal of deals) {
    stageCounts[deal.stage] += 1;
    stageValues[deal.stage] += deal.value;

    if (!isOpenStage(deal.stage)) {
      continue;
    }

    activeDeals += 1;
    activeValue += deal.value;

    const bucket = classifyFollowUpTime(getKeys(deal).nextFollowUpAt, bounds);

    if (bucket === "overdue") {
      overdue += 1;
      overdueValue += deal.value;
    } else if (bucket === "dueToday") {
      dueToday += 1;
      dueTodayValue += deal.value;
    }
  }

  return {
    activeDeals,
    dueToday,
    overdue,
    wonDeals: stageCounts.Won,
    stageCounts,
    activeValue,
    dueTodayValue,
    overdueValue,
    stageValues,
  };
}

export function countViewTabs(
  deals: readonly Deal[],
  now: Date,
  getKeys: DealKeysLookup = computeDealKeys
): ViewTabCounts {
  const bounds = getDayBounds(now);
  let active = 0;
  let overdue = 0;
  let dueToday = 0;
  let updatedToday = 0;

  for (const deal of deals) {
    const keys = getKeys(deal);

    if (keys.updatedAt >= bounds.start && keys.updatedAt < bounds.end) {
      updatedToday += 1;
    }

    if (!isOpenStage(deal.stage)) {
      continue;
    }

    active += 1;

    const bucket = classifyFollowUpTime(keys.nextFollowUpAt, bounds);

    if (bucket === "overdue") {
      overdue += 1;
    } else if (bucket === "dueToday") {
      dueToday += 1;
    }
  }

  return { all: deals.length, active, overdue, dueToday, updatedToday };
}

export function applyStageChange(
  data: DashboardData,
  deal: Deal,
  fromStage: DealStage,
  toStage: DealStage,
  now: Date
): DashboardData {
  if (fromStage === toStage) {
    return data;
  }

  const stageCounts = { ...data.stageCounts };
  stageCounts[fromStage] = Math.max(0, stageCounts[fromStage] - 1);
  stageCounts[toStage] += 1;

  const stageValues = { ...data.stageValues };
  stageValues[fromStage] = Math.max(0, stageValues[fromStage] - deal.value);
  stageValues[toStage] += deal.value;

  const wasOpen = isOpenStage(fromStage);
  const isOpen = isOpenStage(toStage);
  const openDelta = Number(isOpen) - Number(wasOpen);
  const activeDeals = data.activeDeals + openDelta;
  const activeValue = Math.max(0, data.activeValue + openDelta * deal.value);

  let { overdue, dueToday, overdueValue, dueTodayValue } = data;

  if (wasOpen !== isOpen) {
    const bucket = getFollowUpTiming(deal.nextFollowUpAt, now);

    if (bucket === "overdue") {
      overdue = Math.max(0, overdue + openDelta);
      overdueValue = Math.max(0, overdueValue + openDelta * deal.value);
    } else if (bucket === "dueToday") {
      dueToday = Math.max(0, dueToday + openDelta);
      dueTodayValue = Math.max(0, dueTodayValue + openDelta * deal.value);
    }
  }

  return {
    activeDeals,
    dueToday,
    overdue,
    wonDeals: stageCounts.Won,
    stageCounts,
    activeValue,
    dueTodayValue,
    overdueValue,
    stageValues,
  };
}
