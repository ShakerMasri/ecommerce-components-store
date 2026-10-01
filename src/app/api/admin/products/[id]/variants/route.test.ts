import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  rateLimit: vi.fn(),
  validateSameOriginRequest: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    product: {
      findUnique: vi.fn(),
    },
    productVariant: {
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("~/lib/admin", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("~/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
}));

vi.mock("~/lib/csrf", () => ({
  validateSameOriginRequest: mocks.validateSameOriginRequest,
}));

vi.mock("~/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("~/lib/logger", () => ({
  getReferenceMessage: (message: string, errorId: string) =>
    `${message} Reference: ${errorId}`,
  logError: vi.fn(() => "err_test"),
}));

import { GET, POST } from "./route";

const productId = "clh1q2w3e000008l4a5b6c7d8";
const variantId = "clh1q2w3e000108l4a5b6c7d9";

const routeParams = {
  params: Promise.resolve({ id: productId }),
};

function createGetRequest() {
  return new Request(
    `http://localhost:3000/api/admin/products/${productId}/variants`,
  );
}

function createPostRequest(body: unknown) {
  return new Request(
    `http://localhost:3000/api/admin/products/${productId}/variants`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify(body),
    },
  );
}

function createVariant(overrides: Record<string, unknown> = {}) {
  return {
    id: variantId,
    productId,
    sizeLabel: "M",
    colorLabel: "Black",
    optionKey: "named:m / black",
    optionLabel: "M / Black",
    stock: 5,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

describe("admin product variants collection route", () => {
  it("deactivates explicitly selected owned options and creates the new choice within one transaction", async () => {
    const oldId = "clh1q2w3e000208l4a5b6c7e0";
    mocks.prisma.productVariant.findMany.mockResolvedValue([
      { id: oldId, optionKey: "default", isActive: true },
    ]);
    mocks.prisma.productVariant.create.mockResolvedValue(
      createVariant({ optionLabel: "Pins", optionKey: "named:pins" }),
    );
    const response = await POST(
      createPostRequest({
        optionLabel: "Pins",
        stock: 3,
        deactivateOptionIds: [oldId],
      }),
      routeParams,
    );
    expect(response.status).toBe(201);
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.productVariant.updateMany).toHaveBeenCalledWith({
      where: { productId, id: { in: [oldId] } },
      data: { isActive: false },
    });
    expect(
      mocks.prisma.productVariant.updateMany.mock.invocationCallOrder[0]!,
    ).toBeLessThan(
      mocks.prisma.productVariant.create.mock.invocationCallOrder[0]!,
    );
  });
  it("rejects foreign or stale transition IDs before writing inventory", async () => {
    const response = await POST(
      createPostRequest({
        optionLabel: "Pins",
        stock: 3,
        deactivateOptionIds: ["clh1q2w3e000208l4a5b6c7e0"],
      }),
      routeParams,
    );
    expect(response.status).toBe(400);
    expect(mocks.prisma.productVariant.updateMany).not.toHaveBeenCalled();
    expect(mocks.prisma.productVariant.create).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: {
        id: "admin-1",
        role: "ADMIN",
      },
    });

    mocks.prisma.$transaction.mockImplementation(
      async (run: (tx: typeof mocks.prisma) => Promise<unknown>) =>
        run(mocks.prisma),
    );
    mocks.prisma.$queryRaw.mockResolvedValue([{ id: productId }]);
    mocks.prisma.productVariant.findMany.mockResolvedValue([]);
    mocks.rateLimit.mockResolvedValue({ ok: true });
    mocks.validateSameOriginRequest.mockReturnValue(null);
    mocks.prisma.product.findUnique.mockResolvedValue({ id: productId });
  });

  it("lists variants for an admin product", async () => {
    mocks.prisma.productVariant.findMany.mockResolvedValue([createVariant()]);

    const response = await GET(createGetRequest(), routeParams);
    const body = (await response.json()) as {
      variants: Array<{ id: string; createdAt: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.variants[0]?.id).toBe(variantId);
    expect(body.variants[0]?.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(mocks.prisma.productVariant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
    );
  });

  it("creates a variant with normalized keys", async () => {
    mocks.prisma.productVariant.create.mockResolvedValue(createVariant());

    const response = await POST(
      createPostRequest({
        optionLabel: " Medium / Black ",
        stock: "5",
        sortOrder: "0",
        isActive: true,
      }),
      routeParams,
    );
    const body = (await response.json()) as {
      variant: { id: string; sizeKey: string; colorKey: string };
    };

    expect(response.status).toBe(201);
    expect(body.variant.id).toBe(variantId);
    expect(mocks.prisma.productVariant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId,
          optionLabel: "Medium / Black",
          optionKey: "named:medium / black",
          stock: 5,
        }),
      }),
    );
  });

  it("rejects duplicate option keys", async () => {
    mocks.prisma.productVariant.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["productId", "sizeKey", "colorKey"] },
      }),
    );

    const response = await POST(
      createPostRequest({
        optionLabel: "M / Black",
        stock: "5",
      }),
      routeParams,
    );
    const body = (await response.json()) as {
      errors: Record<string, string[]>;
    };

    expect(response.status).toBe(400);
    expect(body.errors._form?.[0]).toContain("option key");
  });

  it("hides the route from non-admin users", async () => {
    const notFoundResponse = Response.json(
      {
        message: "Not found.",
      },
      { status: 404 },
    );

    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: notFoundResponse,
    });

    const response = await GET(createGetRequest(), routeParams);
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(404);
    expect(body.message).toBe("Not found.");
    expect(mocks.prisma.productVariant.findMany).not.toHaveBeenCalled();
  });
});
