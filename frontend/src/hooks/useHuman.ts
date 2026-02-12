import { useEffect, useRef, useState, useCallback } from 'react';
import Human from '@vladmandic/human';
import type { HumanConfig, HumanResult } from '../types';

/**
 * Hook personalizado para gestionar Human library
 * Maneja la inicialización, carga de modelos y detección facial
 */

const DEFAULT_CONFIG: Partial<HumanConfig> = {
  backend: 'webgl',
  modelBasePath: '/models',
  face: {
    enabled: true,
    detector: {
      enabled: true,
      rotation: true,
      maxDetected: 1,
      minConfidence: 0.7,
    },
    mesh: {
      enabled: true, // Necesario para liveness/antispoof — analiza estructura 3D del rostro
    },
    description: {
      enabled: true,
      minConfidence: 0.7,
    },
    iris: {
      enabled: true, // Ayuda a detectar fotos (ojos estáticos vs reales)
    },
    emotion: {
      enabled: false, // No necesario para autenticación
    },
    antispoof: {
      enabled: true,
    },
    liveness: {
      enabled: true,
    },
  },
  body: {
    enabled: false,
  },
  hand: {
    enabled: false,
  },
  object: {
    enabled: false,
  },
  gesture: {
    enabled: true, // Necesario para detectar parpadeo y gestos faciales
  },
};

interface UseHumanReturn {
  human: Human | null;
  isLoading: boolean;
  isReady: boolean;
  error: Error | null;
  detect: (input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => Promise<HumanResult | null>;
  warmup: () => Promise<void>;
}

export function useHuman(config?: Partial<HumanConfig>): UseHumanReturn {
  const humanRef = useRef<Human | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Inicializar Human
  useEffect(() => {
    let mounted = true;

    const initializeHuman = async () => {
      if (humanRef.current) return; // Ya inicializado

      setIsLoading(true);
      setError(null);

      try {
        const mergedConfig = { ...DEFAULT_CONFIG, ...config } as HumanConfig;
        const human = new Human(mergedConfig);

        // Cargar modelos
        await human.load();

        if (!mounted) return;

        humanRef.current = human;
        setIsReady(true);

        console.log('Human initialized:', human.version);
      } catch (err) {
        if (!mounted) return;
        
        const error = err instanceof Error ? err : new Error('Failed to initialize Human');
        setError(error);
        console.error('Failed to initialize Human:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeHuman();

    return () => {
      mounted = false;
    };
  }, [config]);

  /**
   * Detectar rostro en el input proporcionado
   */
  const detect = useCallback(
    async (
      input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
    ): Promise<HumanResult | null> => {
      if (!humanRef.current || !isReady) {
        console.warn('Human not ready');
        return null;
      }

      try {
        const result = await humanRef.current.detect(input);
        return result as HumanResult;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Detection failed');
        console.error('Detection error:', error);
        setError(error);
        return null;
      }
    },
    [isReady]
  );

  /**
   * Warm up del modelo (ejecutar una detección dummy para preparar el modelo)
   */
  const warmup = useCallback(async (): Promise<void> => {
    if (!humanRef.current || !isReady) {
      console.warn('Human not ready for warmup');
      return;
    }

    try {
      // Crear un canvas dummy para warmup
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      
      await humanRef.current.warmup();
      
      console.log('Human warmup completed');
    } catch (err) {
      console.error('Warmup error:', err);
    }
  }, [isReady]);

  return {
    human: humanRef.current,
    isLoading,
    isReady,
    error,
    detect,
    warmup,
  };
}

export default useHuman;
