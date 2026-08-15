/**
 * Ce qui donne à la table son épaisseur de jeu vidéo : on ne se contente pas de
 * changer l'état, on le raconte au moment où il change.
 *
 * Trois retours, tous nés du même log d'événements du moteur :
 *  - le bandeau de tour, qui dit à qui la main passe ;
 *  - la révélation du coup, qui montre au centre la carte qu'un adversaire vient
 *    de jouer — sans elle, leurs actions n'existaient que dans le journal ;
 *  - les montants flottants, qui rendent une dette physique.
 *
 * Tout est purement décoratif : rien ici ne pilote le jeu, et
 * `prefers-reduced-motion` supprime l'ensemble sans rien casser.
 */

'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import { CardFace } from '@/components/cards/CardFace';
import { Wordmark } from '@/components/brand/Wordmark';
import { ACTIONS, MAX_ACTIONS_PER_TURN, type CardId, type GameEvent } from '@/lib/engine';
import { inkOn } from '@/lib/ui/color';
import { COUCHE } from '@/lib/ui/couches';
import { vibrer } from '@/lib/ui/haptique';
import { CUE_MS, EASE_OUT, FLOAT_MS, TURN_BANNER_MS } from '@/lib/ui/motion';

/** Le coup à montrer au centre de la table. */
interface Cue {
  id: number;
  cardId: CardId | null;
  title: string;
  subtitle: string;
  tone: 'neutral' | 'hostile';
}

interface Float {
  id: number;
  text: string;
  gain: boolean;
}

/** Événements arrivés depuis le dernier rendu. */
function useFreshEvents(events: GameEvent[]): GameEvent[] {
  const seen = useRef<number | null>(null);
  const [fresh, setFresh] = useState<GameEvent[]>([]);

  useEffect(() => {
    const last = events[events.length - 1];
    if (!last) return;
    // Premier rendu : on ne rejoue pas l'historique, on s'y accroche.
    if (seen.current === null) {
      seen.current = last.seq;
      return;
    }
    const since = seen.current;
    const news = events.filter((e) => e.seq > since);
    if (news.length === 0) return;
    seen.current = last.seq;
    setFresh(news);
  }, [events]);

  return fresh;
}

export function TableFeedback({
  events,
  viewerId,
  nameOf,
  colorOf,
  winnerId,
  cueWidth,
  actionsAllowed,
}: {
  events: GameEvent[];
  viewerId: string;
  nameOf: (id: string) => string;
  /** Couleur du joueur, telle qu'elle s'affiche partout ailleurs. */
  colorOf: (id: string) => string;
  winnerId: string | null;
  /** Largeur de la carte montrée au centre : la plus grande que l'écran tienne. */
  cueWidth: number;
  /** Actions permises au tour qui commence : moins de trois après une Contravention. */
  actionsAllowed: number;
}) {
  const reduced = useReducedMotion();
  const fresh = useFreshEvents(events);
  const [cue, setCue] = useState<Cue | null>(null);
  const [turn, setTurn] = useState<{
    id: number;
    mine: boolean;
    name: string;
    color: string;
    actions: number;
  } | null>(null);
  const [floats, setFloats] = useState<Float[]>([]);
  const seq = useRef(0);

  // `nameOf` est reconstruit à chaque rafraîchissement de la vue. S'il figurait
  // dans les dépendances, l'effet rejouerait le même lot d'événements à chaque
  // changement d'état — et le coup d'un adversaire serait ré-annoncé à tout
  // propos. On le lit donc par référence : seul un NOUVEL événement déclenche.
  const nameRef = useRef(nameOf);
  nameRef.current = nameOf;
  const colorRef = useRef(colorOf);
  colorRef.current = colorOf;
  // Le bandeau se construit à l'événement, mais le budget du tour se lit dans
  // l'état : on le prend par référence, comme les noms et les couleurs.
  const actionsRef = useRef(actionsAllowed);
  actionsRef.current = actionsAllowed;

  // Le retour haptique se branche sur les mêmes événements que le reste : ce
  // qui mérite une animation mérite une vibration, et rien d'autre.
  useEffect(() => {
    for (const e of fresh) {
      if (e.t === 'TURN_STARTED' && e.playerId === viewerId) vibrer('tour');
      else if (e.t === 'CARDS_STOLEN' && e.fromId === viewerId) vibrer('perte');
      else if (e.t === 'PAID' && e.fromId === viewerId) vibrer('perte');
      else if (e.t === 'PAID' && e.toId === viewerId) vibrer('gain');
      else if (e.t === 'CARDS_SWAPPED' && (e.aId === viewerId || e.bId === viewerId)) {
        vibrer('perte');
      }
    }
  }, [fresh, viewerId]);


  useEffect(() => {
    if (fresh.length === 0 || reduced) return;
    const who = (id: string) => (id === viewerId ? 'Toi' : nameRef.current(id));

    for (const e of fresh) {
      switch (e.t) {
        case 'TURN_STARTED':
          setTurn({
            id: ++seq.current,
            mine: e.playerId === viewerId,
            name: nameRef.current(e.playerId),
            color: colorRef.current(e.playerId),
            actions: actionsRef.current,
          });
          break;
        case 'ACTION_PLAYED': {
          const label = e.kind === 'RENT' ? 'Loyer' : ACTIONS[e.kind].label;
          setCue({
            id: ++seq.current,
            cardId: e.cardId,
            title: label,
            subtitle:
              e.targetIds.length > 0
                ? `${who(e.playerId)} → ${e.targetIds.map(who).join(', ')}`
                : who(e.playerId),
            tone: e.targetIds.includes(viewerId) ? 'hostile' : 'neutral',
          });
          break;
        }
        case 'JUST_SAY_NO':
          setCue({
            id: ++seq.current,
            cardId: e.cardId,
            title: 'Refus catégorique',
            subtitle: `${who(e.playerId)} → ${who(e.againstId)}`,
            tone: e.againstId === viewerId ? 'hostile' : 'neutral',
          });
          break;
        case 'CARDS_STOLEN': {
          const stolen = e.cardIds[0];
          setCue({
            id: ++seq.current,
            cardId: stolen ?? null,
            title: e.cardIds.length > 1 ? `${e.cardIds.length} cartes volées` : 'Propriété volée',
            subtitle: `${who(e.toId)} ← ${who(e.fromId)}`,
            tone: e.fromId === viewerId ? 'hostile' : 'neutral',
          });
          break;
        }
        case 'PAID':
          if (e.fromId === viewerId) {
            setFloats((f) => [...f, { id: ++seq.current, text: `−${e.amount} M`, gain: false }]);
          } else if (e.toId === viewerId) {
            setFloats((f) => [...f, { id: ++seq.current, text: `+${e.amount} M`, gain: true }]);
          }
          break;
        default:
          break;
      }
    }
  }, [fresh, viewerId, reduced]);

  // Chaque retour s'efface tout seul.
  useEffect(() => {
    if (!cue) return;
    const t = setTimeout(() => setCue(null), CUE_MS);
    return () => clearTimeout(t);
  }, [cue]);

  useEffect(() => {
    if (!turn) return;
    const t = setTimeout(() => setTurn(null), TURN_BANNER_MS);
    return () => clearTimeout(t);
  }, [turn]);

  useEffect(() => {
    if (floats.length === 0) return;
    const t = setTimeout(() => setFloats((f) => f.slice(1)), FLOAT_MS);
    return () => clearTimeout(t);
  }, [floats]);

  if (reduced) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: COUCHE.narration }}
    >
      {/* Coup joué : la carte au centre, en grand, le temps de la voir.
          Elle était à la taille d'une carte en main, posée aux deux tiers de la
          hauteur : on la manquait une fois sur deux, et c'est pourtant la seule
          chose qui dit ce qu'un adversaire vient de faire. Elle occupe
          maintenant le milieu du tapis, sur un fond assombri en dégradé — assez
          pour la détacher, pas assez pour perdre la table de vue. */}
      <AnimatePresence>
        {cue && (
          <motion.div
            key={cue.id}
            className="absolute inset-0 grid place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={EASE_OUT}
          >
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(closest-side at 50% 50%, rgba(20,20,20,0.12), rgba(20,20,20,0.55))',
              }}
            />
            <motion.div
              className="relative flex flex-col items-center gap-2"
              initial={{ scale: 0.55, rotate: -10, y: 12 }}
              animate={{ scale: 1, rotate: 0, y: 0 }}
              exit={{ scale: 1.06, y: -14 }}
              transition={{ type: 'spring', stiffness: 340, damping: 24 }}
            >
              {cue.cardId && (
                <div className="shadow-drag">
                  <CardFace cardId={cue.cardId} width={cueWidth} />
                </div>
              )}
              <div
                className={`rounded-card border-2 border-ink px-3 py-1.5 text-center shadow-card ${
                  cue.tone === 'hostile' ? 'bg-mono-red text-cream' : 'bg-cream text-ink'
                }`}
              >
                <p className="text-sm font-extrabold uppercase leading-none tracking-tight">
                  {cue.title}
                </p>
                <p className="mt-1 text-xs font-bold leading-none opacity-80">
                  {cue.subtitle}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Passage de main. ---------------------------------------------------- */}
      <AnimatePresence>
        {turn && (
          <motion.div
            key={turn.id}
            className="absolute inset-x-0 top-8"
            initial={{ opacity: 0, x: '-100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={EASE_OUT}
          >
            {/* Le bandeau prend la couleur que le joueur a choisie dans le
                salon : à quatre, « Tour de Théo » se lit une demi-seconde plus
                vite quand la bande est déjà de sa couleur. */}
            <div
              className="border-y-2 border-ink py-1.5 text-center shadow-panel"
              style={{ background: turn.color, color: inkOn(turn.color) }}
            >
              <p className="text-lg font-extrabold uppercase leading-none tracking-tight">
                {turn.mine ? 'À toi de jouer' : `Tour de ${turn.name}`}
              </p>
              {/* Une Contravention se voit au compteur, mais c'est ici qu'on
                  comprend POURQUOI il n'y a que deux pastilles. */}
              {turn.actions < MAX_ACTIONS_PER_TURN && (
                <p className="mt-0.5 text-xs font-bold uppercase tracking-wide opacity-80">
                  Contravention · {turn.actions} action
                  {turn.actions > 1 ? 's' : ''} seulement
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Montants encaissés ou perdus. --------------------------------------- */}
      <AnimatePresence>
        {floats.map((f, i) => (
          <motion.p
            key={f.id}
            className={`absolute right-8 top-[40%] text-3xl font-extrabold tabular-nums drop-shadow-[0_2px_0_rgba(20,20,20,0.35)] ${
              f.gain ? 'text-[#0F7A3D]' : 'text-mono-red'
            }`}
            initial={{ opacity: 0, y: 0, scale: 0.7 }}
            animate={{ opacity: 1, y: -60 - i * 26, scale: 1.1 }}
            exit={{ opacity: 0, y: -96 - i * 26 }}
            transition={EASE_OUT}
          >
            {f.text}
          </motion.p>
        ))}
      </AnimatePresence>

      {/* Fin de partie. ------------------------------------------------------ */}
      <AnimatePresence>
        {winnerId && (
          <motion.div
            className="absolute inset-0 grid place-items-center bg-ink/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={EASE_OUT}
          >
            <motion.div
              className="panel flex flex-col items-center gap-2 px-8 py-5"
              initial={{ scale: 0.7, rotate: -4 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 20 }}
            >
              <Wordmark size={22} />
              <p className="text-2xl font-extrabold uppercase leading-none tracking-tight">
                {winnerId === viewerId ? 'Tu gagnes !' : `${nameOf(winnerId)} gagne`}
              </p>
              <p className="text-sm text-ink-soft">Trois lots complets.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
