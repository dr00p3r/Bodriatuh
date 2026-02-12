import dotenv from 'dotenv';

dotenv.config();

interface EnvConfig {
    // Server
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: number;
    
    // Database
    MONGODB_URI: string;
    
    // WebAuthn
    RP_NAME: string;
    RP_ID: string;
    ORIGIN: string;
    
    // Crypto
    BIOMETRIC_SECRET_KEY: string;
    CRYPTO_ALGORITHM: string;
    CRYPTO_IV_LENGTH: number;
    CRYPTO_KEY_LENGTH: number;
    
    // Biometric
    SIMILARITY_THRESHOLD: number;
    MIN_VECTOR_LENGTH: number;
    
    // Security
    MAX_FAILED_ATTEMPTS: number;
    LOCK_TIME: number;
}

function validateEnv(): EnvConfig {
    const requiredVars = [
        'MONGODB_URI',
        'RP_NAME',
        'RP_ID',
        'ORIGIN',
        'BIOMETRIC_SECRET_KEY',
        'CRYPTO_ALGORITHM',
        'CRYPTO_IV_LENGTH',
        'CRYPTO_KEY_LENGTH'
    ];

    const missing = requiredVars.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}\n` +
            'Please check your .env file.'
        );
    }

    const keyLength = Number(process.env.CRYPTO_KEY_LENGTH);
    const secretKey = process.env.BIOMETRIC_SECRET_KEY!;

    if (secretKey.length !== keyLength) {
        throw new Error(
            `BIOMETRIC_SECRET_KEY must be exactly ${keyLength} characters. ` +
            `Current length: ${secretKey.length}`
        );
    }

    return {
        NODE_ENV: (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || 'development',
        PORT: Number(process.env.PORT) || 3000,
        
        MONGODB_URI: process.env.MONGODB_URI!,
        
        RP_NAME: process.env.RP_NAME!,
        RP_ID: process.env.RP_ID!,
        ORIGIN: process.env.ORIGIN!,
        
        BIOMETRIC_SECRET_KEY: secretKey,
        CRYPTO_ALGORITHM: process.env.CRYPTO_ALGORITHM!,
        CRYPTO_IV_LENGTH: Number(process.env.CRYPTO_IV_LENGTH),
        CRYPTO_KEY_LENGTH: keyLength,
        
        SIMILARITY_THRESHOLD: Number(process.env.SIMILARITY_THRESHOLD) || 0.85,
        MIN_VECTOR_LENGTH: Number(process.env.MIN_VECTOR_LENGTH) || 128,
        
        MAX_FAILED_ATTEMPTS: Number(process.env.MAX_FAILED_ATTEMPTS) || 5,
        LOCK_TIME: Number(process.env.LOCK_TIME) || 900000 // 15 minutos
    };
}

export const config = validateEnv();
