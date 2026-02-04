import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCleanup } from "../cleanup.js";
import * as service from "../service.js";

vi.mock("../service.js", () => ({
  cleanupExpiredSessions: vi.fn(),
}));

describe("runCleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should call cleanupExpiredSessions and return deleted count", async () => {
    vi.mocked(service.cleanupExpiredSessions).mockResolvedValue(5);

    const result = await runCleanup();

    expect(result).toEqual({ deleted: 5 });
    expect(service.cleanupExpiredSessions).toHaveBeenCalledTimes(1);
  });

  it("should log success message", async () => {
    vi.mocked(service.cleanupExpiredSessions).mockResolvedValue(10);

    await runCleanup();

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Starting session cleanup"));
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/Cleanup complete.*10 expired session/),
    );
  });

  it("should propagate errors", async () => {
    const error = new Error("Database connection failed");
    vi.mocked(service.cleanupExpiredSessions).mockRejectedValue(error);

    await expect(runCleanup()).rejects.toThrow("Database connection failed");
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Cleanup failed"), error);
  });

  it("should return zero when no sessions expired", async () => {
    vi.mocked(service.cleanupExpiredSessions).mockResolvedValue(0);

    const result = await runCleanup();

    expect(result).toEqual({ deleted: 0 });
  });
});
