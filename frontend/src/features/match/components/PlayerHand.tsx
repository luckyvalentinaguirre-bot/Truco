import type { Card } from '@/game';
import { PlayingCard } from '@/components/game/PlayingCard';
import type { HumanOptions } from '../matchView';
import { isCardPlayable } from '../matchView';
import styles from './PlayerHand.module.css';

interface PlayerHandProps {
  hand: Card[];
  options: HumanOptions;
  /** Claves de cartas que son pieza (determinado por el motor). */
  piezaKeys: Set<string>;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onPlay: (card: Card) => void;
}

/**
 * Mano interactiva del humano. Touch-first: un toque selecciona,
 * el segundo (o el botón "Jugar") tira la carta. Nunca deja tirar
 * una carta ilegal (el motor lo confirma vía `options`).
 */
export function PlayerHand({
  hand,
  options,
  piezaKeys,
  selectedIndex,
  onSelect,
  onPlay,
}: PlayerHandProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.fan}>
        {hand.map((card, i) => {
          const playable = isCardPlayable(options, card.rank, card.suit);
          const selected = selectedIndex === i;
          return (
            <div
              key={`${card.rank}-${card.suit}`}
              className={[
                styles.slot,
                selected ? styles.selectedSlot : '',
                playable ? styles.playable : styles.blocked,
              ].join(' ')}
            >
              <PlayingCard
                card={card}
                size="lg"
                selected={selected}
                pieza={piezaKeys.has(`${card.rank}-${card.suit}`)}
                onClick={
                  playable
                    ? () => (selected ? onPlay(card) : onSelect(i))
                    : undefined
                }
              />
              {selected && playable && (
                <button className={styles.playBtn} onClick={() => onPlay(card)}>
                  Jugar
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
