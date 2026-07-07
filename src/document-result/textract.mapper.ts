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
  groupTypes?: string[]; // Textract GroupProperties: e.g. ["VENDOR"] | ["RECEIVER"]
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
  numericValue: number | null; // parsed number for CURRENCY/NUMBER fields, else null
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
  taxRate: number | null; // per-line VAT/tax rate as a percent (e.g. 10 for "10%")
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

// TAX_PAYER_ID is emitted once per party with the same Textract type; the party is only
// distinguishable via GroupProperties (groupTypes), so it's resolved dynamically.
const SUPPLIER_TAX_ID: CanonicalDef = { key: 'SUPPLIER_TAX_ID', label: 'Supplier tax ID', dataType: FieldDataType.STRING };
const CUSTOMER_TAX_ID: CanonicalDef = { key: 'CUSTOMER_TAX_ID', label: 'Customer tax ID', dataType: FieldDataType.STRING };

// Textract has no IBAN field type — it lands in a generic OTHER field. We promote it by
// pattern (2-letter country + 2 check digits + 11–30 alphanumerics).
const IBAN_FIELD: CanonicalDef = { key: 'IBAN', label: 'IBAN', dataType: FieldDataType.STRING };
const IBAN_RE = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

/** Return the normalized (space-stripped) IBAN if the value looks like one, else null. */
function detectIban(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const compact = s.replace(/\s+/g, '').toUpperCase();
  return IBAN_RE.test(compact) ? compact : null;
}

// dataTypes whose values should be parsed into a stored numeric.
const NUMERIC_TYPES = new Set<FieldDataType>([FieldDataType.CURRENCY, FieldDataType.NUMBER]);

/**
 * Decide whether a TAX_PAYER_ID belongs to the supplier or the customer.
 * Textract sometimes tags the party via GroupProperties (VENDOR* / RECEIVER*), but often
 * leaves TAX_PAYER_ID ungrouped — so we fall back to horizontal proximity to the detected
 * vendor vs customer name box, then to a left/right-of-center default.
 */
function taxIdParty(
  groupTypes: string[],
  box: NormalizedBox | null,
  vendorBox: NormalizedBox | null,
  customerBox: NormalizedBox | null,
): 'supplier' | 'customer' {
  if (groupTypes.some(t => /RECEIVER/i.test(t))) return 'customer';
  if (groupTypes.some(t => /VENDOR|SUPPLIER/i.test(t))) return 'supplier';
  if (box && vendorBox && customerBox) {
    const dVendor = Math.abs(box.left - vendorBox.left);
    const dCustomer = Math.abs(box.left - customerBox.left);
    return dCustomer < dVendor ? 'customer' : 'supplier';
  }
  if (box) return box.left < 0.5 ? 'supplier' : 'customer';
  return 'supplier';
}

/** Canonical definition for a header field key, used when creating an edited field
 *  that wasn't originally detected. Falls back to a STRING passthrough. */
export function canonicalFieldDef(key: string): CanonicalDef {
  const known = [...Object.values(CANONICAL_FIELDS), SUPPLIER_TAX_ID, CUSTOMER_TAX_ID, IBAN_FIELD];
  const byCanonical = known.find(d => d.key === key);
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

/**
 * Parse a monetary/number string into a number. Shared by header currency fields and
 * line-item columns. Deliberately locale-agnostic: strips currency symbols, spaces
 * (incl. thin/non-breaking used as thousands separators) and other noise, then decides
 * the decimal separator by "whichever of . or , appears last" — which handles both
 * "1,234.50" and "1.234,50". Not a full i18n parser; good enough without locale data.
 */
export function parseAmount(v: unknown): number | null {
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

/** Parse a percentage cell like "10%" or "7,5 %" into its numeric rate (10, 7.5). */
function parsePercent(v: unknown): number | null {
  const s = str(v);
  if (s === null || !s.includes('%')) return null;
  return parseAmount(s.replace('%', ''));
}

/** Collapse newlines/runs of whitespace to single spaces (for one-line fields). */
function normalizeInline(v: string | null): string | null {
  if (v === null) return null;
  const out = v.replace(/\s+/g, ' ').trim();
  return out.length > 0 ? out : null;
}

/** Drop a leading name line from an address when it duplicates the entity name — Textract
 *  returns the whole postal block (name included) as the address. Also handles a labelled
 *  first line like "Name: Acme Inc" where the value equals the entity name. */
function stripLeadingName(address: string | null, name: string | null): string | null {
  if (!address || !name) return address;
  const lines = address.split(/\r?\n/);
  if (lines.length < 2) return address;
  // Strip an optional leading "Label: " (e.g. "Name:") before comparing to the name.
  const firstLine = lines[0].trim().replace(/^[A-Za-z][A-Za-z ]{0,20}:\s*/, '');
  if (firstLine === name.trim()) {
    return lines.slice(1).join('\n').trim() || address;
  }
  return address;
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

interface TaxIdCandidate {
  detectedValue: string | null;
  confidence: number | null;
  page: number;
  boundingBox: NormalizedBox | null;
  groupTypes: string[];
}

function mapExpense(docs: RawExpenseDoc[]): MappedResult {
  const fields: MappedField[] = [];
  const seen = new Set<string>();
  const lineItems: MappedLineItem[] = [];
  const taxIds: TaxIdCandidate[] = [];
  let rowIndex = 0;

  for (const doc of docs) {
    for (const f of doc.summaryFields ?? []) {
      const rawType = str(f.type);
      if (!rawType) continue;

      // TAX_PAYER_ID repeats per party but often isn't grouped — collect and resolve after
      // the vendor/customer anchors are known.
      if (rawType === 'TAX_PAYER_ID') {
        taxIds.push({
          detectedValue: str(f.value),
          confidence: conf(f.confidence),
          page: typeof f.page === 'number' ? f.page : 1,
          boundingBox: toBox(f.boundingBox),
          groupTypes: f.groupTypes ?? [],
        });
        continue;
      }

      // Curated model: keep only canonical fields. Everything else (granular address
      // parts, OTHER, etc.) stays in the raw S3 JSON but isn't materialized here — except
      // an IBAN, which Textract only exposes as a generic OTHER field.
      const def = CANONICAL_FIELDS[rawType];
      if (!def) {
        const iban = detectIban(f.value);
        if (iban && !seen.has(IBAN_FIELD.key)) {
          seen.add(IBAN_FIELD.key);
          fields.push({
            key: IBAN_FIELD.key,
            label: IBAN_FIELD.label,
            dataType: IBAN_FIELD.dataType,
            detectedValue: iban,
            numericValue: null,
            confidence: conf(f.confidence),
            page: typeof f.page === 'number' ? f.page : 1,
            boundingBox: toBox(f.boundingBox),
          });
        }
        continue;
      }
      // One row per canonical key; keep the first (highest-priority) hit.
      if (seen.has(def.key)) continue;
      seen.add(def.key);
      const detectedValue = str(f.value);
      fields.push({
        key: def.key,
        label: def.label,
        dataType: def.dataType,
        detectedValue,
        numericValue: NUMERIC_TYPES.has(def.dataType) ? parseAmount(detectedValue) : null,
        confidence: conf(f.confidence),
        page: typeof f.page === 'number' ? f.page : 1,
        boundingBox: toBox(f.boundingBox),
      });
    }

    for (const li of doc.lineItems ?? []) {
      lineItems.push(mapLineItem(li, rowIndex++));
    }
  }

  const byKey = (k: string) => fields.find(f => f.key === k);

  // Textract returns the full postal block (name line included) as the address. Since we
  // capture the name separately, strip it so the address field isn't "Name\nStreet...".
  for (const [addrKey, nameKey] of [
    ['VENDOR_ADDRESS', 'VENDOR_NAME'],
    ['CUSTOMER_ADDRESS', 'CUSTOMER_NAME'],
  ] as const) {
    const addr = byKey(addrKey);
    const name = byKey(nameKey);
    if (addr) addr.detectedValue = stripLeadingName(addr.detectedValue, name?.detectedValue ?? null);
  }

  // Assign each Tax ID to supplier/customer (one per party, first/highest-priority wins).
  const vendorBox = byKey('VENDOR_NAME')?.boundingBox ?? null;
  const customerBox = byKey('CUSTOMER_NAME')?.boundingBox ?? null;
  for (const t of taxIds) {
    const party = taxIdParty(t.groupTypes, t.boundingBox, vendorBox, customerBox);
    const def = party === 'customer' ? CUSTOMER_TAX_ID : SUPPLIER_TAX_ID;
    if (seen.has(def.key)) continue;
    seen.add(def.key);
    fields.push({
      key: def.key,
      label: def.label,
      dataType: def.dataType,
      detectedValue: t.detectedValue,
      numericValue: null,
      confidence: t.confidence,
      page: t.page,
      boundingBox: t.boundingBox,
    });
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

  // A per-line VAT/tax rate often lands in an untyped cell (e.g. OTHER = "10%"). Take the
  // first percentage-looking cell as the rate; the raw cell is preserved in `cells`.
  let taxRate: number | null = null;
  for (const cell of Object.values(li)) {
    const r = parsePercent(cell?.value);
    if (r !== null) {
      taxRate = r;
      break;
    }
  }

  return {
    rowIndex,
    // Item descriptions wrap across physical lines; Textract keeps the newlines. Collapse
    // them to spaces for a clean one-line value (raw text stays in cells.ITEM).
    description: normalizeInline(str(item?.value)),
    quantity: parseAmount(li.QUANTITY?.value),
    unitPrice: parseAmount(li.UNIT_PRICE?.value),
    amount: parseAmount(li.PRICE?.value),
    tax: parseAmount(li.TAX?.value),
    taxRate,
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
        numericValue: null,
        confidence: conf(kv.confidence),
        page,
        boundingBox: toBox(kv.boundingBox),
      });
    }
  }

  // AnalyzeDocument does not yield expense line items; tables mapping is a follow-up.
  return { fields, lineItems: [] };
}
