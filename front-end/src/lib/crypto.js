const ALG = { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };

export async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(ALG, true, ["encrypt", "decrypt"]);

  const pubBase64 = await exportPublicKey(keyPair.publicKey);
  const privJwk = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);

  localStorage.setItem("cyphernet.privateKey", JSON.stringify(privJwk));

  const session = JSON.parse(localStorage.getItem("cyphernet.session") || "{}");
  if (session.token) {
    await fetch("/api/users/me/public-key", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ publicKey: pubBase64 }),
    });
  }

  return keyPair;
}

export async function exportPublicKey(cryptoKey) {
  const buf = await window.crypto.subtle.exportKey("spki", cryptoKey);
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export async function importPublicKey(base64String) {
  const buf = Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0));
  return window.crypto.subtle.importKey("spki", buf, ALG, true, ["encrypt"]);
}

export async function encryptMessage(publicKey, plaintext) {
  const encoded = new TextEncoder().encode(plaintext);
  const buf = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, encoded);
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export async function decryptMessage(privateKey, base64Ciphertext) {
  const buf = Uint8Array.from(atob(base64Ciphertext), (c) => c.charCodeAt(0));
  const decrypted = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, buf);
  return new TextDecoder().decode(decrypted);
}

export async function loadPrivateKey() {
  const raw = localStorage.getItem("cyphernet.privateKey");
  if (!raw) throw new Error("No private key found in localStorage");
  const jwk = JSON.parse(raw);
  return window.crypto.subtle.importKey("jwk", jwk, ALG, true, ["decrypt"]);
}
