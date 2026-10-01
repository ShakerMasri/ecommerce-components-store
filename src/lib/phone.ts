import { z } from "zod";

// Shared raw-input bound, including permitted formatting, before normalization.
export const PHONE_INPUT_MAX_LENGTH = 40;

// Numbering sources and review date: docs/release-plan.md, R4 evidence.
// Nine national digits; local trunk 0 is not part of an international number.
// +970 remains provisional: its independent allocation evidence is unresolved.
// Do not treat the +972 allocation table as proof of these +970 subranges.
const palestinianMobile = /^5(?:6[0-9]|9[2-9])[0-9]{6}$/;
const israeliMobile =
  /^(?:5[0234][2-9][0-9]{6}|51[256][0-9]{6}|58[3-7][0-9]{6}|56[0-9]{7}|59[2-9][0-9]{6})$/;
// Allocated 55 subscriber ranges (excluding M2M), Ministry of Communications.
const mobile55 =
  /^(?:2[0-9]|3[0-3]|40[0-4]|410|43|44[0-59]|45[0-9]|46[015-9]|5[01256]|57[0-289]|6[6-8]|7[0127]|760|80[0-2]|86[0-2]|8[789]|9[1-9])/;

function isIsraeliMobile(value: string) {
  return (
    israeliMobile.test(value) ||
    (/^55[0-9]{7}$/.test(value) && mobile55.test(value.slice(2)))
  );
}

function isSupportedMobile(value: string) {
  if (value.startsWith("+970")) return palestinianMobile.test(value.slice(4));
  if (value.startsWith("+972")) return isIsraeliMobile(value.slice(4));
  if (!value.startsWith("0")) return false;
  const national = value.slice(1);
  return palestinianMobile.test(national) || isIsraeliMobile(national);
}

export const phoneSchema = z
  .string()
  .max(PHONE_INPUT_MAX_LENGTH, "Phone input must be at most 40 characters.")
  // Only explicitly permitted formatting is removed. Controls, letters,
  // Unicode digits and arbitrary punctuation must never become valid digits.
  .regex(
    /^ *\+?[0-9 ()-]+$(?![\s\S])/,
    "Use digits, spaces, hyphens, parentheses and one leading + only.",
  )
  .transform((value) => value.replace(/[ ()-]/g, ""))
  .transform((value) => (value.startsWith("00") ? `+${value.slice(2)}` : value))
  .refine(
    isSupportedMobile,
    "Enter a mobile number: local 05…, +970 or +972 (also 00970/00972). Omit the local 0 after the country code.",
  );
