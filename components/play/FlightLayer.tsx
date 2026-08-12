/**
 * La carte qui vole de la main vers la banque, les propriétés ou le tapis.
 * 280 ms, une courbe sortante, et elle disparaît : on cherche à rendre le geste
 * lisible, pas à faire un feu d'artifice.
 */

'use client';

import { AnimatePresence, motion } from 'framer-motion';

import { CardFace } from '@/components/cards/CardFace';
import type { PlayController } from '@/components/play/usePlayController';
import { COUCHE } from '@/lib/ui/couches';

export function FlightLayer({ ctl, width }: { ctl: PlayController; width: number }) {
  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: COUCHE.narration }}>
      <AnimatePresence>
        {ctl.flights.map((f) => (
          <motion.div
            key={f.id}
            className="absolute"
            initial={{ x: f.from.x, y: f.from.y, scale: 1, opacity: 1, rotate: 0 }}
            animate={{ x: f.to.x, y: f.to.y, scale: 0.45, opacity: 0, rotate: -12 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            onAnimationComplete={() => ctl.endFlight(f.id)}
            style={{ left: -width / 2, top: -width * 0.7 }}
          >
            <CardFace cardId={f.cardId} width={width} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
