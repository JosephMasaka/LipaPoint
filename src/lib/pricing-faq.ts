/**
 * The pricing FAQ, kept in one module so the rendered answers and the
 * `FAQPage` structured data can never disagree — Google drops FAQ rich
 * results when a marked-up question is not visible on the page.
 */
export const PRICING_FAQ: { question: string; answer: string }[] = [
  {
    question: "Can I buy just one app?",
    answer:
      "Yes. Every app stands alone — a shop can run Point of Sale and Inventory with no accounting, and a services business can run Finance and Payroll with no POS at all.",
  },
  {
    question: "Can I buy just part of an app?",
    answer:
      "Yes — by module, not by feature. Each module is sold as one bundle (the Point of Sale module includes barcode scanning, discounts and multi-till at a single price), so nothing is split out for separate billing. For one capability on its own, contact sales.",
  },
  {
    question: "What is always included?",
    answer:
      "The core of every app is free with the app itself: the Till, Stock Tracking, Employee Records, General Ledger, Suppliers, Asset Register and Customer Records. Offline Mode is free on every plan.",
  },
  {
    question: "Is M-Pesa included, or do I pay Safaricom separately?",
    answer:
      "Recording M-Pesa payments at the till is included on every plan — staff enter the confirmation code and the sale is reconciled. Automatic STK Push prompts need a payment provider (PalPluss or Safaricom Daraja), and those transaction fees are charged by the provider, not by LipaPoint.",
  },
  {
    question: "Is LipaPoint KRA eTIMS compliant?",
    answer:
      "Yes. The eTIMS module submits sales, credit notes and debit notes to KRA through an OSCU or VSCU device, stores the KRA invoice number and QR code, and lets you retry anything that was rejected or unreachable.",
  },
  {
    question: "Does it work when the internet goes down?",
    answer:
      "Yes. Offline Mode is free on every plan: the till keeps taking sales and queues them, then syncs to the cloud when the connection returns.",
  },
  {
    question: "How long does setup take?",
    answer:
      "Most businesses are selling the same day. Create the workspace, import products and staff, and the till is ready — there is no setup fee and no implementation project to buy.",
  },
  {
    question: "Can I cancel or change plans later?",
    answer:
      "Yes. Plans are billed monthly and can be upgraded, downgraded or cancelled at any time from Settings > Billing. There is no lock-in contract and no setup fee.",
  },
];
