/**
 * Feuille modale. En paysage, la hauteur est la ressource rare : la modale
 * occupe donc une bande centrale qui défile, jamais tout l'écran.
 */

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  /** Absent = modale non refermable (fenêtre de Refus, défausse obligatoire). */
  onClose?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0 bg-ink/55"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            className="panel relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden"
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="flex items-baseline justify-between gap-3 border-b-2 border-ink/85 bg-mono-red px-4 py-2.5 text-cream">
              <div className="min-w-0">
                <h2 className="truncate text-base font-extrabold uppercase tracking-tight">
                  {title}
                </h2>
                {subtitle && (
                  <p className="truncate text-xs font-semibold opacity-90">
                    {subtitle}
                  </p>
                )}
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="shrink-0 text-sm font-bold uppercase tracking-wide opacity-80 transition-opacity hover:opacity-100"
                >
                  Fermer
                </button>
              )}
            </header>

            <div className="no-scrollbar flex-1 overflow-y-auto p-4">{children}</div>

            {footer && (
              <footer className="border-t-2 border-ink/20 bg-cream px-4 py-3">
                {footer}
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
