import { createStore } from "zustand/vanilla";

export interface SimConfig {
  minDelayMs: number;
  maxDelayMs: number;
  failureRate: number;
  teammateEditsPerMinute: number;
}

export const DEFAULT_SIM_CONFIG: SimConfig = {
  minDelayMs: 300,
  maxDelayMs: 1500,
  failureRate: 0.1,
  teammateEditsPerMinute: 6,
};

export const simConfigStore = createStore<SimConfig>(() => ({
  ...DEFAULT_SIM_CONFIG,
}));

export function getSimConfig(): SimConfig {
  return simConfigStore.getState();
}

export function updateSimConfig(patch: Partial<SimConfig>): void {
  simConfigStore.setState(patch);
}
