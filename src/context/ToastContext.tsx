import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'success', duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const success = useCallback((message: string, duration?: number) => {
    showToast(message, 'success', duration);
  }, [showToast]);

  const error = useCallback((message: string, duration?: number) => {
    showToast(message, 'error', duration);
  }, [showToast]);

  const info = useCallback((message: string, duration?: number) => {
    showToast(message, 'info', duration);
  }, [showToast]);

  const warning = useCallback((message: string, duration?: number) => {
    showToast(message, 'warning', duration);
  }, [showToast]);

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-emerald-950/90 border-emerald-500/30 text-emerald-100',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
          progress: 'bg-emerald-500',
          glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
        };
      case 'error':
        return {
          bg: 'bg-red-950/90 border-red-500/30 text-red-100',
          icon: <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />,
          progress: 'bg-red-500',
          glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
        };
      case 'warning':
        return {
          bg: 'bg-amber-950/90 border-amber-500/30 text-amber-100',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
          progress: 'bg-amber-500',
          glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
        };
      case 'info':
      default:
        return {
          bg: 'bg-slate-900/95 border-blue-500/30 text-blue-100',
          icon: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
          progress: 'bg-blue-500',
          glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]',
        };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      
      {/* Toast Portal Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-md w-full pointer-events-none px-4 sm:px-0">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => {
            const styles = getToastStyles(toast.type);
            return (
              <motion.div
                layout
                key={toast.id}
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className={`pointer-events-auto w-full relative overflow-hidden backdrop-blur-md rounded-2xl border p-4 flex gap-3 items-start ${styles.bg} ${styles.glow}`}
              >
                {/* Visual Badge Indicator */}
                <div className="flex items-center justify-center p-1 bg-white/5 rounded-xl border border-white/5 shadow-inner">
                  {styles.icon}
                </div>

                {/* Message Text */}
                <div className="flex-1 pt-0.5">
                  <p className="text-sm font-medium leading-relaxed tracking-wide font-sans text-slate-100">
                    {toast.message}
                  </p>
                </div>

                {/* Dismiss Button */}
                <button
                  onClick={() => removeToast(toast.id)}
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0 mt-0.5"
                  aria-label="Close notification"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Auto-Dismiss Timer Line */}
                {toast.duration && toast.duration > 0 && (
                  <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: toast.duration / 1000, ease: 'linear' }}
                    className={`absolute bottom-0 left-0 h-[3px] ${styles.progress}`}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
