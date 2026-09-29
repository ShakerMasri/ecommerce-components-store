import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OptimizedImage, getOptimizedCloudinarySrc } from "./OptimizedImage";

describe("OptimizedImage", () => {
  it("renders with correct alt text", () => {
    render(<OptimizedImage src="test.jpg" alt="Test image" />);
    expect(screen.getByAltText("Test image")).toBeInTheDocument();
  });

  it("applies className if provided", () => {
    const { container } = render(
      <OptimizedImage src="test.jpg" alt="Test" className="custom-class" />,
    );
    expect(container.querySelector(".custom-class")).toBeInTheDocument();
  });

  it("renders alt text correctly", () => {
    render(<OptimizedImage src="test.jpg" alt="Custom alt text" />);
    expect(screen.getByAltText("Custom alt text")).toBeInTheDocument();
  });

  it("adds safe Cloudinary delivery transformations", () => {
    expect(
      getOptimizedCloudinarySrc(
        "https://res.cloudinary.com/demo/image/upload/v123/products/shirt.jpg",
        220,
      ),
    ).toContain("/upload/f_auto,q_auto,c_limit,w_220/");
  });

  it("does not rewrite non-Cloudinary image URLs", () => {
    const src = "https://example.com/products/shirt.jpg";

    expect(getOptimizedCloudinarySrc(src, 220)).toBe(src);
  });

  it("delivers Cloudinary images directly without the Next optimizer", () => {
    render(
      <OptimizedImage
        src="https://res.cloudinary.com/demo/image/upload/v123/products/board.jpg"
        alt="Component board"
        cloudinaryWidth={640}
        className="object-contain"
      />,
    );

    const image = screen.getByRole("img", { name: "Component board" });
    expect(image).toHaveAttribute(
      "src",
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_640/v123/products/board.jpg",
    );
    expect(image).not.toHaveAttribute("srcset");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveClass("object-contain");
  });
});
