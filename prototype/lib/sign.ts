// PERSON C OWNS THIS FILE.
// An eligibility slip or bus pass must verify on a conductor's phone with NO
// internet. Ed25519 signature in the QR, public key baked into the client.

import * as ed from "@noble/ed25519";

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function unhex(s: string): Uint8Array {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Dev-only deterministic key so the demo works with an empty .env. */
const DEV_PRIVATE_KEY = "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";

export async function keypair() {
  const priv = unhex(process.env.PASS_PRIVATE_KEY || DEV_PRIVATE_KEY);
  const pub = await ed.getPublicKeyAsync(priv);
  return { priv, pub, pubHex: hex(pub) };
}

export async function signPayload(payload: string) {
  const { priv, pubHex } = await keypair();
  const sig = await ed.signAsync(new TextEncoder().encode(payload), priv);
  return { signature: hex(sig), publicKey: pubHex };
}

export async function verifyPayload(payload: string, signature: string, publicKey: string) {
  try {
    return await ed.verifyAsync(unhex(signature), new TextEncoder().encode(payload), unhex(publicKey));
  } catch {
    return false;
  }
}
