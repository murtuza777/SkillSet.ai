import { argon2Verify, argon2id } from 'hash-wasm';

const textEncoder = new TextEncoder();

const toBase64 = (bytes: Uint8Array) => {
  let output = '';
  for (const byte of bytes) {
    output += String.fromCharCode(byte);
  }
  return btoa(output);
};

const toBase64Url = (bytes: Uint8Array) =>
  toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

export const randomId = () => crypto.randomUUID();
export const isoNow = () => new Date().toISOString();
export const addSeconds = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

export const randomToken = (bytes = 32) => {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return toBase64Url(value);
};

export const hashValue = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value));
  return toBase64Url(new Uint8Array(digest));
};

export const hashPassword = async (password: string) => {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);

  return argon2id({
    password,
    salt: toBase64(saltBytes),
    parallelism: 1,
    iterations: 3,
    memorySize: 19456,
    hashLength: 32,
    outputType: 'encoded',
  });
};

export const verifyPassword = async (password: string, hash: string) => {
  return argon2Verify({
    password,
    hash,
  });
};

export const safeJsonParse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const chunkText = (value: string, chunkSize = 1200) => {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];

  for (let index = 0; index < normalized.length; index += chunkSize) {
    chunks.push(normalized.slice(index, index + chunkSize));
  }

  return chunks;
};

export const stripHtml = (html: string) => {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
};
