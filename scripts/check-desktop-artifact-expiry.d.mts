export declare const WARNING_DAYS: number;
export declare function daysUntilExpiry(expiry: string, today: string): number;
export declare function checkExpiry(
  expiry: string,
  today: string,
): { readonly ok: boolean; readonly remainingDays: number; readonly message: string };
