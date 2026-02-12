import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';

export const errorHandler = (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    // Manejo de errores específicos
    if (error.message.includes('not found') || error.message.includes('User not found')) {
        res.status(404).json({
            success: false,
            error: error.message
        });
        return;
    }

    if (error.message.includes('already registered') || error.message.includes('already exists')) {
        res.status(409).json({
            success: false,
            error: error.message
        });
        return;
    }

    if (error.message.includes('verification failed') || error.message.includes('invalid')) {
        res.status(401).json({
            success: false,
            error: error.message
        });
        return;
    }

    if (error.message.includes('locked')) {
        res.status(423).json({
            success: false,
            error: error.message
        });
        return;
    }

    if (error.message.includes('required') || error.message.includes('must')) {
        res.status(400).json({
            success: false,
            error: error.message
        });
        return;
    }

    // Error genérico
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        ...(config.NODE_ENV === 'development' && { details: error.message })
    });
};
