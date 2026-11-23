import type {
  Deal,
  DealStage,
  DealUpdateRequest,
  DealUpdateResult,
} from "../types/deal.types";

export interface BulkRequest {
  id: string;
  fromStage: DealStage;
  newStage: DealStage;
  expectedVersion: number;
}

export interface BulkOutcome {
  saved: Array<{ request: BulkRequest; deal: Deal }>;
  alreadyInTarget: Array<{ request: BulkRequest; deal: Deal }>;
  conflicts: Array<{ request: BulkRequest; latestDeal: Deal }>;
  failed: Array<{ request: BulkRequest; message: string; retryable: boolean }>;
  notAttempted: BulkRequest[];
}

export interface BulkProgress {
  processed: number;
  total: number;
}

export interface RunBulkMoveOptions {
  send: (requests: DealUpdateRequest[]) => Promise<DealUpdateResult[]>;
  chunkSize?: number;
  concurrency?: number;
  signal?: AbortSignal;
  onChunk?: (chunk: BulkOutcome, progress: BulkProgress) => void;
}

export function createEmptyOutcome(): BulkOutcome {
  return {
    saved: [],
    alreadyInTarget: [],
    conflicts: [],
    failed: [],
    notAttempted: [],
  };
}

export function splitIntoChunks<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function getResultId(result: DealUpdateResult): string {
  return result.status === "success" ? result.deal.id : result.id;
}

function mergeOutcome(target: BulkOutcome, source: BulkOutcome): void {
  target.saved.push(...source.saved);
  target.alreadyInTarget.push(...source.alreadyInTarget);
  target.conflicts.push(...source.conflicts);
  target.failed.push(...source.failed);
  target.notAttempted.push(...source.notAttempted);
}

async function sendChunk(
  requests: BulkRequest[],
  send: RunBulkMoveOptions["send"]
): Promise<BulkOutcome> {
  const outcome = createEmptyOutcome();
  let results: DealUpdateResult[];

  try {
    results = await send(
      requests.map(({ id, newStage, expectedVersion }) => ({
        id,
        newStage,
        expectedVersion,
      }))
    );
  } catch {
    for (const request of requests) {
      outcome.failed.push({
        request,
        message: "Network error. This deal was not saved.",
        retryable: true,
      });
    }

    return outcome;
  }

  const resultsById = new Map(
    results.map((result) => [getResultId(result), result])
  );

  for (const request of requests) {
    const result = resultsById.get(request.id);

    if (!result) {
      outcome.failed.push({
        request,
        message: "No response was received for this deal.",
        retryable: true,
      });
    } else if (result.status === "success") {
      outcome.saved.push({ request, deal: result.deal });
    } else if (result.status === "conflict") {
      if (result.latestDeal.stage === request.newStage) {
        outcome.alreadyInTarget.push({ request, deal: result.latestDeal });
      } else {
        outcome.conflicts.push({ request, latestDeal: result.latestDeal });
      }
    } else {
      outcome.failed.push({
        request,
        message: result.message,
        retryable: result.retryable,
      });
    }
  }

  return outcome;
}

export async function runBulkMove(
  requests: readonly BulkRequest[],
  options: RunBulkMoveOptions
): Promise<BulkOutcome> {
  const { send, chunkSize = 200, concurrency = 3, signal, onChunk } = options;
  const chunks = splitIntoChunks(requests, chunkSize);
  const outcome = createEmptyOutcome();
  const total = requests.length;
  let processed = 0;
  let nextChunkIndex = 0;

  async function worker(): Promise<void> {
    while (nextChunkIndex < chunks.length && !signal?.aborted) {
      const chunk = chunks[nextChunkIndex];
      nextChunkIndex += 1;

      const chunkOutcome = await sendChunk(chunk, send);

      mergeOutcome(outcome, chunkOutcome);
      processed += chunk.length;
      onChunk?.(chunkOutcome, { processed, total });
    }
  }

  const workerCount = Math.min(concurrency, chunks.length);

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  outcome.notAttempted = chunks.slice(nextChunkIndex).flat();

  return outcome;
}
