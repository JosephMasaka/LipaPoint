import { canonicalCounty, normalizeCountyKey } from "@/lib/kenya-counties";
import type { MarketScope } from "./types";

/**
 * AREA DEMOGRAPHICS — 2019 Kenya Population and Housing Census (KNBS).
 *
 * RULE: only put numbers here that you have verified against KNBS
 * (2019 KPHC Volume III: "Distribution of Population by Age, Sex and
 * Administrative Units"). LipaPoint never infers demographics from POS data,
 * and this file must never contain estimated or remembered figures.
 *
 * To add a county: copy its 2019 age-group counts (0-14, 15-64, 65+ and, if
 * available, 15-35) into COUNTY_DEMOGRAPHICS keyed by normalizeCountyKey(name).
 * Counties without an entry fall back to the clearly-labelled national
 * baseline rather than showing invented local data.
 */

export interface AreaDemographicsRecord {
  geography: string;
  year: 2019;
  source: string;
  sourceNote: string;
  population: number;
  households: number | null;
  averageHouseholdSize: number | null;
  age0to14: number;
  age15to64: number;
  age65plus: number;
  /** Only where a verified 15-35 count exists. */
  age15to35: number | null;
}

const SOURCE = "KNBS 2019 Kenya Population and Housing Census";

/** Kenya total, 2019 census. Age bands as tabulated by citypopulation.de from KNBS. */
export const NATIONAL_BASELINE: AreaDemographicsRecord = {
  geography: "Kenya (national)",
  year: 2019,
  source: SOURCE,
  sourceNote:
    "National age bands as republished by citypopulation.de from KNBS; verify against KNBS Volume III before relying on them commercially.",
  population: 47_564_296,
  households: null,
  averageHouseholdSize: null,
  age0to14: 18_541_482,
  age15to64: 27_150_165,
  age65plus: 1_870_443,
  age15to35: null,
};

export const COUNTY_DEMOGRAPHICS: Record<string, AreaDemographicsRecord> = {
  nairobi: {
    geography: "Nairobi County",
    year: 2019,
    source: SOURCE,
    sourceNote:
      "Age bands from KNBS 2019 as republished by citypopulation.de; the 15-35 count and household figures from the Nairobi City County summary of the same census. Verify against KNBS Volume III before relying on them commercially.",
    population: 4_397_073,
    households: 1_506_888,
    averageHouseholdSize: 2.9,
    age0to14: 1_336_249,
    age15to64: 3_002_314,
    age65plus: 58_122,
    age15to35: 2_086_995,
  },
};

export interface ResolvedDemographics {
  record: AreaDemographicsRecord;
  scope: MarketScope; // "county" when county data exists, otherwise "national"
}

export function getAreaDemographics(county: string | null): ResolvedDemographics {
  const canonical = canonicalCounty(county);
  if (canonical) {
    const record = COUNTY_DEMOGRAPHICS[normalizeCountyKey(canonical)];
    if (record) return { record, scope: "county" };
  }
  return { record: NATIONAL_BASELINE, scope: "national" };
}