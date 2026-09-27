import { describe, expect, it } from "vitest";
import { createOrderSchema, customerOrdersQuerySchema } from "./order";

const baseOrderInput = {
  phone: "+970599000000",
  idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
  deliveryAreaKey: "west_bank_cities",
  deliveryCity: "Ramallah",
  deliveryAddress: "Main street, building 12",
};

describe("order validations", () => {
  it("accepts a valid delivery order request", () => {
    const result = createOrderSchema.safeParse(baseOrderInput);

    expect(result.success).toBe(true);
  });

  it("rejects invalid idempotency key", () => {
    const result = createOrderSchema.safeParse({
      ...baseOrderInput,
      idempotencyKey: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown delivery area", () => {
    const result = createOrderSchema.safeParse({
      ...baseOrderInput,
      deliveryAreaKey: "unknown-area",
    });

    expect(result.success).toBe(false);
  });

  it("rejects client-supplied delivery prices", () => {
    const result = createOrderSchema.safeParse({
      ...baseOrderInput,
      deliveryPrice: 0,
    });

    expect(result.success).toBe(false);
  });

  it("requires a delivery address for paid delivery areas", () => {
    const result = createOrderSchema.safeParse({
      ...baseOrderInput,
      deliveryAddress: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts the free Nablus receive point when customer agreement is accepted", () => {
    const result = createOrderSchema.safeParse({
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      deliveryAreaKey: "nablus_receive_point",
      deliveryCity: "Nablus",
      phone: "+970599000000",
      deliveryAddress: "",
      pickupAgreementAccepted: true,
    });

    expect(result.success).toBe(true);
  });

  it("rejects the free Nablus receive point without customer agreement", () => {
    const result = createOrderSchema.safeParse({
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      deliveryAreaKey: "nablus_receive_point",
      deliveryCity: "Nablus",
      phone: "+970599000000",
      deliveryAddress: "",
      pickupAgreementAccepted: false,
    });

    expect(result.success).toBe(false);
  });
});

describe("customer order query validations", () => {
  it("defaults to the first page with a safe page size", () => {
    const result = customerOrdersQuerySchema.safeParse({});

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toEqual({ page: 1, limit: 20 });
    }
  });

  it("accepts numeric query strings within the allowed range", () => {
    const result = customerOrdersQuerySchema.safeParse({
      page: "2",
      limit: "10",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toEqual({ page: 2, limit: 10 });
    }
  });

  it("rejects invalid pagination values", () => {
    const result = customerOrdersQuerySchema.safeParse({
      page: "0",
      limit: "100",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unexpected query parameters", () => {
    const result = customerOrdersQuerySchema.safeParse({
      page: "1",
      limit: "20",
      userId: "another-user",
    });

    expect(result.success).toBe(false);
  });
});
