export class CashFlowRequiredDataError extends Error {
  constructor(readonly relation: string) {
    super(`Cash Flow database contract unavailable: ${relation}.`);
    this.name = 'CashFlowRequiredDataError';
  }
}
