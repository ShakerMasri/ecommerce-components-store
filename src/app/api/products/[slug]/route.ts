import { NextResponse } from "next/server";
import { readPublicProduct } from "~/server/public-products";
import { rateLimit } from "~/lib/rate-limit";
import { productSlugSchema } from "~/server/validations/product";

type ProductRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(request: Request, { params }: ProductRouteProps) {
  const limited = await rateLimit(request, "publicRead");

  if (!limited.ok) {
    return limited.response;
  }

  const { slug } = await params;

  const parsed = productSlugSchema.safeParse({ slug });

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid product slug." },
      { status: 400 },
    );
  }

  try {
    const product = await readPublicProduct(parsed.data.slug);

    if (!product) {
      return NextResponse.json(
        { message: "Product not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ product });
  } catch {
    return NextResponse.json(
      { message: "Failed to load product." },
      { status: 500 },
    );
  }
}
