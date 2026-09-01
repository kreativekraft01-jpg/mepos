import { X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-card rounded-none shadow-2xl w-full max-w-md overflow-hidden border-2 border-border"
          >
            <div className="bg-muted px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-none ${danger ? 'bg-destructive/10' : 'bg-primary/20'}`}>
                  <AlertTriangle className={`w-6 h-6 ${danger ? 'text-destructive' : 'text-primary'}`} />
                </div>
                <h2 className="text-2xl font-bold text-foreground">{title}</h2>
              </div>
              <button
                onClick={onCancel}
                className="p-2 hover:bg-background rounded-none transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8">
              <p className="text-lg text-muted-foreground">{message}</p>

              <div className="flex gap-4 pt-8">
                <button
                  onClick={onCancel}
                  className="flex-1 px-6 py-4 border-2 border-border rounded-none text-muted-foreground font-bold hover:bg-muted hover:text-foreground transition-colors uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  className={`flex-1 px-6 py-4 ${
                    danger
                      ? 'bg-destructive hover:brightness-110 text-destructive-foreground'
                      : 'bg-primary hover:brightness-110 text-primary-foreground'
                  } rounded-none font-bold transition-all shadow-lg active:scale-95 uppercase tracking-widest`}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
