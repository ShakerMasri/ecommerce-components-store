import { describe, expect, it } from "vitest";
import {
  createCategorySchema,
  createProductSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "./validations";

describe("registerSchema", () => {
  it("accepts valid registration input", () => {
    const result = registerSchema.safeParse({
      name: "Test User",
      email: "TEST@EXAMPLE.COM",
      phone: "+972 59-923-4567",
      password: "password123",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.email).toBe("test@example.com");
      expect(result.data.phone).toBe("+972599234567");
    }
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      name: "Test User",
      email: "not-an-email",
      phone: "+972591234567",
      password: "password123",
    });

    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = registerSchema.safeParse({
      name: "Test User",
      email: "test@example.com",
      phone: "+972591234567",
      password: "123",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid phone characters", () => {
    const result = registerSchema.safeParse({
      name: "Test User",
      email: "test@example.com",
      phone: "abc-phone",
      password: "password123",
    });

    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid login input", () => {
    const result = loginSchema.safeParse({
      email: "USER@EXAMPLE.COM",
      password: "password123",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("accepts valid profile input and normalizes phone", () => {
    const result = updateProfileSchema.safeParse({
      name: "Customer Name",
      phone: "+972 59-923-4567",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.phone).toBe("+972599234567");
    }
  });

  it("rejects invalid phone characters", () => {
    const result = updateProfileSchema.safeParse({
      name: "Customer Name",
      phone: "abc-phone",
    });

    expect(result.success).toBe(false);
  });
});

describe("createCategorySchema", () => {
  it("accepts valid category input", () => {
    const result = createCategorySchema.safeParse({
      name: "Figures",
      slug: "figures",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid category slugs", () => {
    const result = createCategorySchema.safeParse({
      name: "Figures",
      slug: "Bad Slug!",
    });

    expect(result.success).toBe(false);
  });
});

describe("createProductSchema", () => {
  const validProduct = {
    name: "Test Product",
    slug: "test-product",
    description: "A test product",
    price: "99.99",
    discountPrice: "79.99",
    stock: 10,
    images: ["https://res.cloudinary.com/demo/image/upload/test.jpg"],
    isArchived: false,
    isFeatured: false,
    showStock: true,
    categoryId: "category-1",
  };

  it("accepts valid product input", () => {
    const result = createProductSchema.safeParse(validProduct);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.price).toBe(99.99);
      expect(result.data.discountPrice).toBe(79.99);
      expect(result.data.showStock).toBe(true);
    }
  });

  it("accepts products without a discount", () => {
    const result = createProductSchema.safeParse({
      ...validProduct,
      discountPrice: null,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.discountPrice).toBeNull();
    }
  });

  it("rejects discount prices that are not lower than the regular price", () => {
    const result = createProductSchema.safeParse({
      ...validProduct,
      discountPrice: "99.99",
    });

    expect(result.success).toBe(false);
  });

  it("accepts hidden customer stock counts", () => {
    const result = createProductSchema.safeParse({
      ...validProduct,
      showStock: false,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.showStock).toBe(false);
    }
  });

  it("rejects invalid slug", () => {
    const result = createProductSchema.safeParse({
      ...validProduct,
      slug: "Invalid Slug!",
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative stock", () => {
    const result = createProductSchema.safeParse({
      ...validProduct,
      stock: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-Cloudinary image URLs", () => {
    const result = createProductSchema.safeParse({
      ...validProduct,
      images: ["https://example.com/image.jpg"],
    });

    expect(result.success).toBe(false);
  });

  it("rejects prices with more than 2 decimals", () => {
    const result = createProductSchema.safeParse({
      ...validProduct,
      price: "99.999",
    });

    expect(result.success).toBe(false);
  });
});
