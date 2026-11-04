import { describe, it, expect } from 'vitest';

export function calculatePlannedMaterial(plannedQty: number, bomQtyPerUnit: number, scrapAllowancePct: number = 0): number {
  const baseReq = plannedQty * bomQtyPerUnit;
  return Number((baseReq * (1 + scrapAllowancePct / 100)).toFixed(4));
}

export function calculateMaterialVariance(actualConsumption: number, plannedConsumption: number): {
  varianceQty: number;
  variancePercentage: number;
} {
  const varianceQty = Number((actualConsumption - plannedConsumption).toFixed(4));
  const variancePercentage = plannedConsumption > 0
    ? Number(((varianceQty / plannedConsumption) * 100).toFixed(2))
    : 0;
  return { varianceQty, variancePercentage };
}

export function calculateActualMaterialCost(actualConsumption: number, unitCost: number): number {
  return Number((actualConsumption * unitCost).toFixed(2));
}

export function calculateCostPerGoodUnit(totalCost: number, goodUnits: number): number | null {
  if (goodUnits <= 0) return null;
  return Number((totalCost / goodUnits).toFixed(2));
}

describe('Manufacturing Cost & Variance Calculations (Prompt Spec Test Cases)', () => {
  it('calculates planned material requirements with 5% allowance for 100 units @ 2 kg', () => {
    const planned = calculatePlannedMaterial(100, 2.0, 5.0);
    expect(planned).toBe(210.0);
  });

  it('calculates actual material cost: 215 kg @ ₹40/kg = ₹8,600', () => {
    const totalCost = calculateActualMaterialCost(215.0, 40.0);
    expect(totalCost).toBe(8600.0);
  });

  it('calculates cost per good unit: ₹8,600 / 100 = ₹86', () => {
    const costPerUnit = calculateCostPerGoodUnit(8600.0, 100);
    expect(costPerUnit).toBe(86.0);
  });

  it('calculates variance: 215 kg - 210 kg = 5 kg and ~2.38%', () => {
    const { varianceQty, variancePercentage } = calculateMaterialVariance(215.0, 210.0);
    expect(varianceQty).toBe(5.0);
    expect(variancePercentage).toBe(2.38);
  });

  it('safely handles zero good units without division by zero', () => {
    const costPerUnit = calculateCostPerGoodUnit(8600.0, 0);
    expect(costPerUnit).toBeNull();
  });
});
