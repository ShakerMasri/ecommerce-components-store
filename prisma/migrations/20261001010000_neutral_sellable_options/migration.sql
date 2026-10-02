-- Compatibility expansion only. No stock, IDs, activity, carts or snapshots are backfilled here.
BEGIN;
ALTER TABLE "ProductVariant" ADD COLUMN "optionLabel" VARCHAR(160);
ALTER TABLE "ProductVariant" ADD COLUMN "optionKey" VARCHAR(200);
ALTER TABLE "OrderItem" ADD COLUMN "selectedOptionLabel" VARCHAR(160);

-- Neutral options leave legacy keys untouched; the old constraint would reject them.
DROP INDEX "ProductVariant_productId_sizeKey_colorKey_key";
CREATE UNIQUE INDEX "ProductVariant_productId_optionKey_key"
  ON "ProductVariant"("productId", "optionKey");

ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_option_shape"
  CHECK (("optionKey" IS NULL AND "optionLabel" IS NULL)
    OR ("optionKey" IS NOT NULL AND "optionKey" = 'default' AND "optionLabel" IS NULL)
    OR ("optionKey" IS NOT NULL AND "optionKey" LIKE 'named:%' AND length(btrim("optionLabel")) > 0 AND "optionLabel" IS NOT NULL));

-- Serialize option mutations even outside the application. Unmapped active legacy
-- rows count as named inventory, so a default cannot hide or absorb that inventory.
CREATE FUNCTION "guard_sellable_option"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."productId" <> OLD."productId" THEN
      RAISE EXCEPTION 'Option product identity cannot change';
    END IF;
    IF OLD."optionKey" IS NOT NULL AND
       (NEW."optionKey" IS NULL OR (OLD."optionKey" = 'default') <> (NEW."optionKey" = 'default')) THEN
      RAISE EXCEPTION 'Deactivate and use a separate option identity for a different option type';
    END IF;
    IF OLD."optionKey" IS NULL AND NEW."optionKey" = 'default' THEN
      RAISE EXCEPTION 'Unmapped legacy options cannot become defaults';
    END IF;
  END IF;
  PERFORM "id" FROM "Product" WHERE "id" = NEW."productId" FOR NO KEY UPDATE;
  IF NEW."isActive" AND EXISTS (
    SELECT 1 FROM "ProductVariant" v WHERE v."productId" = NEW."productId"
      AND v."id" <> NEW."id" AND v."isActive"
      AND (NEW."optionKey" = 'default' OR v."optionKey" = 'default')
  ) THEN
    RAISE EXCEPTION 'Active default and named options cannot coexist';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ProductVariant_guard_sellable_option"
  BEFORE INSERT OR UPDATE OF "optionKey", "optionLabel", "isActive", "productId"
  ON "ProductVariant" FOR EACH ROW EXECUTE FUNCTION "guard_sellable_option"();
COMMIT;
