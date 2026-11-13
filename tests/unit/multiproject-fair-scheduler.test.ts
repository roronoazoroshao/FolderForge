import { describe, expect, it } from "vitest";
import { FairProjectScheduler } from "../../src/multiproject/fair-scheduler.js";

describe("F15 fair per-project admission (TDD)", () => {
  it("rejects unbounded operator scheduling limits before requests are accepted", () => {
    const invalid = [
      { globalConcurrency: 4096 },
      { perProjectConcurrency: 200, globalConcurrency: 200 },
      { maxQueuedPerProject: 1_000_000 },
      { maxQueuedBytes: 2 ** 36 },
      { queueTimeoutMs: 86_400_000 },
      { maxRequestsGlobal: 10_000_000 },
      { maxRequestsPerProject: 10_000_000 },
      { rateWindowMs: 86_400_000 },
    ];
    invalid.forEach((options) => {
      expect(() => new FairProjectScheduler(options)).toThrow(/limit|cap/i);
    });
  });

  it("schedules the other project before replaying one project backlog", async () => {
    const scheduler = new FairProjectScheduler({
      globalConcurrency: 1, perProjectConcurrency: 1,
      maxQueuedPerProject: 3, maxQueuedBytes: 4096, queueTimeoutMs: 1000,
    });
    const releaseFirst = await scheduler.acquire("project-a", 8);
    const order: string[] = [];
    const a2 = scheduler.acquire("project-a", 8).then((release) => { order.push("a2"); return release; });
    const b1 = scheduler.acquire("project-b", 8).then((release) => { order.push("b1"); return release; });
    const a3 = scheduler.acquire("project-a", 8).then((release) => { order.push("a3"); return release; });
    expect(scheduler.snapshot().active).toBe(1);
    expect(scheduler.snapshot().queued).toBe(3);
    releaseFirst();
    const releaseB = await b1;
    expect(order).toEqual(["b1"]);
    releaseB();
    const releaseA2 = await a2;
    expect(order).toEqual(["b1", "a2"]);
    releaseA2();
    (await a3)();
    expect(scheduler.snapshot()).toMatchObject({ active: 0, queued: 0 });
  });

  it("enforces separate project quotas plus a retained global abuse cap", async () => {
    let now = 10_000;
    const scheduler = new FairProjectScheduler({
      globalConcurrency: 3, perProjectConcurrency: 2, maxQueuedPerProject: 5,
      maxRequestsPerProject: 2, maxRequestsGlobal: 4, rateWindowMs: 60000,
    }, () => now);
    (await scheduler.acquire("project-a"))();
    (await scheduler.acquire("project-a"))();
    await expect(scheduler.acquire("project-a")).rejects.toMatchObject({
      code: "project_rate_limited", status: 429,
    });
    (await scheduler.acquire("project-b"))();
    (await scheduler.acquire("project-b"))();
    await expect(scheduler.acquire("project-c")).rejects.toMatchObject({
      code: "global_rate_limited", status: 429,
    });
    now += 60001;
    (await scheduler.acquire("project-a"))();
    expect(scheduler.snapshot().active).toBe(0);
  });

  it("reserves queue bytes for a second authorized project when the first floods its backlog", async () => {
    const scheduler = new FairProjectScheduler({
      globalConcurrency: 1, perProjectConcurrency: 1,
      maxQueuedPerProject: 10, maxQueuedBytes: 64, queueTimeoutMs: 1000,
    }, Date.now, 2);
    const a1 = await scheduler.acquire("project-a", 8);
    const a2 = scheduler.acquire("project-a", 32);
    await expect(scheduler.acquire("project-a", 32)).rejects.toMatchObject({
      code: "queue_full", status: 503,
    });
    const b1 = scheduler.acquire("project-b", 32);
    expect(scheduler.snapshot()).toMatchObject({ active: 1, queued: 2, queuedBytes: 64 });
    a1();
    const releaseB = await b1;
    expect(scheduler.snapshot().queued).toBe(1);
    releaseB();
    (await a2)();
    expect(scheduler.snapshot()).toMatchObject({ active: 0, queued: 0, queuedBytes: 0 });
  });

  it("bounds the queue, removes cancelled waiters and reuses capacity", async () => {
    const scheduler = new FairProjectScheduler({
      globalConcurrency: 1, perProjectConcurrency: 1,
      maxQueuedPerProject: 1, maxQueuedBytes: 48, queueTimeoutMs: 1000,
    });
    const releaseFirst = await scheduler.acquire("project-a", 16);
    const signal = new AbortController();
    const waiting = scheduler.acquire("project-a", 40, signal.signal);
    await expect(scheduler.acquire("project-a", 40)).rejects.toMatchObject({
      code: "queue_full", status: 503,
    });
    signal.abort();
    await expect(waiting).rejects.toMatchObject({ code: "queue_cancelled" });
    const pendingB = scheduler.acquire("project-b", 40);
    expect(scheduler.snapshot().queuedBytes).toBe(40);
    releaseFirst();
    (await pendingB)();
    expect(scheduler.snapshot()).toMatchObject({ active: 0, queued: 0, queuedBytes: 0 });
  });

  it("expires a queued admission without starting a worker or leaking a slot", async () => {
    const scheduler = new FairProjectScheduler({
      globalConcurrency: 1, perProjectConcurrency: 1,
      queueTimeoutMs: 15, maxQueuedPerProject: 1,
    });
    const release = await scheduler.acquire("project-a");
    await expect(scheduler.acquire("project-b")).rejects.toMatchObject({
      code: "queue_timeout", status: 503,
    });
    release();
    expect(scheduler.snapshot()).toMatchObject({ active: 0, queued: 0 });
  });
});
