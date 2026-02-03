/**
 * Rate Limiter Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  RateLimiter,
  createRateLimiter,
  getGlobalRateLimiter,
  resetGlobalRateLimiter,
  type RateLimitResource,
} from "../rate-limiter.js";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = createRateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("shouldThrottle", () => {
    it("should return false for untracked resource", () => {
      expect(limiter.shouldThrottle("mail")).toBe(false);
    });

    it("should return true after 429 response", () => {
      limiter.recordResponse("mail", 429);
      expect(limiter.shouldThrottle("mail")).toBe(true);
    });

    it("should return false after throttle period expires", () => {
      limiter.recordResponse("mail", 429, "5");
      expect(limiter.shouldThrottle("mail")).toBe(true);

      // Advance time past throttle period
      vi.advanceTimersByTime(6000);
      expect(limiter.shouldThrottle("mail")).toBe(false);
    });

    it("should track resources independently", () => {
      limiter.recordResponse("mail", 429);
      expect(limiter.shouldThrottle("mail")).toBe(true);
      expect(limiter.shouldThrottle("calendar")).toBe(false);
    });
  });

  describe("getWaitTime", () => {
    it("should return 0 for untracked resource", () => {
      expect(limiter.getWaitTime("sharepoint")).toBe(0);
    });

    it("should return positive value after 429", () => {
      limiter.recordResponse("sharepoint", 429, "10");
      const waitTime = limiter.getWaitTime("sharepoint");
      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(10000);
    });

    it("should decrease over time", () => {
      limiter.recordResponse("sharepoint", 429, "10");
      const initial = limiter.getWaitTime("sharepoint");

      vi.advanceTimersByTime(5000);
      const afterDelay = limiter.getWaitTime("sharepoint");

      expect(afterDelay).toBeLessThan(initial);
    });

    it("should return 0 after wait period", () => {
      limiter.recordResponse("sharepoint", 429, "5");
      vi.advanceTimersByTime(5001);
      expect(limiter.getWaitTime("sharepoint")).toBe(0);
    });
  });

  describe("recordResponse", () => {
    it("should not throttle on success (200)", () => {
      limiter.recordResponse("mail", 200);
      expect(limiter.shouldThrottle("mail")).toBe(false);
    });

    it("should handle Retry-After as seconds string", () => {
      limiter.recordResponse("mail", 429, "30");
      const waitTime = limiter.getWaitTime("mail");
      expect(waitTime).toBeGreaterThan(29000);
      expect(waitTime).toBeLessThanOrEqual(30000);
    });

    it("should handle Retry-After as number", () => {
      limiter.recordResponse("mail", 429, 15);
      const waitTime = limiter.getWaitTime("mail");
      expect(waitTime).toBeGreaterThan(14000);
      expect(waitTime).toBeLessThanOrEqual(15000);
    });

    it("should handle Retry-After as HTTP date", () => {
      const futureDate = new Date(Date.now() + 20000);
      limiter.recordResponse("mail", 429, futureDate.toUTCString());
      const waitTime = limiter.getWaitTime("mail");
      expect(waitTime).toBeGreaterThan(19000);
      expect(waitTime).toBeLessThanOrEqual(20000);
    });

    it("should use base backoff for missing Retry-After", () => {
      const customLimiter = createRateLimiter({ baseBackoffMs: 2000 });
      customLimiter.recordResponse("mail", 429);
      const waitTime = customLimiter.getWaitTime("mail");
      expect(waitTime).toBeGreaterThanOrEqual(2000);
    });

    it("should apply exponential backoff for consecutive throttles", () => {
      const baseLimiter = createRateLimiter({ baseBackoffMs: 1000, maxBackoffMs: 60000 });

      // First throttle
      baseLimiter.recordResponse("mail", 429);
      const firstWait = baseLimiter.getWaitTime("mail");

      vi.advanceTimersByTime(firstWait + 100);

      // Second throttle
      baseLimiter.recordResponse("mail", 429);
      const secondWait = baseLimiter.getWaitTime("mail");

      vi.advanceTimersByTime(secondWait + 100);

      // Third throttle
      baseLimiter.recordResponse("mail", 429);
      const thirdWait = baseLimiter.getWaitTime("mail");

      // Each should be roughly double the base (exponential)
      expect(secondWait).toBeGreaterThanOrEqual(firstWait);
      expect(thirdWait).toBeGreaterThanOrEqual(secondWait);
    });

    it("should not exceed maxBackoffMs", () => {
      const customLimiter = createRateLimiter({ baseBackoffMs: 1000, maxBackoffMs: 5000 });

      // Simulate many consecutive throttles
      for (let i = 0; i < 10; i++) {
        customLimiter.recordResponse("mail", 429);
        vi.advanceTimersByTime(customLimiter.getWaitTime("mail") + 100);
      }

      customLimiter.recordResponse("mail", 429);
      expect(customLimiter.getWaitTime("mail")).toBeLessThanOrEqual(5000);
    });

    it("should reset throttle count after success period", () => {
      const customLimiter = createRateLimiter({
        baseBackoffMs: 1000,
        resetAfterMs: 10000,
      });

      // Trigger throttle
      customLimiter.recordResponse("mail", 429);
      vi.advanceTimersByTime(customLimiter.getWaitTime("mail") + 100);

      // Record success and wait for reset period
      customLimiter.recordResponse("mail", 200);
      vi.advanceTimersByTime(11000);
      customLimiter.recordResponse("mail", 200);

      // Next throttle should start fresh
      customLimiter.recordResponse("mail", 429);
      const waitTime = customLimiter.getWaitTime("mail");
      expect(waitTime).toBeLessThanOrEqual(2000); // Should be near base, not accumulated
    });
  });

  describe("getResourceFromPath", () => {
    it("should identify mail resources", () => {
      expect(RateLimiter.getResourceFromPath("/me/messages")).toBe("mail");
      expect(RateLimiter.getResourceFromPath("/me/mailFolders")).toBe("mail");
      expect(RateLimiter.getResourceFromPath("/users/123/sendMail")).toBe("mail");
    });

    it("should identify calendar resources", () => {
      expect(RateLimiter.getResourceFromPath("/me/calendar")).toBe("calendar");
      expect(RateLimiter.getResourceFromPath("/me/events")).toBe("calendar");
      expect(RateLimiter.getResourceFromPath("/me/calendarView")).toBe("calendar");
    });

    it("should identify contacts resources", () => {
      expect(RateLimiter.getResourceFromPath("/me/contacts")).toBe("contacts");
      expect(RateLimiter.getResourceFromPath("/me/contactFolders")).toBe("contacts");
    });

    it("should identify SharePoint resources", () => {
      expect(RateLimiter.getResourceFromPath("/sites/root")).toBe("sharepoint");
      expect(RateLimiter.getResourceFromPath("/sites/contoso.sharepoint.com")).toBe("sharepoint");
    });

    it("should identify OneDrive resources", () => {
      expect(RateLimiter.getResourceFromPath("/me/drive")).toBe("onedrive");
      expect(RateLimiter.getResourceFromPath("/drives/abc123")).toBe("onedrive");
    });

    it("should identify Teams resources", () => {
      expect(RateLimiter.getResourceFromPath("/teams/123")).toBe("teams");
      expect(RateLimiter.getResourceFromPath("/teams/123/channels")).toBe("teams");
      expect(RateLimiter.getResourceFromPath("/chats/456")).toBe("teams");
    });

    it("should identify user resources", () => {
      expect(RateLimiter.getResourceFromPath("/me")).toBe("users");
      expect(RateLimiter.getResourceFromPath("/users/123")).toBe("users");
    });

    it("should identify group resources", () => {
      expect(RateLimiter.getResourceFromPath("/groups/123")).toBe("groups");
    });

    it("should return default for unknown paths", () => {
      expect(RateLimiter.getResourceFromPath("/unknown/resource")).toBe("default");
      expect(RateLimiter.getResourceFromPath("/applications")).toBe("default");
    });
  });

  describe("clear", () => {
    it("should clear all throttle state", () => {
      limiter.recordResponse("mail", 429);
      limiter.recordResponse("calendar", 429);
      expect(limiter.shouldThrottle("mail")).toBe(true);
      expect(limiter.shouldThrottle("calendar")).toBe(true);

      limiter.clear();

      expect(limiter.shouldThrottle("mail")).toBe(false);
      expect(limiter.shouldThrottle("calendar")).toBe(false);
    });
  });

  describe("getThrottleState", () => {
    it("should return undefined for untracked resource", () => {
      expect(limiter.getThrottleState("mail")).toBeUndefined();
    });

    it("should return throttle entry after 429", () => {
      limiter.recordResponse("mail", 429);
      const state = limiter.getThrottleState("mail");
      expect(state).toBeDefined();
      expect(state?.consecutiveThrottles).toBe(1);
      expect(state?.blockedUntil).toBeGreaterThan(Date.now());
    });
  });
});

describe("Global Rate Limiter", () => {
  afterEach(() => {
    resetGlobalRateLimiter();
  });

  it("should return the same instance", () => {
    const first = getGlobalRateLimiter();
    const second = getGlobalRateLimiter();
    expect(first).toBe(second);
  });

  it("should reset and create new instance", () => {
    const first = getGlobalRateLimiter();
    first.recordResponse("mail", 429);

    resetGlobalRateLimiter();

    const second = getGlobalRateLimiter();
    expect(second).not.toBe(first);
    expect(second.shouldThrottle("mail")).toBe(false);
  });
});
