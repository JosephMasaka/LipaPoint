export const KENYA_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa",
  "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi",
  "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos",
  "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a",
  "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu",
  "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans Nzoia", "Turkana",
  "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
] as const;

/** "Nairobi City County" -> "nairobi", "Murang'a" -> "muranga" */
export function normalizeCountyKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(county|city)\b/g, "")
    .replace(/[^a-z]/g, "");
}

/** Returns the canonical county name, or null if the input isn't a recognised county. */
export function canonicalCounty(input: string | null | undefined): string | null {
  if (!input) return null;
  const key = normalizeCountyKey(input);
  if (!key) return null;
  return KENYA_COUNTIES.find((c) => normalizeCountyKey(c) === key) ?? null;
}