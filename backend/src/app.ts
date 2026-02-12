import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import { connectDatabase } from './config/database.js';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/ErrorHandler.js';

const app = express();

// Seguridad
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
    origin: config.ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging
if (config.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: config.NODE_ENV
    });
});

// API Routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.path
    });
});

// Error handler (debe ir al final)
app.use(errorHandler);

// Iniciar servidor
const startServer = async () => {
    try {
        // Conectar a MongoDB
        await connectDatabase();
        
        // Iniciar servidor HTTP
        const PORT = config.PORT;
        app.listen(PORT, () => {
            console.log(`[INFO] Server running on port ${PORT}`);
            console.log(`[INFO] Environment: ${config.NODE_ENV}`);
            console.log(`[INFO] WebAuthn RP: ${config.RP_NAME} (${config.RP_ID})`);
            console.log(`[INFO] Origin: ${config.ORIGIN}`);
        });
    } catch (error) {
        console.error('[ERROR] Failed to start server:', error);
        process.exit(1);
    }
};

// Manejo de señales para cierre graceful
process.on('SIGTERM', async () => {
    console.log('[INFO] SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('[INFO] SIGINT received, shutting down gracefully...');
    process.exit(0);
});

// Iniciar aplicación
startServer();

export default app;
