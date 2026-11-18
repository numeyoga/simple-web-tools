import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PBKDF2_ITERATIONS,
  decryptArchiveBytes,
  encryptArchiveBytes,
  parseEncryptionHeader,
} from '../../src/core/crypto-archive.js';

describe('crypto-archive (AES-GCM + PBKDF2)', () => {
  it('chiffre puis déchiffre des données binaires avec sel et IV aléatoires', async () => {
    const payload = new TextEncoder().encode('Contenu confidentiel Locavern ZIP');
    const a = await encryptArchiveBytes(payload, 'SecretFort!2026');
    const b = await encryptArchiveBytes(payload, 'SecretFort!2026');

    expect(a.header.format).toBe('locavern-encrypted-archive');
    expect(a.header.kdf).toBe('PBKDF2');
    expect(a.header.hash).toBe('SHA-256');
    expect(a.header.cipher).toBe('AES-GCM');
    expect(a.header.iterations).toBe(DEFAULT_PBKDF2_ITERATIONS);
    expect(a.header.salt).not.toBe(b.header.salt);
    expect(a.header.iv).not.toBe(b.header.iv);

    const decrypted = await decryptArchiveBytes(a.header, a.ciphertext, 'SecretFort!2026');
    expect(decrypted.ok).toBe(true);
    if (decrypted.ok) {
      expect(new TextDecoder().decode(decrypted.plaintextZipBytes)).toBe(
        'Contenu confidentiel Locavern ZIP',
      );
    }
  });

  it('rejette un mauvais mot de passe ou un texte chiffré altéré', async () => {
    const payload = new Uint8Array([10, 20, 30, 40, 50]);
    const encrypted = await encryptArchiveBytes(payload, 'BonMotDePasse');

    const wrongPass = await decryptArchiveBytes(
      encrypted.header,
      encrypted.ciphertext,
      'MauvaisMotDePasse',
    );
    expect(wrongPass.ok).toBe(false);
    if (!wrongPass.ok) {
      expect(wrongPass.wrongPassword).toBe(true);
      expect(wrongPass.error).toContain('Mot de passe incorrect');
    }

    const tamperedCipher = new Uint8Array(encrypted.ciphertext);
    tamperedCipher[0] = (tamperedCipher[0] ?? 0) ^ 0xff;
    const tamperedRes = await decryptArchiveBytes(
      encrypted.header,
      tamperedCipher,
      'BonMotDePasse',
    );
    expect(tamperedRes.ok).toBe(false);
  });

  it('valide les bornes de sécurité des métadonnées PBKDF2 / AES-GCM', () => {
    expect(parseEncryptionHeader(null).ok).toBe(false);
    expect(
      parseEncryptionHeader({
        format: 'locavern-encrypted-archive',
        version: 1,
        kdf: 'PBKDF2',
        hash: 'SHA-256',
        iterations: 1000,
        cipher: 'AES-GCM',
        keyLength: 256,
        salt: 'AAAAAAAAAAAAAAAAAAAAAA==',
        iv: 'AAAAAAAAAAAAAAAA',
      }).ok,
    ).toBe(false);
    expect(
      parseEncryptionHeader({
        format: 'locavern-encrypted-archive',
        version: 1,
        kdf: 'PBKDF2',
        hash: 'SHA-256',
        iterations: 310000,
        cipher: 'AES-GCM',
        keyLength: 256,
        salt: 'AAAAAAAAAAAAAAAAAAAAAA==',
        iv: 'AAAAAAAAAAAAAAAA',
      }).ok,
    ).toBe(true);
  });
});
