import type { PieceRegistration } from "./types";

const registrations = new Map<string, PieceRegistration>();

export function registerPiece(reg: PieceRegistration): void {
  registrations.set(reg.pieceId, reg);
}

export function getPiece(pieceId: string): PieceRegistration | undefined {
  return registrations.get(pieceId);
}

export function requirePiece(pieceId: string): PieceRegistration {
  const hit = registrations.get(pieceId);
  if (!hit) throw new Error(`gui-lego: unknown piece "${pieceId}"`);
  return hit;
}

export function listPieces(): PieceRegistration[] {
  return [...registrations.values()];
}

export function clearPieceRegistryForTests(): void {
  registrations.clear();
}
