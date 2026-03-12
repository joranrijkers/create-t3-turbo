import OpenAI from "openai";

import { CATEGORY_SLUGS, UNIT_SLUGS } from "@prikkr/db/constants";
import type { CategorySlug, UnitSlug } from "@prikkr/db/constants";

export type ParsedIngredient = {
  canonicalName: string;
  displayName: string;
  categorySlug: string | null;
  quantity: number | null;
  unit: string | null;
  detectedLanguage: string | null;
  canonicalIngredientId?: string | null;
};

/** Backward-compat: same shape, with canonical fields. normalizedName = canonicalName, category = categorySlug */
export type ParsedIngredientLegacy = ParsedIngredient & {
  normalizedName: string;
  brand: string | null;
  category: string | null;
};

const CATEGORY_LIST = [...CATEGORY_SLUGS];
const UNIT_LIST = [...UNIT_SLUGS];

const CATEGORY_SET = new Set<string>(CATEGORY_LIST);
const UNIT_SET = new Set<string>(UNIT_LIST);

function coerceCategory(s: unknown): CategorySlug | null {
  if (typeof s !== "string") return null;
  const slug = s.trim().toLowerCase().replace(/\s+/g, "_");
  return CATEGORY_SET.has(slug) ? (slug as CategorySlug) : null;
}

function coerceUnit(s: unknown): UnitSlug | null {
  if (typeof s !== "string") return null;
  const u = s.trim().toLowerCase();
  return UNIT_SET.has(u) ? (u as UnitSlug) : null;
}

/**
 * Parse full ingredient line (e.g. "200g bloem") into canonical English + quantity/unit.
 * Input may be in any language; canonical_name is always English, lowercase.
 */
export async function parseIngredient(
  inputText: string,
  _hintLocale?: string
): Promise<ParsedIngredient> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const text = inputText.trim();
  if (!text) {
    return {
      canonicalName: "",
      displayName: "",
      categorySlug: null,
      quantity: null,
      unit: null,
      detectedLanguage: null,
    };
  }

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an ingredient parser for a multilingual meal planning app.
Parse recipe ingredient text into structured data. Input may be in ANY language.

Rules:
- canonical_name: ALWAYS English, lowercase, singular (e.g. "bloem" → "flour", "melk" → "milk")
- display_name: The ingredient name in the ORIGINAL input language
- quantity: Numeric amount if present, else null
- unit: Normalize to standard codes: g, kg, ml, l, tsp, tbsp, cup, piece, slice, clove, bunch, pinch, can, package, bottle, crate, or other (e.g. "eetlepel" → "tbsp", "flessen" → "bottle", "kratten" → "crate")
- category: Exactly one of: ${CATEGORY_LIST.join(", ")}
- detected_language: ISO 639-1 code (e.g. en, nl, de)

Return a single JSON object with keys: canonical_name, display_name, quantity, unit, category, detected_language.
If multiple ingredients are combined (e.g. "zout en peper"), return the first one only.`,
      },
      { role: "user", content: text },
    ],
  });

  try {
    const raw = JSON.parse(
      response.choices[0]?.message?.content ?? "{}"
    ) as Record<string, unknown>;

    const canonicalName =
      typeof raw.canonical_name === "string"
        ? raw.canonical_name.trim().toLowerCase()
        : text.toLowerCase();
    const displayName =
      typeof raw.display_name === "string" ? raw.display_name.trim() : text;
    const quantity =
      typeof raw.quantity === "number" && Number.isFinite(raw.quantity)
        ? raw.quantity
        : typeof raw.quantity === "string"
          ? Number.parseFloat(raw.quantity)
          : null;
    const numQuantity =
      quantity !== null && !Number.isNaN(quantity) ? quantity : null;

    return {
      canonicalName: canonicalName || displayName.toLowerCase(),
      displayName: displayName || text,
      categorySlug: coerceCategory(raw.category),
      quantity: numQuantity,
      unit: coerceUnit(raw.unit),
      detectedLanguage:
        typeof raw.detected_language === "string"
          ? raw.detected_language
          : null,
    };
  } catch {
    return {
      canonicalName: text.toLowerCase(),
      displayName: text,
      categorySlug: null,
      quantity: null,
      unit: null,
      detectedLanguage: null,
    };
  }
}

/** Convert to legacy shape for callers that still expect normalizedName/brand/category */
export function toLegacyShape(p: ParsedIngredient): ParsedIngredientLegacy {
  return {
    ...p,
    normalizedName: p.canonicalName,
    brand: null,
    category: p.categorySlug,
  };
}
