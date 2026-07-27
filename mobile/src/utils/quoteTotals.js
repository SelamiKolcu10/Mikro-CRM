// Mirror of the backend utils/quoteTotals.js formula (kept in sync). Pure,
// DOM-free — same numbers the server will compute, so the form preview matches.
export function computeLine({ quantity = 0, unitPrice = 0, discountRate = 0, taxRate = 0 }) {
  const gross = (Number(quantity) || 0) * (Number(unitPrice) || 0);
  const net = gross * (1 - (Number(discountRate) || 0) / 100);
  const tax = (net * (Number(taxRate) || 0)) / 100;
  return { net, tax, total: net + tax };
}

export function computeTotals(items) {
  let subtotal = 0;
  let totalTax = 0;
  for (const it of items) {
    const { net, tax } = computeLine(it);
    subtotal += net;
    totalTax += tax;
  }
  return { subtotal, totalTax, grandTotal: subtotal + totalTax };
}
