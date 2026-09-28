import { describe, expect, it } from "vitest";
import { stripImageMetadata, stripJpegMetadata, stripPngMetadata } from "../../../../supabase/functions/_shared/image-meta.ts";

function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
}

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

function jpeg(...segments: number[][]): Uint8Array {
  const scan = [...segment(0xda, [1, 1, 0, 0, 63, 0]), 0x12, 0x34, 0x56, 0xff, 0xd9];
  return new Uint8Array([0xff, 0xd8, ...segments.flat(), ...scan]);
}

function pngChunk(type: string, data: number[]): number[] {
  const len = data.length;
  return [(len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff, ...ascii(type), ...data, 0, 0, 0, 0];
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe("stripJpegMetadata", () => {
  const app0 = segment(0xe0, ascii("JFIF\0"));
  const exif = segment(0xe1, [...ascii("Exif\0\0"), 0x47, 0x50, 0x53]);
  const icc = segment(0xe2, ascii("ICC_PROFILE\0"));
  const comment = segment(0xfe, ascii("Standort: Hannover"));
  const sof = segment(0xc0, [8, 0, 1, 0, 1, 1, 1, 0x11, 0]);

  it("entfernt EXIF und Kommentare, behält JFIF, ICC und Bilddaten", () => {
    const input = jpeg(app0, exif, icc, comment, sof);
    const result = stripJpegMetadata(input);
    expect(result?.changed).toBe(true);
    expect(Array.from(result!.data)).toEqual(Array.from(jpeg(app0, icc, sof)));
  });

  it("lässt ein JPEG ohne Metadaten unverändert", () => {
    const input = jpeg(app0, sof);
    const result = stripJpegMetadata(input);
    expect(result?.changed).toBe(false);
    expect(result?.data).toBe(input);
  });

  it("lehnt Daten ab, die kein JPEG sind", () => {
    expect(stripJpegMetadata(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(stripJpegMetadata(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00]))).toBeNull();
  });
});

describe("stripPngMetadata", () => {
  const ihdr = pngChunk("IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  const text = pngChunk("tEXt", ascii("GPS\0Hannover"));
  const exif = pngChunk("eXIf", [0x4d, 0x4d]);
  const idat = pngChunk("IDAT", [1, 2, 3]);
  const iend = pngChunk("IEND", []);

  it("entfernt Text- und EXIF-Chunks", () => {
    const input = new Uint8Array([...PNG_SIG, ...ihdr, ...text, ...exif, ...idat, ...iend]);
    const result = stripPngMetadata(input);
    expect(result?.changed).toBe(true);
    expect(Array.from(result!.data)).toEqual([...PNG_SIG, ...ihdr, ...idat, ...iend]);
  });

  it("erkennt über stripImageMetadata beide Formate", () => {
    const png = new Uint8Array([...PNG_SIG, ...ihdr, ...idat, ...iend]);
    expect(stripImageMetadata(png)?.changed).toBe(false);
    expect(stripImageMetadata(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull();
  });
});
