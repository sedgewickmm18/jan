import { useState, useCallback } from 'react';
import { ElicitationSchema, ElicitationResult, ElicitationAction } from '../types/elicitation';

interface UseElicitationOptions {
  onSubmit?: (data: Record<string, any>) => Promise<ElicitationResult>;
  onSuccess?: (result: ElicitationResult) => void;
  onError?: (error: Error) => void;
}

interface UseElicitationReturn {
  isOpen: boolean;
  schema: ElicitationSchema | null;
  toolName: string | null;
  isLoading: boolean;
  error: string | null;
  showElicitation: (schema: ElicitationSchema, toolName: string) => void;
  closeElicitation: () => void;
  handleSubmit: (data: Record<string, any>) => Promise<void>;
}

export const useElicitation = (options: UseElicitationOptions = {}): UseElicitationReturn => {
  const [isOpen, setIsOpen] = useState(false);
  const [schema, setSchema] = useState<ElicitationSchema | null>(null);
  const [toolName, setToolName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { onSubmit, onSuccess, onError } = options;

  const showElicitation = useCallback((newSchema: ElicitationSchema, newToolName: string) => {
    setSchema(newSchema);
    setToolName(newToolName);
    setIsOpen(true);
    setError(null);
  }, []);

  const closeElicitation = useCallback(() => {
    setIsOpen(false);
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    async (data: Record<string, any>) => {
      if (!onSubmit) return;

      setIsLoading(true);
      setError(null);

      try {
        const result = await onSubmit(data);
        
        if (onSuccess) {
          onSuccess(result);
        }

        closeElicitation();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error occurred');
        
        if (onError) {
          onError(error);
        }

        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    },
    [onSubmit, onSuccess, onError, closeElicitation],
  );

  return {
    isOpen,
    schema,
    toolName,
    isLoading,
    error,
    showElicitation,
    closeElicitation,
    handleSubmit,
  };
};