import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import BalanceCards from './components/BalanceCards';
import TransactionList from './components/TransactionList';
import ChatInput from './components/ChatInput';
import { useFinanceState } from './hooks/useFinanceState';

export default function App() {
  const { transactions, totals, goals, execute, deleteTransaction } = useFinanceState();
  const [notice, setNotice] = useState(null);
  const timer = useRef();

  const show = useCallback((n) => {
    setNotice(n);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), 4000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const handleSubmit = (text) => {
    const r = execute(text);
    show(r.ok ? { type: 'ok', text: r.message } : { type: 'error', text: r.error });
    return r;
  };
  const handleDelete = (id) => {
    const r = deleteTransaction(id);
    show(r.ok ? { type: 'ok', text: r.message } : { type: 'error', text: r.error });
  };

  return (
    <div className="min-h-screen bg-mist text-ink">
      <main className="mx-auto max-w-xl space-y-6 px-4 pb-44 pt-8">
        <h1 className="text-2xl font-bold">Sổ chi tiêu</h1>
        <BalanceCards totals={totals} goals={goals} />
        <TransactionList transactions={transactions} onDelete={handleDelete} />
      </main>

      <footer className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-mist via-mist to-transparent px-4 pb-4 pt-8">
        <div className="mx-auto max-w-xl space-y-2">
          {notice && (
            <p role="status" className={`flex items-start gap-2 rounded-xl px-4 py-2.5 text-sm text-white ${notice.type === 'ok' ? 'bg-safe' : 'bg-spend'}`}>
              {notice.type === 'ok' ? <CircleCheck size={18} className="mt-0.5 shrink-0" /> : <CircleAlert size={18} className="mt-0.5 shrink-0" />}
              {notice.text}
            </p>
          )}
          <ChatInput onSubmit={handleSubmit} onNotice={show} goals={goals} />
        </div>
      </footer>
    </div>
  );
}
