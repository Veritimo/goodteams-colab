/**
 * Basic health check tests for GoodTeams platform
 * These tests verify the basic setup is working correctly
 */

import { describe, expect, it } from "vitest";

describe("Platform Health Check", () => {
  it("should have working test infrastructure", () => {
    expect(true).toBe(true);
  });

  it("should have access to environment", () => {
    expect(process).toBeDefined();
    expect(process.env).toBeDefined();
  });

  it("should be running in test environment", () => {
    // vitest sets NODE_ENV to 'test' by default
    expect(process.env.NODE_ENV).toBe("test");
  });
});

describe("Basic TypeScript Functionality", () => {
  it("should support async/await", async () => {
    const asyncFn = async (): Promise<string> => {
      return "async works";
    };
    const result = await asyncFn();
    expect(result).toBe("async works");
  });

  it("should support modern ES features", () => {
    // Destructuring
    const obj = { a: 1, b: 2 };
    const { a, b } = obj;
    expect(a).toBe(1);
    expect(b).toBe(2);

    // Spread operator
    const arr1 = [1, 2];
    const arr2 = [...arr1, 3];
    expect(arr2).toEqual([1, 2, 3]);

    // Optional chaining
    const nested: { foo?: { bar?: string } } = {};
    expect(nested?.foo?.bar).toBeUndefined();
  });
});
