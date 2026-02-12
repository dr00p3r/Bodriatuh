import mongoose, { Schema, Document } from 'mongoose';

// Definición de tipos para las credenciales WebAuthn (Passkeys)
// Esto almacena la llave pública que valida la biometría del dispositivo.
export interface IWebAuthnCredential {
    credentialID: string;
    credentialPublicKey: Buffer;
    counter: number;
    transports?: string[];
}

export interface IUser extends Document {
    fullName: string;
    email: string;

    // Roles de Acceso
    role: 'admin' | 'client'; 
    isActive: boolean;

    // Un usuario puede tener múltiples dispositivos (PC, Celular)
    webAuthnCredentials: IWebAuthnCredential[];
    currentChallenge?: string;

    // Para Unicidad Facial
    encryptedFaceVector: string; 

    // Auditoría y Seguridad (Logging y bloqueo)
    lastLogin?: Date;
    failedLoginAttempts: number;
    lockUntil?: Date;
}

const UserSchema: Schema = new Schema({
    fullName: { 
        type: String, 
        required: true, 
        trim: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true,
        lowercase: true 
    },
    role: { 
        type: String, 
        enum: ['admin', 'client'], 
        default: 'client',
        required: true 
    },
    isActive: {
        type: Boolean,
        default: true
    },
    
    // Array de credenciales WebAuthn
    webAuthnCredentials: [{
        _id: false,
        credentialID: { type: String, required: true },
        credentialPublicKey: { type: Buffer, required: true },
        counter: { type: Number, required: true },
        transports: [String]
    }],
    
    currentChallenge: { type: String }, // Challenge efímero

    // Vector Facial Encriptado
    // Almacenamos el vector + IV (Initialization Vector) como string base64
    encryptedFaceVector: { 
        type: String, 
        // Opcional al crear el objeto, obligatorio al finalizar registro
        required: false,
        // PROTECCIÓN CRÍTICA: Nunca viaja al frontend por error
        select: false
    },

    // Campos para Rate Limiting y Bloqueo
    lastLogin: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date }

}, {
    timestamps: true,
    versionKey: false
});

// Método para verificar si la cuenta está bloqueada temporalmente
UserSchema.methods.isLocked = function(): boolean {
    return !!(this.lockUntil && this.lockUntil > new Date());
};

export default mongoose.model<IUser>('User', UserSchema);