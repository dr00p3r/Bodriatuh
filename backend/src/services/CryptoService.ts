import crypto from 'crypto';
import { config } from '../config/env.js';

const ALGORITHM = config.CRYPTO_ALGORITHM;
const IV_LENGTH = config.CRYPTO_IV_LENGTH;
const KEY_LENGTH = config.CRYPTO_KEY_LENGTH;

class CryptoService {
    private readonly secretKey: Buffer;

    constructor() {
        // La validación se hace en config/env.ts al iniciar la aplicación
        this.secretKey = Buffer.from(config.BIOMETRIC_SECRET_KEY);
    }

    /**
     * Encripta datos biométricos para almacenamiento seguro.
     * Cumple con regulaciones de protección de datos al hacer los datos ilegibles.
     * 
     * @param vector - Vector biométrico (Float32Array o array numérico)
     * @returns String en formato "iv:encryptedData" (hexadecimal)
     */
    encryptVector(vector: Float32Array | number[]): string {
        if (!vector || vector.length === 0) {
            throw new Error('Vector cannot be empty');
        }

        const bufferData = Buffer.from(new Float32Array(vector).buffer);
        
        // IV único por encriptación - crítico para seguridad
        const iv = crypto.randomBytes(IV_LENGTH);
        
        const cipher = crypto.createCipheriv(ALGORITHM, this.secretKey, iv);
        const encrypted = Buffer.concat([
            cipher.update(bufferData),
            cipher.final()
        ]);

        return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
    }

    /**
     * Desencripta datos biométricos para comparación en memoria.
     * Los datos nunca se almacenan desencriptados.
     * 
     * @param encryptedString - String en formato "iv:encryptedData"
     * @returns Vector biométrico original
     */
    decryptVector(encryptedString: string): Float32Array {
        if (!encryptedString || !encryptedString.includes(':')) {
            throw new Error('Invalid encrypted string format');
        }

        const [ivHex, encryptedHex] = encryptedString.split(':');
        
        if (!ivHex || !encryptedHex) {
            throw new Error('Missing IV or encrypted data');
        }

        const iv = Buffer.from(ivHex, 'hex');
        const encryptedText = Buffer.from(encryptedHex, 'hex');

        // Validación crítica: IV debe tener exactamente los bytes definidos
        if (iv.length !== IV_LENGTH) {
            throw new Error(`Invalid IV length: ${iv.length}`);
        }

        const decipher = crypto.createDecipheriv(ALGORITHM, this.secretKey, iv);
        const decrypted = Buffer.concat([
            decipher.update(encryptedText),
            decipher.final()
        ]);

        return new Float32Array(
            decrypted.buffer,
            decrypted.byteOffset,
            decrypted.byteLength / Float32Array.BYTES_PER_ELEMENT
        );
    }
}

export default new CryptoService();
