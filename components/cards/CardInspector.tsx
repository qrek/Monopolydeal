/**
 * Loupe : un appui long sur n'importe quelle carte l'affiche en grand.
 *
 * Sur un téléphone en paysage une carte de lot fait cinquante pixels de large ;
 * la grille de loyers y est présente mais illisible, et le texte de règle d'une
 * action est hors de portée. Plutôt que de grossir toute la table, on donne le
 * geste que tout le monde tente déjà : maintenir le doigt.
 *
 * Le même geste ne doit pas entrer en conflit avec le glisser : c'est
 * l'immobilité qui déclenche la loupe, et le moindre déplacement l'annule.
 */

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { CardFace } from '@/components/cards/CardFace';
import type { CardId } from '@/lib/engine';
import { COUCHE } from '@/lib/ui/couches';

/** Assez long pour ne pas se déclencher sur une tape, assez court pour ne pas douter. */
export const LONG_PRESS_MS = 400;
/** Au-delà, c'est un glisser, pas un appui. */
const MOVE_TOLERANCE = 8;

const InspectorContext = createContext<((cardId: CardId) => void) | null>(null);

/** Ouvre la loupe. Retourne null hors du fournisseur, pour rester optionnel. */
export function useInspect(): (cardId: CardId) => void {
  const inspect = useContext(InspectorContext);
  return useCallback((cardId: CardId) => inspect?.(cardId), [inspect]);
}

/**
 * Poignées à poser sur une carte qui n'est pas traînable (mes lots, ceux des
 * adversaires, ma banque). Les cartes de la main passent par le contrôleur de
 * jeu, qui suit déjà le pointeur.
 */
export function useLongPress(cardId: CardId): {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
} {
  const inspect = useInspect();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    from.current = null;
  }, []);

  return {
    onPointerDown: (e) => {
      from.current = { x: e.clientX, y: e.clientY };
      fired.current = false;
      timer.current = setTimeout(() => {
        fired.current = true;
        inspect(cardId);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e) => {
      const o = from.current;
      if (!o) return;
      if (
        Math.abs(e.clientX - o.x) > MOVE_TOLERANCE ||
        Math.abs(e.clientY - o.y) > MOVE_TOLERANCE
      ) {
        cancel();
      }
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    /**
     * Un appui long finit quand même par émettre un clic. Sans ce garde-fou il
     * remonterait au conteneur — et ouvrirait le plateau de l'adversaire
     * par-dessous la carte qu'on vient d'agrandir.
     */
    onClick: (e) => {
      if (!fired.current) return;
      fired.current = false;
      e.stopPropagation();
      e.preventDefault();
    },
    // Sur téléphone, l'appui long ouvre sinon le menu contextuel du navigateur
    // par-dessus la loupe.
    onContextMenu: (e) => e.preventDefault(),
  };
}

export function CardInspectorProvider({ children }: { children: React.ReactNode }) {
  const [card, setCard] = useState<CardId | null>(null);
  const inspect = useCallback((cardId: CardId) => setCard(cardId), []);
  const value = useMemo(() => inspect, [inspect]);

  return (
    <InspectorContext.Provider value={value}>
      {children}
      <CardZoom cardId={card} onClose={() => setCard(null)} />
    </InspectorContext.Provider>
  );
}

/**
 * La carte en grand, au centre. On la ferme d'une tape n'importe où : à ce
 * moment-là le joueur veut revenir à la table, pas viser une croix.
 */
function CardZoom({ cardId, onClose }: { cardId: CardId | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {cardId && (
        <motion.div
          className="fixed inset-0 grid place-items-center bg-ink/70 p-4"
          style={{ zIndex: COUCHE.loupe }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onPointerDown={onClose}
          role="dialog"
          aria-modal
          aria-label="Carte en grand"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            // Ressort à l'ouverture, sortie sèche : `AnimatePresence` attend la
            // fin de l'animation de sortie, et un ressort mettait près d'une
            // demi-seconde à se stabiliser — le temps de croire que la tape
            // n'avait pas été prise en compte.
            transition={{
              type: 'spring',
              stiffness: 420,
              damping: 32,
              exit: { duration: 0.12, ease: 'easeIn' },
            }}
          >
            {/* La carte tient dans la hauteur disponible : en paysage c'est
                elle qui manque, jamais la largeur. */}
            <ZoomedCard cardId={cardId} />
          </motion.div>
          <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[0.7rem] font-bold uppercase tracking-wider text-cream/70">
            Touchez pour fermer
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ZoomedCard({ cardId }: { cardId: CardId }) {
  const [width, setWidth] = useState(200);

  const measure = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const fit = () => {
      // 78 % de la hauteur : il reste de l'air au-dessus et la ligne du bas.
      const byHeight = Math.floor((window.innerHeight * 0.78) / 1.4);
      const byWidth = Math.floor(window.innerWidth * 0.8);
      setWidth(Math.max(150, Math.min(320, byHeight, byWidth)));
    };
    fit();
  }, []);

  return (
    <div ref={measure}>
      <CardFace cardId={cardId} width={width} />
    </div>
  );
}
