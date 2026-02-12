import mongoose from 'mongoose';
import { config } from './env.js';

export const connectDatabase = async (): Promise<void> => {
    try {
        await mongoose.connect(config.MONGODB_URI);
        
        console.log('[INFO] MongoDB connected successfully');
        console.log(`[INFO] Database: ${mongoose.connection.name}`);
        
        mongoose.connection.on('error', (error) => {
            console.error('[ERROR] MongoDB connection error:', error);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.warn('[WARN] MongoDB disconnected');
        });
        
    } catch (error) {
        console.error('[ERROR] Failed to connect to MongoDB:', error);
        process.exit(1);
    }
};

export const disconnectDatabase = async (): Promise<void> => {
    try {
        await mongoose.disconnect();
        console.log('[INFO] MongoDB disconnected successfully');
    } catch (error) {
        console.error('[ERROR] Error disconnecting from MongoDB:', error);
    }
};
