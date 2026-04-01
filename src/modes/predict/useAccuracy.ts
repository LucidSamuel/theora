import { useCallback, useState } from 'react';
import type { AccuracyRecord, PredictDifficulty } from './types';
import type { DemoId } from '@/types';

const STORAGE_KEY = 'theora:predict:accuracy';

function loadAccuracy(): Record<string, AccuracyRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return {};
}

function saveAccuracy(data: Record<string, AccuracyRecord>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* noop */ }
}

const EMPTY_RECORD: AccuracyRecord = {
  total: 0,
  correct: 0,
  byCategory: {},
  streak: 0,
};

export function useAccuracy(demoId: DemoId) {
  const [allRecords, setAllRecords] = useState(loadAccuracy);

  const record: AccuracyRecord = allRecords[demoId] ?? EMPTY_RECORD;

  const recordAnswer = useCallback((correct: boolean, category: string, _difficulty: PredictDifficulty) => {
    setAllRecords((prev) => {
      const current = prev[demoId] ?? { ...EMPTY_RECORD, byCategory: {} };
      const catStats = current.byCategory[category] ?? { total: 0, correct: 0 };
      const updated: AccuracyRecord = {
        total: current.total + 1,
        correct: current.correct + (correct ? 1 : 0),
        byCategory: {
          ...current.byCategory,
          [category]: {
            total: catStats.total + 1,
            correct: catStats.correct + (correct ? 1 : 0),
          },
        },
        streak: correct
          ? (current.streak > 0 ? current.streak + 1 : 1)
          : (current.streak < 0 ? current.streak - 1 : -1),
      };
      const next = { ...prev, [demoId]: updated };
      saveAccuracy(next);
      return next;
    });
  }, [demoId]);

  const resetAccuracy = useCallback(() => {
    setAllRecords((prev) => {
      const next = { ...prev };
      delete next[demoId];
      saveAccuracy(next);
      return next;
    });
  }, [demoId]);

  const accuracyPct = record.total > 0 ? Math.round((record.correct / record.total) * 100) : null;

  return { record, recordAnswer, resetAccuracy, accuracyPct };
}
