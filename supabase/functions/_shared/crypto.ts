// AES-GCM encryption for connection credentials at rest.
// CONNECTION_ENCRYPTION_KEY must be a 32-byte key, base64-encoded
// (e.g. `openssl rand -base64 32`), set as an Edge Function secret.

function getKeyMaterial(): Uint8Array {
  const b64 = Deno.env.get('CONNECTION_ENCRYPTION_KEY')
  if (!b64) {
    throw new Error('CONNECTION_ENCRYPTION_KEY is not set')
  }
  const raw = atob(b64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  if (bytes.length !== 32) {
    throw new Error('CONNECTION_ENCRYPTION_KEY must decode to 32 bytes')
  }
  return bytes
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', getKeyMaterial(), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await importKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  )
  // Store iv || ciphertext, base64-encoded.
  const combined = new Uint8Array(iv.length + ciphertext.length)
  combined.set(iv, 0)
  combined.set(ciphertext, iv.length)
  return toBase64(combined)
}

export async function decryptSecret(stored: string): Promise<string> {
  const key = await importKey()
  const combined = fromBase64(stored)
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(decrypted)
}
