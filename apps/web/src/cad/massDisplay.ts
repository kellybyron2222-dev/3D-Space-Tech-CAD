export const MATERIALS = [
  { id: "al", name: "Al", densityKgPerMm3: 2.7e-6 },
  { id: "ti", name: "Ti", densityKgPerMm3: 4.5e-6 },
  { id: "steel", name: "Steel", densityKgPerMm3: 7.8e-6 },
] as const;

export type MaterialId = (typeof MATERIALS)[number]["id"];

export function getMaterial(id: MaterialId) {
  return MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];
}

export function massKgFromVolume(
  volumeMm3: number,
  densityKgPerMm3: number,
): number {
  return volumeMm3 * densityKgPerMm3;
}
