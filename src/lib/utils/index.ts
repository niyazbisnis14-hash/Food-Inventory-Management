import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format angka menjadi mata uang Rupiah (IDR) sesuai standar Indonesia.
 */
export function formatRupiah(amount: number | string | null | undefined): string {
  const numericValue = Number(amount ?? 0);
  if (Number.isNaN(numericValue)) return 'Rp 0';

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numericValue);
}

/**
 * Format kuantitas stok dengan pemisah ribuan Indonesia (maksimal 2 desimal jika ada).
 */
export function formatQuantity(
  quantity: number | string | null | undefined,
  unitCode?: string
): string {
  const numericValue = Number(quantity ?? 0);
  if (Number.isNaN(numericValue)) return unitCode ? `0 ${unitCode}` : '0';

  const formatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericValue);

  return unitCode ? `${formatted} ${unitCode}` : formatted;
}

/**
 * Format tanggal dan waktu ke zona waktu Asia/Jakarta (WIB).
 */
export function formatDateTimeWIB(
  dateInput: string | Date | null | undefined,
  includeTime = true
): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(includeTime
      ? {
          hour: '2-digit',
          minute: '2-digit',
        }
      : {}),
  }).format(date);
}
