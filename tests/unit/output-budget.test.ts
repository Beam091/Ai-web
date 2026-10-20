import { describe, expect, it } from 'vitest';
import { createOutputBudget } from '../../worker/lib/output-budget';

describe('createOutputBudget', () => {
  it('accumulates deltas until the limit is reached', () => {
    const budget = createOutputBudget(10);
    expect(budget.append('1234')).toEqual({ text: '1234', reachedLimit: false });
    expect(budget.append('5678')).toEqual({ text: '5678', reachedLimit: false });
    expect(budget.used).toBe(8);
    expect(budget.append('90')).toEqual({ text: '90', reachedLimit: true });
    expect(budget.used).toBe(10);
  });

  it('trims the delta that crosses the limit', () => {
    const budget = createOutputBudget(5);
    expect(budget.append('hello world')).toEqual({ text: 'hello', reachedLimit: true });
    expect(budget.append('ignored')).toEqual({ text: '', reachedLimit: true });
    expect(budget.used).toBe(5);
  });

  it('stays exhausted after the limit is reached', () => {
    const budget = createOutputBudget(3);
    budget.append('abc');
    expect(budget.append('def')).toEqual({ text: '', reachedLimit: true });
    expect(budget.used).toBe(3);
  });

  it('normalizes invalid and fractional limits', () => {
    expect(createOutputBudget(-5).append('abc')).toEqual({ text: '', reachedLimit: true });
    expect(createOutputBudget(2.9).append('abcd')).toEqual({ text: 'ab', reachedLimit: true });
  });
});
