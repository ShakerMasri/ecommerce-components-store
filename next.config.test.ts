import { describe, expect, it, vi } from "vitest";

vi.mock("./src/env.js", () => ({}));

import config from "./next.config.js";

describe("image delivery configuration", () => {
  it("disables the unused optimizer globally without remote host permissions", () => {
    expect(config.images).toMatchObject({ unoptimized: true });
    expect(config.images?.remotePatterns ?? []).toEqual([]);
    expect(config.images?.domains ?? []).toEqual([]);
  });
});
