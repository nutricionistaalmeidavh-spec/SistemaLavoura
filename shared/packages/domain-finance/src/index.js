const requiredText = (value, label) => {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} is required.`);
  return value.trim();
};

const validAmount = (value, label = 'Amount') => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${label} must be a positive integer in minor units.`);
  return value;
};

export function createFinancialEntry({ id, direction, amountMinor, description, currency = 'BRL', dueDate = null, partyId = null, allocation = null, metadata = {} } = {}) {
  if (!['income', 'expense'].includes(direction)) throw new TypeError('Direction must be income or expense.');
  return Object.freeze({
    id: requiredText(id, 'Financial entry id'),
    direction,
    amountMinor: validAmount(amountMinor),
    currency: requiredText(currency, 'Currency'),
    description: requiredText(description, 'Description'),
    dueDate,
    partyId,
    allocation: allocation ? Object.freeze({ ...allocation }) : null,
    status: 'open',
    settlements: Object.freeze([]),
    metadata: Object.freeze({ ...metadata })
  });
}

export function settleFinancialEntry(entry, { amountMinor, settledAt = new Date().toISOString(), reference = null } = {}) {
  const amount = validAmount(amountMinor, 'Settlement amount');
  const alreadySettled = entry.settlements.reduce((sum, settlement) => sum + settlement.amountMinor, 0);
  const remaining = entry.amountMinor - alreadySettled;
  if (amount > remaining) throw new Error('Settlement cannot exceed remaining entry amount.');
  const settlements = [...entry.settlements, Object.freeze({ amountMinor: amount, settledAt, reference })];
  const total = alreadySettled + amount;
  return Object.freeze({ ...entry, settlements: Object.freeze(settlements), status: total === entry.amountMinor ? 'settled' : 'open' });
}

export function settledAmountMinor(entry) {
  return (entry?.settlements ?? []).reduce((sum, settlement) => sum + settlement.amountMinor, 0);
}

export function outstandingAmountMinor(entry) {
  return Math.max(0, (entry?.amountMinor ?? 0) - settledAmountMinor(entry));
}

export function summarizeFinancialEntries(entries = []) {
  let incomeMinor = 0;
  let expenseMinor = 0;
  let settledIncomeMinor = 0;
  let settledExpenseMinor = 0;
  for (const entry of entries) {
    if (!['income', 'expense'].includes(entry?.direction)) throw new TypeError('Financial entry direction must be income or expense.');
    validAmount(entry.amountMinor);
    const settled = settledAmountMinor(entry);
    if (entry.direction === 'income') { incomeMinor += entry.amountMinor; settledIncomeMinor += settled; }
    else { expenseMinor += entry.amountMinor; settledExpenseMinor += settled; }
  }
  return Object.freeze({ incomeMinor, expenseMinor, marginMinor: incomeMinor - expenseMinor, settledIncomeMinor, settledExpenseMinor, cashMarginMinor: settledIncomeMinor - settledExpenseMinor });
}