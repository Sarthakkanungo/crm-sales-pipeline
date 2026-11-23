import type { DealUpdateResult } from "../types/deal.types";

export interface KeyedQueue {
  run<T>(key: string, task: () => Promise<T>): Promise<T>;
  pendingKeys(): number;
}

export function createKeyedQueue(): KeyedQueue {
  const tails = new Map<string, Promise<void>>();

  return {
    run<T>(key: string, task: () => Promise<T>): Promise<T> {
      const previous = tails.get(key) ?? Promise.resolve();
      const current = previous.then(task);
      const settled = current.then(
        () => undefined,
        () => undefined
      );

      tails.set(key, settled);

      void settled.then(() => {
        if (tails.get(key) === settled) {
          tails.delete(key);
        }
      });

      return current;
    },

    pendingKeys() {
      return tails.size;
    },
  };
}

export function followOwnWrites(
  seenVersion: number,
  ownWrites: ReadonlyMap<number, number> | undefined
): number {
  let version = seenVersion;

  while (ownWrites?.has(version)) {
    version = ownWrites.get(version)!;
  }

  return version;
}

export type SendWithVersion = (
  expectedVersion: number
) => Promise<DealUpdateResult>;

export interface OrderedDealWriter {
  write(
    dealId: string,
    seenVersion: number,
    send: SendWithVersion
  ): Promise<DealUpdateResult>;
}

export function createOrderedDealWriter(): OrderedDealWriter {
  const queue = createKeyedQueue();
  const ownWrites = new Map<string, Map<number, number>>();

  return {
    write(dealId, seenVersion, send) {
      return queue.run(dealId, async () => {
        const expectedVersion = followOwnWrites(
          seenVersion,
          ownWrites.get(dealId)
        );

        const result = await send(expectedVersion);

        if (result.status === "success") {
          const writes = ownWrites.get(dealId) ?? new Map<number, number>();
          writes.set(expectedVersion, result.deal.version);
          ownWrites.set(dealId, writes);
        }

        return result;
      });
    },
  };
}
