'use client';

import * as XLSX from 'xlsx';
import { http } from '@/lib/api';

type Primitive = string | number | boolean | null | undefined | Date;

interface WorkbookSheet {
  name: string;
  rows: Record<string, unknown>[];
}

interface AuditInfo {
  modulo: string;
  usuario?: string;
  empresaId?: string;
  filtros?: Record<string, unknown>;
  totalRegistros?: number;
  observaciones?: string;
}

interface ExportWorkbookOptions {
  fileName: string;
  sheets: WorkbookSheet[];
  audit: AuditInfo;
}

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
  };
}

interface ExportEndpointOptions<T> {
  url: string;
  params?: Record<string, unknown>;
  fileName: string;
  sheetName: string;
  audit: AuditInfo;
  mapRow?: (row: T) => Record<string, unknown>;
}

function isPrimitive(value: unknown): value is Primitive {
  return (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date
  );
}

function stringifyValue(value: unknown): Primitive {
  if (value instanceof Date) return value.toISOString();
  if (isPrimitive(value)) return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    if (value.every(isPrimitive)) return value.join(' | ');
    return JSON.stringify(value);
  }
  return JSON.stringify(value);
}

function flattenRow(
  source: Record<string, unknown>,
  prefix = '',
  target: Record<string, Primitive> = {},
) {
  Object.entries(source).forEach(([key, value]) => {
    const flatKey = prefix ? `${prefix}.${key}` : key;

    if (value == null) {
      target[flatKey] = '';
      return;
    }

    if (Array.isArray(value)) {
      target[flatKey] = stringifyValue(value);
      return;
    }

    if (isPrimitive(value)) {
      target[flatKey] = stringifyValue(value);
      return;
    }

    flattenRow(value as Record<string, unknown>, flatKey, target);
  });

  return target;
}

function sanitizeSheetName(name: string) {
  return name.replace(/[\\/*?:[\]]/g, ' ').slice(0, 31) || 'Hoja';
}

function autoColumns(rows: Record<string, Primitive>[]) {
  if (!rows.length) return undefined;
  const headers = Object.keys(rows[0]);
  return headers.map((header) => {
    const maxContent = rows.reduce((max, row) => {
      const value = row[header];
      const length = String(value ?? '').length;
      return Math.max(max, length);
    }, header.length);
    return { wch: Math.min(Math.max(maxContent + 2, 12), 40) };
  });
}

function normalizeRows(rows: Record<string, unknown>[]) {
  if (!rows.length) return [{ mensaje: 'Sin registros para exportar' }];
  return rows.map((row) => flattenRow(row));
}

function buildAuditRows(audit: AuditInfo): Record<string, unknown>[] {
  return [
    { campo: 'Modulo', valor: audit.modulo },
    { campo: 'Generado en', valor: new Date().toISOString() },
    { campo: 'Usuario', valor: audit.usuario || 'No disponible' },
    { campo: 'Empresa', valor: audit.empresaId || 'No disponible' },
    { campo: 'Total registros', valor: audit.totalRegistros ?? '' },
    { campo: 'Filtros', valor: audit.filtros ? JSON.stringify(audit.filtros) : '{}' },
    { campo: 'Observaciones', valor: audit.observaciones || '' },
  ];
}

export function compactParams(params: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) return;
    out[key] = value;
  });
  return out;
}

export function exportWorkbookWithAudit(options: ExportWorkbookOptions) {
  const workbook = XLSX.utils.book_new();

  options.sheets.forEach((sheet) => {
    const rows = normalizeRows(sheet.rows);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = autoColumns(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheet.name));
  });

  const auditRows = buildAuditRows(options.audit);
  const auditSheet = XLSX.utils.json_to_sheet(auditRows);
  auditSheet['!cols'] = autoColumns(auditRows as Record<string, Primitive>[]);
  XLSX.utils.book_append_sheet(workbook, auditSheet, 'Auditoria');

  XLSX.writeFile(workbook, options.fileName);
}

export async function fetchAllPaginated<T>(
  url: string,
  params: Record<string, unknown> = {},
  limit = 500,
) {
  const rows: T[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const { data } = await http.get<PaginatedResponse<T>>(url, {
      params: { ...params, page, limit },
    });
    rows.push(...(data.data ?? []));
    totalPages = data.meta?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return rows;
}

export async function exportEndpointToExcel<T>({
  url,
  params,
  fileName,
  sheetName,
  audit,
  mapRow,
}: ExportEndpointOptions<T>) {
  const rows = await fetchAllPaginated<T>(url, params);
  const exportRows = mapRow ? rows.map(mapRow) : (rows as Record<string, unknown>[]);

  exportWorkbookWithAudit({
    fileName,
    sheets: [{ name: sheetName, rows: exportRows }],
    audit: { ...audit, totalRegistros: rows.length },
  });

  return rows.length;
}

export function buildExcelFileName(modulo: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${modulo}_${stamp}.xlsx`;
}
