import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configured: true,
  after: vi.fn(),
  runTranslationSync: vi.fn(),
}));

vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("./server-client", () => ({
  isTolgeeSyncConfigured: () => mocks.configured,
}));
vi.mock("./sync-worker", () => ({
  runTranslationSync: mocks.runTranslationSync,
}));

import { scheduleTranslationSync } from "./schedule-sync";

describe("scheduleTranslationSync", () => {
  beforeEach(() => {
    mocks.configured = true;
    mocks.after.mockReset();
    mocks.runTranslationSync.mockReset().mockResolvedValue(undefined);
  });

  it("schedules a background drain when Tolgee is configured", async () => {
    let callback: (() => Promise<void>) | undefined;
    mocks.after.mockImplementation((fn: () => Promise<void>) => {
      callback = fn;
    });

    expect(scheduleTranslationSync(7)).toBe("scheduled");
    expect(mocks.after).toHaveBeenCalledTimes(1);

    await callback?.();
    expect(mocks.runTranslationSync).toHaveBeenCalledWith({ limit: 7 });
  });

  it("does not schedule when Tolgee is unconfigured", () => {
    mocks.configured = false;
    expect(scheduleTranslationSync()).toBe("unconfigured");
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("reports unavailable when there is no request scope", () => {
    mocks.after.mockImplementation(() => {
      throw new Error("after() was called outside a request scope");
    });
    expect(scheduleTranslationSync()).toBe("unavailable");
  });

  it("swallows a background failure so it cannot surface as an unhandled rejection", async () => {
    let callback: (() => Promise<void>) | undefined;
    mocks.after.mockImplementation((fn: () => Promise<void>) => {
      callback = fn;
    });
    mocks.runTranslationSync.mockRejectedValue(new Error("database down"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(scheduleTranslationSync()).toBe("scheduled");
    await callback?.();

    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
