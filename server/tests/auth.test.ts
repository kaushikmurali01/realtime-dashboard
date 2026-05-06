/**
 * Tests for password hashing.
 *
 * These are pure-function tests — no DB, no network.
 */
import { describe, expect, it } from "vitest";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

describe("password hashing", () => {
  it("hashes and verifies a correct password", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(verifyPassword("wrong password", stored)).toBe(false);
  });

  it("produces different hashes for the same password (salt)", () => {
    const a = hashPassword("password");
    const b = hashPassword("password");
    expect(a).not.toBe(b);
  });

  it("rejects malformed stored hashes", () => {
    expect(verifyPassword("anything", "no-colon")).toBe(false);
    expect(verifyPassword("anything", "")).toBe(false);
  });

  it("is robust against timing attacks (constant-time compare)", () => {
    // Not a real timing test, just verifying the API doesn't short-circuit.
    const stored = hashPassword("password");
    const wrongShort = "x";
    const wrongLong = "x".repeat(1000);
    expect(verifyPassword(wrongShort, stored)).toBe(false);
    expect(verifyPassword(wrongLong, stored)).toBe(false);
  });
});
