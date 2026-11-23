export const BATCH_SIZE = 200;
export const PREFETCH_ROWS = 60;
export const KEEP_BATCHES_AROUND = 2;

export function batchOf(rowIndex: number): number {
  return Math.floor(rowIndex / BATCH_SIZE);
}

export function batchCount(total: number): number {
  return Math.ceil(total / BATCH_SIZE);
}

export function batchesNeeded(
  firstVisible: number,
  lastVisible: number,
  total: number
): number[] {
  if (total === 0) {
    return [];
  }

  const from = batchOf(Math.max(0, firstVisible - PREFETCH_ROWS));
  const to = batchOf(Math.min(total - 1, lastVisible + PREFETCH_ROWS));
  const needed: number[] = [];

  for (let batch = from; batch <= to; batch += 1) {
    needed.push(batch);
  }

  return needed;
}

export function batchesToDrop(
  loaded: readonly number[],
  firstVisible: number,
  lastVisible: number
): number[] {
  const keepFrom = batchOf(firstVisible) - KEEP_BATCHES_AROUND;
  const keepTo = batchOf(lastVisible) + KEEP_BATCHES_AROUND;

  return loaded.filter((batch) => batch < keepFrom || batch > keepTo);
}

export function rowIdAt(
  batches: Readonly<Record<number, readonly string[]>>,
  rowIndex: number
): string | undefined {
  return batches[batchOf(rowIndex)]?.[rowIndex % BATCH_SIZE];
}

export function rowIdsBetween(
  batches: Readonly<Record<number, readonly string[]>>,
  fromIndex: number,
  toIndex: number
): string[] {
  const ids: string[] = [];

  for (let index = fromIndex; index <= toIndex; index += 1) {
    const id = rowIdAt(batches, index);

    if (id) {
      ids.push(id);
    }
  }

  return ids;
}
