// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const config = vi.hoisted(() => ({ NODE_ENV: "production" }));
vi.mock("~/env", () => ({ env: config }));

import {
  getClientIp,
  normalizeClientIp,
  withTrustedClientIp,
} from "./client-ip";

afterEach(() => {
  config.NODE_ENV = "production";
});

describe("Render client IP", () => {
  it.each([
    ["203.0.113.10", "203.0.113.10"],
    [" 203.0.113.10 ", "203.0.113.10"],
    ["0.0.0.0", "0.0.0.0"],
    ["255.255.255.255", "255.255.255.255"],
    ["::ffff:203.0.113.10", "203.0.113.10"],
    ["::FFFF:cb00:710a", "203.0.113.10"],
    ["0:0:0:0:0:ffff:cb00:710a", "203.0.113.10"],
    ["2001:DB8:abcd:1234::1", "2001:0db8:abcd:1234:0000:0000:0000:0000"],
    [
      "2001:0db8:abcd:1234:0000:0000:0000:0001",
      "2001:0db8:abcd:1234:0000:0000:0000:0000",
    ],
    [
      "2001:db8:abcd:1234:ffff:ffff:ffff:ffff",
      "2001:0db8:abcd:1234:0000:0000:0000:0000",
    ],
    ["::", "0000:0000:0000:0000:0000:0000:0000:0000"],
    ["::1", "0000:0000:0000:0000:0000:0000:0000:0000"],
    ["2001:db8::192.0.2.1", "2001:0db8:0000:0000:0000:0000:0000:0000"],
  ])("normalizes %s to %s", (value, expected) => {
    expect(normalizeClientIp(value)).toBe(expected);
  });

  it.each([
    null,
    "",
    " ",
    "unknown",
    "203.0.113.256",
    "203.0.113.01",
    "127.1",
    "0x7f000001",
    "2130706433",
    "203.0.113.1:443",
    "[2001:db8::1]",
    "[2001:db8::1]:443",
    "2001:db8:::1",
    "2001:db8::g",
    "fe80::1%eth0",
    "203.0.113.1, 203.0.113.2",
    "203.0.113.1,",
    ",203.0.113.1",
    "203.0.113.1,,",
    "2001:db8::1/64",
    "for=203.0.113.1",
    "203.0.113.1 garbage",
  ])("rejects missing/malformed/multiple values: %s", (value) => {
    expect(normalizeClientIp(value)).toBeNull();
  });

  it("ignores untrusted headers and Host for production identity", () => {
    const request = new Request("https://darakit.com/api/test", {
      headers: {
        host: "localhost:3000",
        "x-forwarded-for": "203.0.113.1, 10.0.0.1",
        "x-real-ip": "203.0.113.2",
        forwarded: "for=203.0.113.3",
        "true-client-ip": "203.0.113.4",
      },
    });
    expect(getClientIp(request)).toBeNull();
    request.headers.set("cf-connecting-ip", "203.0.113.5");
    expect(getClientIp(request)).toBe("203.0.113.5");
  });

  it.each(["development", "test"])("uses one local bucket in %s", (mode) => {
    config.NODE_ENV = mode;
    for (const value of ["203.0.113.1", "garbage", "2001:db8::1"]) {
      const request = new Request("https://darakit.com/api/test", {
        headers: { "cf-connecting-ip": value, "x-forwarded-for": value },
      });
      expect(getClientIp(request)).toBe("127.0.0.1");
      expect(withTrustedClientIp(request).headers.get("cf-connecting-ip")).toBe(
        "127.0.0.1",
      );
    }
  });

  it("removes combined duplicate values before Better Auth", () => {
    const headers = new Headers({ "cf-connecting-ip": "203.0.113.1" });
    headers.append("cf-connecting-ip", "203.0.113.1");
    const request = new Request("https://darakit.com/api/auth/get-session", {
      headers,
    });
    expect(getClientIp(request)).toBeNull();
    expect(withTrustedClientIp(request).headers.has("cf-connecting-ip")).toBe(
      false,
    );
    expect(request.headers.get("cf-connecting-ip")).toContain(",");
  });

  it("preserves method, body, cookies, origin, URL and other headers", async () => {
    const request = new Request(
      "https://darakit.com/api/auth/sign-in/email?test=1",
      {
        method: "POST",
        headers: {
          "cf-connecting-ip": "2001:DB8::1",
          cookie: "fixture=local-test",
          origin: "https://darakit.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({ test: true }),
      },
    );
    const prepared = withTrustedClientIp(request);
    expect(prepared.url).toBe(request.url);
    expect(prepared.method).toBe("POST");
    expect(prepared.headers.get("cookie")).toBe("fixture=local-test");
    expect(prepared.headers.get("origin")).toBe("https://darakit.com");
    expect(prepared.headers.get("content-type")).toBe("application/json");
    expect(await prepared.json()).toEqual({ test: true });
  });
});
