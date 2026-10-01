import 'server-only';

export const EXPENSE_RECEIPT_BUCKET = 'expense-receipts';
export const EXPENSE_RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'application/pdf': ['pdf'],
};

export type ValidatedExpenseReceipt =
  | { ok: true; mimeType: string; extension: string }
  | { ok: false; code: string; error: string };

export async function validateExpenseReceipt(file: File): Promise<ValidatedExpenseReceipt> {
  if (file.size < 1 || file.size > EXPENSE_RECEIPT_MAX_BYTES) {
    return { ok: false, code: 'RECEIPT_SIZE_INVALID', error: 'Receipt must be between 1 byte and 5 MB.' };
  }

  const allowedExtensions = MIME_EXTENSIONS[file.type];
  const extension = file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  if (!allowedExtensions || !extension || !allowedExtensions.includes(extension)) {
    return { ok: false, code: 'RECEIPT_TYPE_INVALID', error: 'Receipt must be a JPEG, PNG, WebP, or PDF with a matching extension.' };
  }

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const matchesSignature = file.type === 'image/jpeg'
    ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : file.type === 'image/png'
      ? [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)
      : file.type === 'image/webp'
        ? String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
          String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
        : String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';

  if (!matchesSignature) {
    return { ok: false, code: 'RECEIPT_CONTENT_INVALID', error: 'Receipt contents do not match its file type.' };
  }

  return { ok: true, mimeType: file.type, extension: extension === 'jpeg' ? 'jpg' : extension };
}

export function makeExpenseReceiptPath(branchId: string, businessDate: string, extension: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(businessDate);
  const date = new Date(`${businessDate}T00:00:00Z`);
  if (!match || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== businessDate) {
    throw new Error('BUSINESS_DATE_INVALID: Receipt requires a valid business date.');
  }
  return `${branchId}/${match[1]}/${match[2]}/rec_${businessDate}_${crypto.randomUUID().replace(/-/g, '')}.${extension}`;
}
