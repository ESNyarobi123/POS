/** Persisted open-shift context for POS checkout. */

export const SHIFT_STORAGE_KEY = "gulio_shift_session";

export type PosShiftSession = {
  sessionId: string;
  registerId: string;
  registerName: string;
  branchId: string;
  branchName: string;
  warehouseId: string;
  warehouseName: string;
  openedAt: string;
};

export function loadShiftSession(): PosShiftSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SHIFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PosShiftSession;
  } catch {
    return null;
  }
}

export function saveShiftSession(session: PosShiftSession): void {
  localStorage.setItem(SHIFT_STORAGE_KEY, JSON.stringify(session));
}

export function clearShiftSession(): void {
  localStorage.removeItem(SHIFT_STORAGE_KEY);
}
