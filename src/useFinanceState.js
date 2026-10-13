import { useCallback, useMemo, useRef, useState } from 'react';
import { parseCommand } from '../utils/CommandParser';
import { formatVND, normalizeKey } from '../utils/format';

const STORAGE_KEY = 'finance-chat:v1';

const load = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? []; } catch { return []; }
};

/**
 * Nguồn sự thật duy nhất = danh sách giao dịch. Mọi số dư đều được SUY RA từ đó,
 * nên không thể bị lệch nhau:
 *   Thu  : balance +x          -> safe +x
 *   Chi  : balance -x          -> safe -x
 *   Save : balance giữ nguyên, savings +x -> safe -x
 *   safeToSpend = balance - savings
 */
export function computeTotals(transactions) {
  let income = 0, expense = 0, savings = 0;
  for (const t of transactions) {
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
    else if (t.type === 'saving') savings += t.amount;
  }
  const balance = income - expense;
  return { balance, savings, safeToSpend: balance - savings, income, expense };
}

export function useFinanceState() {
  const [transactions, setTransactions] = useState(load); // mới nhất đứng đầu
  const txRef = useRef(transactions); // luôn là bản mới nhất, tránh stale khi gửi liên tiếp

  const commit = useCallback((next) => {
    txRef.current = next;
    setTransactions(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota/private mode */ }
  }, []);

  const totals = useMemo(() => computeTotals(transactions), [transactions]);

  const goals = useMemo(() => {
    const map = new Map();
    for (const t of transactions) {
      if (t.type !== 'saving') continue;
      const k = normalizeKey(t.label);
      const g = map.get(k) ?? { key: k, label: t.label, amount: 0 };
      g.amount += t.amount;
      map.set(k, g);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  /** Nhận chuỗi lệnh, trả về { ok, message } | { ok:false, error } */
  const execute = useCallback((input) => {
    const cmd = parseCommand(input);
    if (!cmd.ok) return cmd;

    const { safeToSpend } = computeTotals(txRef.current);
    if (cmd.type !== 'income' && cmd.amount > safeToSpend) {
      return { ok: false, error: `Không đủ tiền khả dụng: cần ${formatVND(cmd.amount)}, Safe-to-Spend còn ${formatVND(safeToSpend)}.` };
    }

    const tx = {
      id: crypto.randomUUID(),
      type: cmd.type,
      label: cmd.label,
      category: cmd.category,
      amount: cmd.amount,
      createdAt: Date.now(),
    };
    commit([tx, ...txRef.current]);

    const msg = {
      expense: `Đã chi ${formatVND(tx.amount)} cho ${tx.label} (${tx.category})`,
      income: `Đã thu ${formatVND(tx.amount)} từ ${tx.label}`,
      saving: `Đã trích ${formatVND(tx.amount)} vào quỹ ${tx.label}`,
    }[tx.type];
    return { ok: true, message: msg, tx };
  }, [commit]);

  /** Xoá giao dịch, nhưng chặn nếu việc xoá làm Safe-to-Spend âm */
  const deleteTransaction = useCallback((id) => {
    const next = txRef.current.filter((t) => t.id !== id);
    if (computeTotals(next).safeToSpend < 0) {
      return { ok: false, error: 'Không thể xoá: Safe-to-Spend sẽ bị âm. Hãy xoá các khoản chi/tiết kiệm liên quan trước.' };
    }
    commit(next);
    return { ok: true, message: 'Đã xoá giao dịch' };
  }, [commit]);

  return { transactions, totals, goals, execute, deleteTransaction };
}