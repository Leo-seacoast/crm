import { describe, expect, it } from "vitest";
import { csvCell, csvFilename, csvHeader, csvLine, csvRow } from "./csv";

describe("csvCell", () => {
  it("leaves simple values alone", () => {
    expect(csvCell("Jane")).toBe("Jane");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(true)).toBe("true");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes values with commas, quotes and line breaks", () => {
    expect(csvCell("Smith, Jane")).toBe('"Smith, Jane"');
    expect(csvCell('Say "hi"')).toBe('"Say ""hi"""');
    expect(csvCell("line 1\nline 2")).toBe('"line 1\nline 2"');
    expect(csvCell(" padded ")).toBe('" padded "');
  });

  it("joins lists with semicolons and writes objects as JSON", () => {
    expect(csvCell(["lead", "owner"])).toBe("lead; owner");
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
  });

  it("neutralises anything that a spreadsheet could run as a formula", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\",\"x\")")).toBe('"\'=HYPERLINK(""http://evil"",""x"")"');
    expect(csvCell("+SUM(A1)")).toBe("'+SUM(A1)");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("\t=1")).toBe("'\t=1");
  });

  it("does not mangle phone numbers or plain numbers", () => {
    expect(csvCell("+16035550123")).toBe("+16035550123");
    expect(csvCell("-5")).toBe("-5");
    expect(csvCell("12500.50")).toBe("12500.50");
  });

  it("keeps accented characters as they are", () => {
    expect(csvCell("José Ñúñez")).toBe("José Ñúñez");
  });
});

describe("rows and files", () => {
  it("writes a header and rows with Windows line endings", () => {
    const cols = [
      { header: "Name", value: (r: { n: string }) => r.n },
      { header: "Note", value: () => "a,b" },
    ];
    expect(csvHeader(cols)).toBe("Name,Note\r\n");
    expect(csvLine(cols, { n: "Jane" })).toBe('Jane,"a,b"\r\n');
    expect(csvRow([])).toBe("\r\n");
  });

  it("names files with the date", () => {
    expect(csvFilename("contacts", new Date("2026-11-16T10:00:00Z"))).toBe("contacts-2026-11-16.csv");
  });
});
