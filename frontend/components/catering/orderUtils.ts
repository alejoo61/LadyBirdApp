// components/catering/orderUtils.ts

export const EVENT_TYPE_COLORS: Record<string, string> = {
  TACO_BAR:     'bg-rose/20 text-rose border-rose/30',
  BIRD_BOX:     'bg-sky/20 text-sky border-sky/30',
  PERSONAL_BOX: 'bg-tumbleweed/30 text-night/70 border-tumbleweed',
  FOODA:        'bg-night/10 text-night border-night/20',
  NEEDS_REVIEW: 'bg-yellow-100 text-yellow-700 border-yellow-300',
};

export const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-500',
  completed: 'bg-sky/20 text-sky',
};

export const PAYMENT_STATUS_STYLES: Record<string, string> = {
  OPEN:   'bg-orange-100 text-orange-600 border border-orange-200',
  PAID:   'bg-emerald-50 text-emerald-600 border border-emerald-200',
  CLOSED: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
};

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago',
  });
}

export function formatPhone(phone: string): string {
  if (!phone) return '—';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10)
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  return phone;
}

export function isToday(dateStr: string): boolean {
  if (!dateStr) return false;
  const d   = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth()    === now.getMonth() &&
    d.getDate()     === now.getDate();
}

export type OrderTabType = 'catering' | 'house_accounts' | 'space_rentals' | 'needs_review';