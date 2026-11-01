import { base64ToBytes, bytesToBase64 } from "../lib/files";
export type Cipher = "AES-GCM" | "AES-CBC" | "AES-CTR";
const encoder = new TextEncoder();
export async function derive(password: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" },
      material,
      512,
    ),
  );
}
async function hmac(
  key: Uint8Array<ArrayBuffer>,
  data: Uint8Array<ArrayBuffer>,
) {
  const imported = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, data));
}
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};
export async function encryptFile(
  file: File,
  password: string,
  algorithm: Cipher,
) {
  if (password.length < 8)
    throw new Error("Use a password of at least 8 characters.");
  if (file.size > 128 * 1024 * 1024)
    throw new Error("Encryption is limited to 128 MB per file.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(
    new Uint8Array(algorithm === "AES-GCM" ? 12 : 16),
  );
  const derived = await derive(password, salt);
  const key = await crypto.subtle.importKey(
    "raw",
    derived.slice(0, 32),
    algorithm,
    false,
    ["encrypt"],
  );
  const params =
    algorithm === "AES-CTR"
      ? { name: algorithm, counter: iv, length: 64 }
      : { name: algorithm, iv };
  const header = encoder.encode(
    JSON.stringify({
      v: 1,
      algorithm,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      iterations: 310000,
      kdf: "PBKDF2-SHA256",
    }),
  );
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, header.length);
  // Original filename is encrypted with the content, never written to the clear-text header.
  const meta = encoder.encode(
    JSON.stringify({ name: file.name, type: file.type }),
  );
  const metaLength = new Uint8Array(4);
  new DataView(metaLength.buffer).setUint32(0, meta.length);
  const payload = concat(
    metaLength,
    meta,
    new Uint8Array(await file.arrayBuffer()),
  );
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        ...params,
        ...(algorithm === "AES-GCM" ? { additionalData: header } : {}),
      },
      key,
      payload,
    ),
  );
  const body = concat(encoder.encode("BIRCH01\n"), length, header, encrypted);
  const tag = await hmac(derived.slice(32), body);
  return new Blob([body, tag], { type: "application/octet-stream" });
}
export async function decryptFile(file: File, password: string) {
  if (file.size > 129 * 1024 * 1024)
    throw new Error("Encrypted file exceeds the 129 MB limit.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (
    bytes.length < 64 ||
    new TextDecoder().decode(bytes.slice(0, 8)) !== "BIRCH01\n"
  )
    throw new Error("Not a Birchize encrypted file.");
  const length = new DataView(bytes.buffer).getUint32(8);
  if (length > 4096 || 12 + length + 32 >= bytes.length)
    throw new Error("Invalid encrypted header.");
  const headerBytes = bytes.slice(12, 12 + length);
  const header = JSON.parse(new TextDecoder().decode(headerBytes));
  if (
    header.v !== 1 ||
    !["AES-GCM", "AES-CBC", "AES-CTR"].includes(header.algorithm) ||
    header.iterations !== 310000 ||
    header.kdf !== "PBKDF2-SHA256"
  )
    throw new Error("Unsupported encryption parameters.");
  const salt = base64ToBytes(header.salt),
    iv = base64ToBytes(header.iv);
  if (
    salt.length !== 16 ||
    iv.length !== (header.algorithm === "AES-GCM" ? 12 : 16)
  )
    throw new Error("Invalid encryption parameters.");
  const derived = await derive(password, salt);
  const signingKey = await crypto.subtle.importKey(
    "raw",
    derived.slice(32),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      "HMAC",
      signingKey,
      bytes.slice(-32),
      bytes.slice(0, -32),
    ))
  )
    throw new Error("Incorrect password or damaged file.");
  const key = await crypto.subtle.importKey(
    "raw",
    derived.slice(0, 32),
    header.algorithm,
    false,
    ["decrypt"],
  );
  const params =
    header.algorithm === "AES-CTR"
      ? { name: header.algorithm, counter: iv, length: 64 }
      : { name: header.algorithm, iv };
  const plain = new Uint8Array(
    await crypto.subtle.decrypt(
      {
        ...params,
        ...(header.algorithm === "AES-GCM"
          ? { additionalData: headerBytes }
          : {}),
      },
      key,
      bytes.slice(12 + length, -32),
    ),
  );
  const metaLength = new DataView(plain.buffer).getUint32(0);
  if (metaLength > 65536 || metaLength + 4 > plain.length)
    throw new Error("Invalid encrypted metadata.");
  const meta = JSON.parse(
    new TextDecoder().decode(plain.slice(4, 4 + metaLength)),
  );
  return {
    blob: new Blob([plain.slice(4 + metaLength)], {
      type: meta.type || "application/octet-stream",
    }),
    name: String(meta.name || "decrypted").replace(/[/\\]/g, "_"),
  };
}
