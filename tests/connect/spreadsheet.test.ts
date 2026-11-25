import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseCsv, parseXlsx, readZip } from "../../src/lib/connect/connectors/file";

test("parses quoted CSV fields, embedded commas and escaped quotes", () => {
  const csv = [
    "sku,name,price",
    'A-1,"Widget, large",1200',
    'A-2,"He said ""hi""",300',
  ].join("\n");

  const rows = parseCsv(csv);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { sku: "A-1", name: "Widget, large", price: "1200" });
  assert.deepEqual(rows[1], { sku: "A-2", name: 'He said "hi"', price: "300" });
});

test("ignores a blank trailing line and a UTF-8 BOM", () => {
  const rows = parseCsv("\uFEFFsku,name\nA-1,Widget\n\n");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Widget");
});

test("reads a real .xlsx workbook (built with the dev-only xlsx writer)", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["sku", "name", "price"],
    ["X-1", "Bolt", 25],
    ["X-2", "Nut", 15],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Products");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const files = readZip(buffer);
  assert.ok(files.has("xl/worksheets/sheet1.xml"));

  const rows = parseXlsx(buffer);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { sku: "X-1", name: "Bolt", price: "25" });
  assert.deepEqual(rows[1], { sku: "X-2", name: "Nut", price: "15" });
});
