import { describe, expect, it } from "vitest";
import { PHONE_INPUT_MAX_LENGTH, phoneSchema } from "./phone";

describe("checkout mobile numbering policy", () => {
  it("bounds raw formatting before normalization", () => {
    const input = "00970 (59) 912 - 3456";
    expect(phoneSchema.parse(input)).toBe("+970599123456");
    const atLimit = input.padEnd(PHONE_INPUT_MAX_LENGTH, " ");
    expect(phoneSchema.parse(atLimit)).toBe("+970599123456");
    expect(phoneSchema.safeParse(`${atLimit} `).success).toBe(false);
  });

  it.each([
    ["0599123456", "0599123456"],
    ["0568123456", "0568123456"],
    ["0502345678", "0502345678"],
    ["0516123456", "0516123456"],
    ["0554491234", "0554491234"],
    ["0583123456", "0583123456"],
    [" +970 (59) 912-3456 ", "+970599123456"],
    ["00970 (56) 812-3456", "+970568123456"],
    ["+972 (52) 234-5678", "+972522345678"],
    ["00972 (54) 234-5678", "+972542345678"],
    ["(059) 912-3456", "0599123456"],
    ["+972599123456", "+972599123456"],
    ["+972568123456", "+972568123456"],
    ["+972555701234", "+972555701234"],
    ["+972557601234", "+972557601234"],
  ])("normalizes %s to %s without guessing a country", (input, output) => {
    expect(phoneSchema.parse(input)).toBe(output);
    expect(phoneSchema.parse(output)).toBe(output);
  });

  it.each([
    undefined,
    null,
    599123456,
    "",
    "   ",
    "----------",
    "\\----------",
    "1---------",
    "+---------",
    "() - ()",
    "059912345",
    "05991234567",
    "+97059912345",
    "+9705991234567",
    "599123456",
    "970599123456",
    "+9700599123456",
    "009720502345678",
    "+971502345678",
    "00962599123456",
    "+970502345678",
    "+97022912345",
    "+97222912345",
    "0572345678",
    "0513123456",
    "0550001234",
    "0554461234",
    "0555731234",
    "0582123456",
    "0501234567",
    "0540123456",
    "0551612345",
    "+972591234567",
    "+970591234567",
    "0591234567",
    "0599abc123456",
    "++970599123456",
    "00+970599123456",
    "0599+123456",
    "-+970599123456",
    "(+970)599123456",
    "0599/123456",
    "0599.123456",
    "0599_123456",
    "0599\n123456",
    "0599123456\n",
    "0599\t123456",
    "0599\u00a0123456",
    "\u200f0599123456",
    "٠٥٩٩١٢٣٤٥٦",
    "0599123456 ext 1",
  ])("rejects unsupported or malformed input %s", (input) => {
    expect(phoneSchema.safeParse(input).success).toBe(false);
  });
});

// Independent table from the R4 Ministry allocation evidence: three digits
// after 055, followed by four subscriber digits. Includes narrow 10k blocks.
describe("055 allocation boundaries", () => {
  it.each([
    [200, 339],
    [400, 404],
    [410, 410],
    [430, 445],
    [449, 461],
    [465, 469],
    [500, 529],
    [550, 572],
    [578, 579],
    [660, 689],
    [700, 729],
    [760, 760],
    [770, 779],
    [800, 802],
    [860, 862],
    [870, 899],
    [910, 999],
  ])("accepts both ends of allocated block %i–%i", (first, last) => {
    for (const suffix of [`${first}0000`, `${last}9999`]) {
      expect(phoneSchema.parse(`055${suffix}`)).toBe(`055${suffix}`);
      expect(phoneSchema.parse(`+97255${suffix}`)).toBe(`+97255${suffix}`);
    }
  });

  it.each([
    0, 159, 160, 199, 340, 399, 405, 409, 411, 429, 446, 448, 462, 464, 470,
    499, 530, 549, 573, 577, 580, 659, 690, 699, 730, 759, 761, 769, 780, 799,
    803, 859, 863, 869, 900, 909,
  ])("rejects unallocated/M2M block %i", (block) => {
    for (const subscriber of ["0000", "9999"]) {
      const suffix = `${String(block).padStart(3, "0")}${subscriber}`;
      expect(phoneSchema.safeParse(`055${suffix}`).success).toBe(false);
      expect(phoneSchema.safeParse(`+97255${suffix}`).success).toBe(false);
    }
  });
});
