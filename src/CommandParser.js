import { matchCategory } from '../constants/categories';
import { normalizeKey } from './format';

export const COMMANDS = { chi: 'expense', thu: 'income', save: 'saving' };

const UNITS = { k: 1e3, nghin: 1e3, ngan: 1e3, tr: 1e6, trieu: 1e6, m: 1e6, ty: 1e9 };

/**
 * "50000" | "50.000" | "50k" | "1,5tr" | "2 triệu" -> số nguyên (VND), hoặc null.
 * - Không có đơn vị: dấu . , là phân cách hàng nghìn ("50.000" = 50000, "500" = 500)
 * - Có đơn vị: dấu . , là phân cách thập phân ("1,5tr" = 1.500.000)
 */
export function parseAmount(raw) {
  const m = String(raw).trim().toLowerCase().match(/^(\d[\d.,]*)\s*([^\d\s.,]*)$/);
  if (!m) return null;
  const [, num, unitRaw] = m;
  let value;
  if (unitRaw) {
    const mult = UNITS[normalizeKey(unitRaw)];
    if (!mult) return null;
    value = parseFloat(num.replace(',', '.')) * mult;
  } else {
    value = Number(num.replace(/[.,]/g, ''));
  }
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

// /Lệnh  [Tên có thể chứa khoảng trắng]  [Số tiền (+ đơn vị tuỳ chọn)]
const COMMAND_RE = /^\/(chi|thu|save)\s+(.+?)\s+(\d[\d.,]*\s*[^\d\s.,]*)$/i;

const cap = (s) => s[0].toUpperCase() + s.slice(1);

/**
 * @returns {{ok:true,type,name,label,category,amount}|{ok:false,error}}
 *  type: 'expense' | 'income' | 'saving'
 */
export function parseCommand(input) {
  const text = String(input).trim();
  if (!text.startsWith('/')) return { ok: false, error: 'Lệnh phải bắt đầu bằng /Chi, /Thu hoặc /Save.' };

  const m = text.match(COMMAND_RE);
  if (!m) {
    const head = text.match(/^\/(\S*)/)[1].toLowerCase();
    return COMMANDS[head]
      ? { ok: false, error: `Thiếu thông tin. Cú pháp: /${cap(head)} [Tên] [Số tiền], ví dụ /${cap(head)} Ăn_trưa 50000` }
      : { ok: false, error: `Không có lệnh "/${head}". Dùng /Chi, /Thu hoặc /Save.` };
  }

  const type = COMMANDS[m[1].toLowerCase()];
  const name = m[2].trim();
  const amount = parseAmount(m[3]);
  if (!amount) return { ok: false, error: `Số tiền "${m[3].trim()}" không hợp lệ.` };

  return {
    ok: true,
    type,
    name,
    label: name.replace(/_/g, ' '),
    category: type === 'expense' ? matchCategory(name)?.key ?? 'Other' : null,
    amount,
  };
}