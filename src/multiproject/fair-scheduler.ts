export interface FairSchedulingOptions {
  globalConcurrency?: number;
  perProjectConcurrency?: number;
  maxQueuedPerProject?: number;
  maxQueuedBytes?: number;
  queueTimeoutMs?: number;
  maxRequestsPerProject?: number;
  maxRequestsGlobal?: number;
  rateWindowMs?: number;
}
export class AdmissionError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = "AdmissionError";
  }
}
interface RequiredScheduling {
  globalConcurrency: number;
  perProjectConcurrency: number;
  maxQueuedPerProject: number;
  maxQueuedBytes: number;
  queueTimeoutMs: number;
  maxRequestsPerProject: number;
  maxRequestsGlobal: number;
  rateWindowMs: number;
}
interface PendingRequest {
  projectId: string;
  bytes: number;
  resolve(release: () => void): void;
  reject(error: AdmissionError): void;
  timer: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  onAbort?: () => void;
}
/** Hard upper bounds apply even to explicitly supplied operator manifests. */
const MAXIMUMS: RequiredScheduling = {
  globalConcurrency: 64,
  perProjectConcurrency: 32,
  maxQueuedPerProject: 1024,
  maxQueuedBytes: 64 * 1024 * 1024,
  queueTimeoutMs: 60_000,
  maxRequestsPerProject: 100_000,
  maxRequestsGlobal: 100_000,
  rateWindowMs: 3_600_000,
};

const DEFAULTS: RequiredScheduling = {
  globalConcurrency: 16,
  perProjectConcurrency: 4,
  maxQueuedPerProject: 512,
  maxQueuedBytes: 16 * 1024 * 1024,
  queueTimeoutMs: 15000,
  maxRequestsPerProject: 1000,
  maxRequestsGlobal: 10000,
  rateWindowMs: 60000,
};

/**
 * Bounded, fair admission across independently authorized project IDs.
 * Quota is charged on accepted submission, even when an admitted request
 * later times out. This prevents retries from bypassing rate controls.
 */
export class FairProjectScheduler {
  private readonly config: RequiredScheduling;
  private readonly pending = new Map<string, PendingRequest[]>();
  private readonly activeProjects = new Map<string, number>();
  private readonly pendingBytes = new Map<string, number>();
  private readonly projectCalls = new Map<string, number[]>();
  private globalCalls: number[] = [];
  private active = 0;
  private queued = 0;
  private queuedBytes = 0;
  private lastServed = "";
  private stopped = false;
  private accepted = 0;
  private rejected = 0;
  constructor(
    options: FairSchedulingOptions = {},
    private readonly now: () => number = Date.now,
    private readonly authorizedProjectCount = 1,
  ) {
    if (!Number.isInteger(authorizedProjectCount) || authorizedProjectCount < 1 ||
        authorizedProjectCount > 32) {
      throw new Error("Invalid authorized project count");
    }
    this.config = { ...DEFAULTS, ...options };
    for (const [key, value] of Object.entries(this.config)) {
      const maximum = MAXIMUMS[key as keyof RequiredScheduling];
      if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
        throw new Error("Invalid scheduling limit or exceeds hard cap: " + key);
      }
    }
    if (this.config.perProjectConcurrency > this.config.globalConcurrency) {
      throw new Error("Project concurrency cannot exceed the global cap");
    }
  }

  private fail(code: string, status = 503): AdmissionError {
    this.rejected++;
    return new AdmissionError(code, status);
  }
  private remove(waiter: PendingRequest): boolean {
    const bucket = this.pending.get(waiter.projectId);
    if (!bucket) return false;
    const index = bucket.indexOf(waiter);
    if (index < 0) return false;
    bucket.splice(index, 1);
    if (!bucket.length) this.pending.delete(waiter.projectId);
    this.queued--;
    this.queuedBytes -= waiter.bytes;
    const remainingBytes = (this.pendingBytes.get(waiter.projectId) ?? 0) - waiter.bytes;
    if (bucket.length > 0) this.pendingBytes.set(waiter.projectId, remainingBytes);
    else this.pendingBytes.delete(waiter.projectId);
    clearTimeout(waiter.timer);
    if (waiter.signal && waiter.onAbort) {
      waiter.signal.removeEventListener("abort", waiter.onAbort);
    }
    return true;
  }
  private dispatch(): void {
    while (!this.stopped && this.active < this.config.globalConcurrency && this.queued > 0) {
      const ids = [...this.pending.keys()];
      const previous = ids.indexOf(this.lastServed);
      const first = previous >= 0 ? (previous + 1) % ids.length : 0;
      let chosen: string | undefined;
      for (let step = 0; step < ids.length; step++) {
        const id = ids[(first + step) % ids.length]!;
        if ((this.activeProjects.get(id) ?? 0) < this.config.perProjectConcurrency) {
          chosen = id;
          break;
        }
      }
      if (!chosen) break;
      const next = this.pending.get(chosen)![0]!;
      this.remove(next);
      this.active++;
      this.activeProjects.set(chosen, (this.activeProjects.get(chosen) ?? 0) + 1);
      this.lastServed = chosen;
      let released = false;
      next.resolve(() => {
        if (released) return;
        released = true;
        this.active--;
        const remaining = (this.activeProjects.get(chosen) ?? 1) - 1;
        if (remaining) this.activeProjects.set(chosen, remaining);
        else this.activeProjects.delete(chosen);
        this.dispatch();
      });
    }
  }

  acquire(projectId: string, bytes = 0, signal?: AbortSignal): Promise<() => void> {
    if (this.stopped) return Promise.reject(this.fail("scheduler_closed"));
    if (!projectId || !Number.isSafeInteger(bytes) || bytes < 0) {
      return Promise.reject(this.fail("invalid_admission"));
    }
    if (signal?.aborted) return Promise.reject(this.fail("queue_cancelled", 499));
    const time = this.now();
    this.globalCalls = this.globalCalls.filter((at) => time - at < this.config.rateWindowMs);
    const projectCalls = (this.projectCalls.get(projectId) ?? [])
      .filter((at) => time - at < this.config.rateWindowMs);
    this.projectCalls.set(projectId, projectCalls);
    if (this.globalCalls.length >= this.config.maxRequestsGlobal) {
      return Promise.reject(this.fail("global_rate_limited", 429));
    }
    if (projectCalls.length >= this.config.maxRequestsPerProject) {
      return Promise.reject(this.fail("project_rate_limited", 429));
    }
    // A project may never occupy another authorized project's reserved queue
    // memory. Do not penalize a ready-to-run request for queue bytes it does
    // not actually retain while waiting.
    const dispatchImmediately = this.queued === 0 &&
      this.active < this.config.globalConcurrency &&
      (this.activeProjects.get(projectId) ?? 0) < this.config.perProjectConcurrency;
    const reservedPerProject = Math.floor(this.config.maxQueuedBytes / this.authorizedProjectCount);
    if (!dispatchImmediately &&
        ((this.pending.get(projectId)?.length ?? 0) >= this.config.maxQueuedPerProject ||
          bytes + this.queuedBytes > this.config.maxQueuedBytes ||
          bytes + (this.pendingBytes.get(projectId) ?? 0) > reservedPerProject)) {
      return Promise.reject(this.fail("queue_full", 503));
    }
    // A strict global cap survives the per-project split. These counters use
    // the project ID chosen by the authenticated router, never a raw path/header.
    this.globalCalls.push(time);
    projectCalls.push(time);
    this.accepted++;
    return new Promise<() => void>((resolve, reject) => {
      const waiter: PendingRequest = {
        projectId, bytes, resolve, reject,
        timer: setTimeout(() => {
          if (this.remove(waiter)) reject(this.fail("queue_timeout", 503));
        }, this.config.queueTimeoutMs),
      };
      if (signal) {
        waiter.signal = signal;
        waiter.onAbort = () => {
          if (this.remove(waiter)) reject(this.fail("queue_cancelled", 499));
        };
        signal.addEventListener("abort", waiter.onAbort, { once: true });
      }
      const bucket = this.pending.get(projectId) ?? [];
      bucket.push(waiter);
      this.pending.set(projectId, bucket);
      this.queued++;
      this.queuedBytes += bytes;
      this.pendingBytes.set(projectId, (this.pendingBytes.get(projectId) ?? 0) + bytes);
      this.dispatch();
    });
  }

  snapshot(): {
    active: number; queued: number; queuedBytes: number; accepted: number; rejected: number;
  } {
    return { active: this.active, queued: this.queued, queuedBytes: this.queuedBytes,
      accepted: this.accepted, rejected: this.rejected };
  }

  close(): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const bucket of [...this.pending.values()]) {
      for (const waiter of [...bucket]) {
        if (this.remove(waiter)) waiter.reject(this.fail("scheduler_closed"));
      }
    }
    this.pending.clear();
  }
}
