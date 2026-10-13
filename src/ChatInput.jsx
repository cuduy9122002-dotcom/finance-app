import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, SendHorizonal } from 'lucide-react';
import { CATEGORIES } from '../constants/categories';
import { normalizeKey } from '../utils/format';
import { parseVoice } from '../utils/voiceParser';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

const COMMAND_ITEMS = [
  { id: 'chi', title: '/Chi', hint: 'Ghi khoản chi tiêu', insert: '/Chi ' },
  { id: 'thu', title: '/Thu', hint: 'Ghi khoản thu nhập', insert: '/Thu ' },
  { id: 'save', title: '/Save', hint: 'Trích tiền vào quỹ tiết kiệm', insert: '/Save ' },
];
const DEFAULT_GOALS = ['Khẩn_cấp', 'Du_lịch', 'Mua_sắm'];

/** Quyết định pop-up hiển thị gì dựa trên chuỗi đang gõ */
function getSuggestions(value, goals) {
  // "/" , "/c" ... -> gợi ý lệnh
  let m = value.match(/^\/(\S*)$/);
  if (m) {
    const q = normalizeKey(m[1]);
    return COMMAND_ITEMS.filter((c) => normalizeKey(c.title.slice(1)).startsWith(q));
  }
  // "/Chi " hoặc "/Chi gro" (token đầu tiên sau lệnh, chưa có dấu cách tiếp theo)
  m = value.match(/^\/(chi|save)\s+(\S*)$/i);
  if (!m) return [];
  const q = normalizeKey(m[2]);

  if (m[1].toLowerCase() === 'chi') {
    return CATEGORIES
      .filter((c) => !q || normalizeKey(c.key).includes(q) || c.aliases.some((a) => a.includes(q)) || normalizeKey(c.hint).includes(q))
      .map((c) => ({ id: c.key, title: c.key, hint: c.hint, icon: c.icon, insert: `/Chi ${c.key} ` }));
  }
  const names = [...goals.map((g) => g.label.replace(/ /g, '_')), ...DEFAULT_GOALS];
  const seen = new Set();
  return names
    .filter((n) => !seen.has(normalizeKey(n)) && seen.add(normalizeKey(n)))
    .filter((n) => !q || normalizeKey(n).includes(q))
    .map((n) => ({ id: n, title: n.replace(/_/g, ' '), hint: 'Quỹ tiết kiệm', insert: `/Save ${n} ` }));
}

export default function ChatInput({ onSubmit, onNotice, goals = [] }) {
  const [value, setValue] = useState('');
  const [active, setActive] = useState(0);
  const [dismissedFor, setDismissedFor] = useState(null);
  const [autoSend, setAutoSend] = useState(false);
  const inputRef = useRef(null);

  const items = useMemo(() => getSuggestions(value, goals), [value, goals]);
  const open = items.length > 0 && dismissedFor !== value;
  useEffect(() => setActive(0), [items.length, value.split(/\s/)[0]]);

  const submit = (text = value) => {
    if (!text.trim()) return;
    const res = onSubmit(text);
    if (res.ok) setValue('');
  };

  const pick = (item) => {
    setValue(item.insert);
    inputRef.current?.focus();
  };

  // ---- Voice ----
  const handleTranscript = (transcript) => {
    const r = parseVoice(transcript);
    if (!r.ok) return onNotice?.({ type: 'error', text: `${r.error} Bạn nói: “${transcript}”` });
    if (autoSend) return submit(r.command);
    setValue(r.command);
    inputRef.current?.focus();
  };
  const { supported, listening, start, stop } = useSpeechRecognition({
    lang: 'vi-VN',
    onResult: handleTranscript,
    onError: (e) => onNotice?.({ type: 'error', text: e === 'not-allowed' ? 'Chưa cấp quyền micro cho trình duyệt.' : `Lỗi nhận giọng nói: ${e}` }),
  });

  const toggleMic = () => {
    if (listening) return stop();
    if (supported) return start();
    // MOCK khi trình duyệt không hỗ trợ Web Speech API
    const t = window.prompt('Trình duyệt chưa hỗ trợ Speech API. Nhập câu nói để thử:', 'Chi năm mươi nghìn tiền ăn trưa');
    if (t) handleTranscript(t);
  };

  const onKeyDown = (e) => {
    if (open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); return setActive((i) => (i + 1) % items.length); }
      if (e.key === 'ArrowUp') { e.preventDefault(); return setActive((i) => (i - 1 + items.length) % items.length); }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); return pick(items[active]); }
      if (e.key === 'Escape') return setDismissedFor(value);
    }
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
  };

  return (
    <div className="relative">
      {open && (
        <ul id="chat-suggestions" role="listbox" className="absolute bottom-full left-0 right-0 mb-2 max-h-64 overflow-y-auto rounded-2xl border border-line bg-card shadow-lg">
          {items.map((it, i) => {
            const Icon = it.icon;
            return (
              <li
                key={it.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); pick(it); }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 ${i === active ? 'bg-ink text-white' : ''}`}
              >
                {Icon && <Icon size={18} aria-hidden />}
                <span className="font-medium">{it.title}</span>
                <span className={`ml-auto text-sm ${i === active ? 'text-white/70' : 'text-ink/55'}`}>{it.hint}</span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-2 rounded-full border border-line bg-card py-1.5 pl-5 pr-1.5 shadow-md focus-within:border-ink">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={listening ? 'Đang nghe… hãy nói' : 'Gõ / để bắt đầu — vd: /Chi Eatout 50000'}
          aria-label="Nhập lệnh"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="chat-suggestions"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-ink/40"
        />
        <label className="hidden cursor-pointer select-none items-center gap-1.5 text-xs text-ink/60 sm:flex">
          <input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} className="accent-[#0F8A6D]" />
          Gửi ngay
        </label>
        <button
          type="button"
          onClick={toggleMic}
          aria-label={listening ? 'Dừng ghi âm' : 'Nhập bằng giọng nói'}
          aria-pressed={listening}
          className={`grid h-11 w-11 place-items-center rounded-full transition ${listening ? 'animate-pulse bg-spend text-white' : 'text-ink hover:bg-ink/10'}`}
        >
          {listening ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button
          type="button"
          onClick={() => submit()}
          disabled={!value.trim()}
          aria-label="Gửi"
          className="grid h-11 w-11 place-items-center rounded-full bg-ink text-white transition enabled:hover:bg-safe disabled:opacity-30"
        >
          <SendHorizonal size={20} />
        </button>
      </div>
    </div>
  );
}
