import { FieldDataType } from '@prisma/client';

/**
 * Maps the raw Textract JSON (written to S3 by the OCR Lambda) into the curated,
 * canonical field model persisted in Postgres (ExtractedField + LineItem).
 *
 * The raw JSON stays in S3 as the immutable archive; this mapper materializes only
 * the curated set of header fields and typed line-item columns the editor works with.
 * Two Textract pipelines are supported:
 *   - AnalyzeExpense  -> docs with `summaryFields` + `lineItems` (primary: invoices/receipts)
 *   - AnalyzeDocument -> pages with `keyValuePairs` (fallback: passthrough header fields)
 */

// ---- Raw Textract shapes (as produced by the Lambda parser, mirrored on the FE) ----

interface RawBox {
  Left?: number;
  Top?: number;
  Width?: number;
  Height?: number;
}

interface RawSummaryField {
  type?: string;
  value?: string;
  confidence?: number;
  boundingBox?: RawBox;
  page?: number;
}

interface RawLineItemCell {
  value?: string;
  confidence?: number;
  boundingBox?: RawBox;
}

type RawLineItem = Record<string, RawLineItemCell | undefined>;

interface RawExpenseDoc {
  summaryFields?: RawSummaryField[];
  lineItems?: RawLineItem[];
}

interface RawKeyValue {
  key?: string;
  value?: string;
  confidence?: number;
  boundingBox?: RawBox;
}

interface RawPage {
  page?: number;
  keyValuePairs?: RawKeyValue[];
}

// ---- Normalized (persisted) shapes ----

export interface NormalizedBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface MappedField {
  key: string;
  label: string | null;
  dataType: FieldDataType;
  detectedValue: string | null;
  confidence: number | null;
  page: number;
  boundingBox: NormalizedBox | null;
}

export interface MappedLineItem {
  rowIndex: number;
  description: string | null;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
  tax: number | null;
  productCode: string | null;
  boundingBox: NormalizedBox | null;
  confidence: number | null;
  cells: Record<string, { detectedValue: string | null; confidence: number | null; box: NormalizedBox | null }>;
}

export interface MappedResult {
  fields: MappedField[];
  lineItems: MappedLineItem[];
}

// ---- Canonical field registry ----
// Maps a raw Textract AnalyzeExpense summary-field type to a curated canonical field.
// Anything not listed here is still kept (passthrough) so no detected value is lost,
// but with the raw type as its key and STRING typing.
interface CanonicalDef {
  key: string;
  label: string;
  dataType: FieldDataType;
}

const CANONICAL_FIELDS: Record<string, CanonicalDef> = {
  VENDOR_NAME: { key: 'VENDOR_NAME', label: 'Vendor', dataType: FieldDataType.STRING },
  VENDOR_ADDRESS: { key: 'VENDOR_ADDRESS', label: 'Vendor address', dataType: FieldDataType.STRING },
  RECEIVER_NAME: { key: 'CUSTOMER_NAME', label: 'Customer', dataType: FieldDataType.STRING },
  RECEIVER_ADDRESS: { key: 'CUSTOMER_ADDRESS', label: 'Customer address', dataType: FieldDataType.STRING },
  INVOICE_RECEIPT_ID: { key: 'INVOICE_NUMBER', label: 'Invoice number', dataType: FieldDataType.STRING },
  PO_NUMBER: { key: 'PO_NUMBER', label: 'PO number', dataType: FieldDataType.STRING },
  INVOICE_RECEIPT_DATE: { key: 'INVOICE_DATE', label: 'Invoice date', dataType: FieldDataType.DATE },
  DUE_DATE: { key: 'DUE_DATE', label: 'Due date', dataType: FieldDataType.DATE },
  ORDER_DATE: { key: 'ORDER_DATE', label: 'Order date', dataType: FieldDataType.DATE },
  SUBTOTAL: { key: 'SUBTOTAL', label: 'Subtotal', dataType: FieldDataType.CURRENCY },
  TAX: { key: 'TAX', label: 'Tax', dataType: FieldDataType.CURRENCY },
  DISCOUNT: { key: 'DISCOUNT', label: 'Discount', dataType: FieldDataType.CURRENCY },
  TOTAL: { key: 'TOTAL', label: 'Total', dataType: FieldDataType.CURRENCY },
  AMOUNT_DUE: { key: 'AMOUNT_DUE', label: 'Amount due', dataType: FieldDataType.CURRENCY },
  AMOUNT_PAID: { key: 'AMOUNT_PAID', label: 'Amount paid', dataType: FieldDataType.CURRENCY },
  PAYMENT_TERMS: { key: 'PAYMENT_TERMS', label: 'Payment terms', dataType: FieldDataType.STRING },
};

/** Canonical definition for a header field key, used when creating an edited field
 *  that wasn't originally detected. Falls back to a STRING passthrough. */
export function canonicalFieldDef(key: string): CanonicalDef {
  const byCanonical = Object.values(CANONICAL_FIELDS).find(d => d.key === key);
  if (byCanonical) return byCanonical;
  return { key, label: humanize(key), dataType: FieldDataType.STRING };
}

// ---- Helpers ----

function toBox(b: RawBox | undefined): NormalizedBox | null {
  if (!b || typeof b.Left !== 'number' || typeof b.Top !== 'number') return null;
  return { left: b.Left, top: b.Top, width: b.Width ?? 0, height: b.Height ?? 0 };
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function conf(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Parse a currency/number string like "$1,234.50" or "1.234,50" into a number. */
function parseNumber(v: unknown): number | null {
  const s = str(v);
  if (s === null) return null;
  // Strip everything except digits, separators and sign, then normalize separators.
  let cleaned = s.replace(/[^\d.,-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  if (lastComma > lastDot) {
    // Comma is the decimal separator (e.g. "1.234,50").
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Dot is the decimal separator (e.g. "1,234.50").
    cleaned = cleaned.replace(/,/g, '');
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function humanize(key: string): string {
  return key
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Slug used as the canonical key for free-text AnalyzeDocument keys. */
function keyFromLabel(label: string): string {
  return (
    label
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'FIELD'
  );
}

// ---- Public entry point ----

export function mapTextractResult(parsed: unknown): MappedResult {
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { fields: [], lineItems: [] };
  }
  const first = parsed[0] as Record<string, unknown> | null;
  if (!first || typeof first !== 'object') return { fields: [], lineItems: [] };

  if (Array.isArray((first as RawExpenseDoc).summaryFields)) {
    return mapExpense(parsed as RawExpenseDoc[]);
  }
  if (Array.isArray((first as RawPage).keyValuePairs) || typeof (first as RawPage).page === 'number') {
    return mapDocument(parsed as RawPage[]);
  }
  return { fields: [], lineItems: [] };
}

function mapExpense(docs: RawExpenseDoc[]): MappedResult {
  const fields: MappedField[] = [];
  const seen = new Set<string>();
  const lineItems: MappedLineItem[] = [];
  let rowIndex = 0;

  for (const doc of docs) {
    for (const f of doc.summaryFields ?? []) {
      const rawType = str(f.type);
      if (!rawType) continue;
      const def = CANONICAL_FIELDS[rawType] ?? {
        key: rawType,
        label: humanize(rawType),
        dataType: FieldDataType.STRING,
      };
      // Curated set is one row per canonical key; keep the first (highest-priority) hit.
      if (seen.has(def.key)) continue;
      seen.add(def.key);
      fields.push({
        key: def.key,
        label: def.label,
        dataType: def.dataType,
        detectedValue: str(f.value),
        confidence: conf(f.confidence),
        page: typeof f.page === 'number' ? f.page : 1,
        boundingBox: toBox(f.boundingBox),
      });
    }

    for (const li of doc.lineItems ?? []) {
      lineItems.push(mapLineItem(li, rowIndex++));
    }
  }

  return { fields, lineItems };
}

function mapLineItem(li: RawLineItem, rowIndex: number): MappedLineItem {
  const cells: MappedLineItem['cells'] = {};
  for (const [type, cell] of Object.entries(li)) {
    if (!cell) continue;
    cells[type] = {
      detectedValue: str(cell.value),
      confidence: conf(cell.confidence),
      box: toBox(cell.boundingBox),
    };
  }

  const row = li.EXPENSE_ROW;
  const item = li.ITEM;
  return {
    rowIndex,
    description: str(item?.value),
    quantity: parseNumber(li.QUANTITY?.value),
    unitPrice: parseNumber(li.UNIT_PRICE?.value),
    amount: parseNumber(li.PRICE?.value),
    tax: parseNumber(li.TAX?.value),
    productCode: str(li.PRODUCT_CODE?.value),
    boundingBox: toBox(row?.boundingBox) ?? toBox(item?.boundingBox),
    confidence: conf(row?.confidence) ?? conf(item?.confidence),
    cells,
  };
}

function mapDocument(pages: RawPage[]): MappedResult {
  const fields: MappedField[] = [];
  const seen = new Set<string>();

  for (const pg of pages) {
    const page = typeof pg.page === 'number' ? pg.page : 1;
    for (const kv of pg.keyValuePairs ?? []) {
      const label = str(kv.key);
      if (!label) continue;
      const key = keyFromLabel(label);
      if (seen.has(key)) continue;
      seen.add(key);
      fields.push({
        key,
        label,
        dataType: FieldDataType.STRING,
        detectedValue: str(kv.value),
        confidence: conf(kv.confidence),
        page,
        boundingBox: toBox(kv.boundingBox),
      });
    }
  }

  // AnalyzeDocument does not yield expense line items; tables mapping is a follow-up.
  return { fields, lineItems: [] };
}
