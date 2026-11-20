/**
 * zipExport.ts — Zero-dependency pure TypeScript ZIP archiver (Store method)
 *
 * Packages PNG/JPEG/MP4/WAV assets into a standard .zip file directly in browser memory
 * without requiring external npm packages or triggering browser multi-download blockers.
 */

export interface ZipFileEntry {
  filename: string;
  dataOrUrl: string;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(date = new Date()): { dosTime: number; dosDate: number } {
  const sec = Math.floor(date.getSeconds() / 2);
  const min = date.getMinutes();
  const hr = date.getHours();
  const day = date.getDate();
  const mon = date.getMonth() + 1;
  const yr = Math.max(0, date.getFullYear() - 1980);
  const dosTime = (hr << 11) | (min << 5) | sec;
  const dosDate = (yr << 9) | (mon << 5) | day;
  return { dosTime, dosDate };
}

async function resolveToBytes(dataOrUrl: string): Promise<Uint8Array> {
  const trimmed = (dataOrUrl || '').trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    (trimmed.startsWith('/') && !trimmed.startsWith('/9j/'))
  ) {
    const res = await fetch(trimmed);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  let rawBase64 = trimmed;
  if (trimmed.startsWith('data:')) {
    rawBase64 = trimmed.split(',')[1] || '';
  }
  rawBase64 = rawBase64.replace(/\s+/g, '');
  while (rawBase64.length % 4 !== 0) {
    rawBase64 += '=';
  }

  const bin = atob(rawBase64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export function sanitizeSkuName(input: string, fallback = 'YODY_STUDIO'): string {
  const cleaned = (input || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

export async function createZipBlob(entries: ZipFileEntry[]): Promise<Blob> {
  const encoder = new TextEncoder();
  const { dosTime, dosDate } = getDosDateTime();

  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.filename);
    const dataBytes = await resolveToBytes(entry.dataOrUrl);
    const checksum = crc32(dataBytes);
    const size = dataBytes.length;

    // Local File Header (30 + filename length)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // Version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // Store method (0)
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localChunks.push(localHeader, dataBytes);

    // Central Directory Header (46 + filename length)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); // UTF-8
    cv.setUint16(10, 0, true); // Store
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralChunks.push(centralHeader);
    offset += localHeader.length + size;
  }

  const centralSize = centralChunks.reduce((acc, c) => acc + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...localChunks, ...centralChunks, eocd] as BlobPart[], {
    type: 'application/zip',
  });
}

export async function downloadAsZip(entries: ZipFileEntry[], zipFilename: string): Promise<void> {
  if (!entries.length) return;
  const blob = await createZipBlob(entries);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
