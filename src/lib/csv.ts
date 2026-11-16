/**
 * Writes CSV (spreadsheet) files safely.
 *
 * - Values with commas, quotes or line breaks are wrapped in quotes.
 * - "CSV injection" protection: a value that could be run as a spreadsheet
 *   formula (starts with = + - @ or a tab/return) gets a leading apostrophe,
 *   so Excel/Sheets show it as text instead of running it. Plain numbers like
 *   -5 or +16035550123 are left alone (they can't run anything).
 */

/** Byte-order mark: makes Excel open the file as UTF-8 (accents display correctly). */
export const CSV_BOM = "﻿";

const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/;

export function csvCell(value: unknown): string {
  let text: string;
  if (value === null || value === undefined) text = "";
  else if (Array.isArray(value)) text = value.map((v) => String(v ?? "")).join("; ");
  else if (value instanceof Date) text = value.toISOString();
  else if (typeof value === "object") text = JSON.stringify(value);
  else text = String(value);

  if (/^[=+\-@\t\r]/.test(text) && !PLAIN_NUMBER.test(text)) {
    text = `'${text}`;
  }

  if (/[",\r\n]/.test(text) || /^\s|\s$/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",") + "\r\n";
}

export type CsvColumn<T> = { header: string; value: (row: T) => unknown };

export function csvHeader<T>(columns: CsvColumn<T>[]): string {
  return csvRow(columns.map((c) => c.header));
}

export function csvLine<T>(columns: CsvColumn<T>[], row: T): string {
  return csvRow(columns.map((c) => c.value(row)));
}

/** "contacts" -> "contacts-2026-11-16.csv" */
export function csvFilename(name: string, now = new Date()): string {
  return `${name}-${now.toISOString().slice(0, 10)}.csv`;
}
