import type { BusinessIntelligence } from "./types";

/**
 * Compact payload given to the model. Every section is labelled with its
 * provenance so the model (and the user reading its answer) can tell
 * measured data from benchmarks from modelled estimates.
 */
export function buildPromptPayload(i: BusinessIntelligence) {
  const m = i.market;
  const d = i.demographics;

  return {
    business: {
      name: i.tenant.name, type: i.tenant.type, county: i.tenant.county,
      city: i.tenant.city, currency: i.tenant.currency,
    },
    window: "last 30 days, compared with the 30 days before",

    YOUR_DATA: {
      provenance: "Measured from this business's own POS records.",
      sales: {
        revenue: i.sales.currentRevenue, revenueChangePct: i.sales.revenueGrowthPercent,
        orders: i.sales.currentOrders, ordersChangePct: i.sales.orderGrowthPercent,
        averageOrder: i.sales.currentAverageOrder,
        grossMarginPct: i.sales.grossMarginPercent,
        marginDataCoveragePct: i.sales.marginCoveragePercent,
      },
      topProducts: i.sales.topProducts.slice(0, 8).map((p) => ({
        name: p.name, category: p.category, unitsSold: p.unitsSold, revenue: p.revenue,
        price: p.price, marginPct: p.marginPercent, stock: p.stock,
        daysOfCover: p.daysOfCover, status: p.status,
      })),
      restockSuggestions: i.restock.slice(0, 8),
      pricingSignals: i.pricing.slice(0, 6),
      inventory: i.inventory,
      customers: {
        registered: i.customers.registeredCustomers, active30d: i.customers.activeCustomers,
        repeatRatePct: i.customers.repeatRate, atRisk: i.customers.atRiskCustomers,
        churnSignals: i.customers.churnedCustomers, retentionScore: i.customers.retentionScore,
        ordersLinkedToCustomerPct: i.dataQuality.linkedOrdersPercent,
      },
    },

    AREA_BENCHMARK: m.available
      ? {
          provenance: `Anonymised aggregate of ${m.qualifiedMerchants} comparable LipaPoint businesses (${m.scopeLabel}), last 90 days. Individual businesses are never identifiable.`,
          scope: m.scope,
          indices: { revenue: m.revenueIndex, orders: m.orderIndex, averageOrder: m.averageOrderIndex, note: "100 = peer median" },
          bestSellersInArea: m.localTopProducts.slice(0, 10).map((p) => ({
            name: p.name, category: p.category, avgUnitsPer30DaysPerPeer: p.estimatedUnits,
            peersSelling: p.merchantsObserved, yourUnits: p.yourUnits, signal: p.signal,
            areaMedianListPrice: p.areaMedianPrice, yourPrice: p.yourPrice, priceDeltaPct: p.priceDeltaPercent,
          })),
          productsBoughtByRegisteredCustomers: m.loyaltyProducts.slice(0, 6),
          categoryDemand: m.categoryDemand.slice(0, 6),
          customerRetention: m.retention.available
            ? { area: { repeatPct: m.retention.areaRepeatRate, active30dPct: m.retention.areaActiveRate, lapsed60dPct: m.retention.areaChurnRate },
                yours: { repeatPct: m.retention.yourRepeatRate, active30dPct: m.retention.yourActiveRate, lapsed60dPct: m.retention.yourChurnRate } }
            : { available: false, reason: m.retention.note },
        }
      : { available: false, reason: m.marketSummary },

    AREA_DEMOGRAPHICS: {
      provenance: `${d.source} (${d.year}). ${d.note}`,
      geography: d.geography, scope: d.scope, population: d.population,
      households: d.households, ageStructure: d.segments.map((s) => ({ segment: s.label, ages: s.ageRange, sharePct: s.share })),
    },

    MODELLED_BUYING_POTENTIAL: {
      provenance: "MODELLED ESTIMATE, not measured behaviour: population mix x typical category affinity, compared with this business's own sales. Present as hypotheses to test.",
      items: d.buyingPotential.slice(0, 8).map((b) => ({
        segment: b.segmentLabel, segmentSharePct: b.segmentShare, category: b.category,
        affinity: b.affinity, yourRevenueSharePct: b.yourRevenueShare, status: b.status,
      })),
    },

    risks: i.risks.slice(0, 5),
    opportunities: i.opportunities.slice(0, 5),
    dataQualityNotes: i.dataQuality.notes,
  };
}