import { useState } from 'react';
import type { Action, Seat } from '@/game';
import {
  TRUCO_LABEL,
  ENVIDO_LABEL,
  trucoAction,
  envidoAction,
  type HumanOptions,
} from '../matchView';
import styles from './ActionBar.module.css';

interface ActionBarProps {
  seat: Seat;
  options: HumanOptions;
  hasFlor: boolean;
  /** Etiqueta del canto pendiente (para el título del panel). */
  respondingTo: string | null;
  onAction: (action: Action) => void;
}

/**
 * Panel "ACCIONES" con botones contextuales y colores de la referencia.
 * Sólo aparecen acciones legales (calculadas por el motor).
 */
export function ActionBar({
  seat,
  options,
  hasFlor,
  respondingTo,
  onAction,
}: ActionBarProps) {
  const [confirmFold, setConfirmFold] = useState(false);
  const [envidoOpen, setEnvidoOpen] = useState(false);

  // El submenú de Envido sólo tiene sentido si hay más de una opción; con una
  // sola se muestra directa (un toque). Se cierra si dejan de existir opciones.
  const envidoCalls = options.envidoCalls;
  const showEnvidoMenu = envidoOpen && envidoCalls.length > 0;
  const groupEnvido = envidoCalls.length >= 2;

  const hasAny =
    options.trucoCalls.length > 0 ||
    options.envidoCalls.length > 0 ||
    options.canFlor ||
    options.canFold ||
    options.canAccept ||
    options.canDecline;

  return (
    <div className={styles.panel}>
      <span className={styles.title}>{respondingTo ? `¿Querés el ${respondingTo}?` : 'Acciones'}</span>

      {!hasAny && <span className={styles.waiting}>Esperá tu turno…</span>}

      {confirmFold ? (
        <div className={styles.confirm}>
          <span>¿Seguro que te vas al mazo?</span>
          <button
            className={[styles.btn, styles.noquiero].join(' ')}
            onClick={() => {
              onAction({ type: 'FOLD', seat });
              setConfirmFold(false);
            }}
          >
            Sí, me voy
          </button>
          <button className={[styles.btn, styles.neutral].join(' ')} onClick={() => setConfirmFold(false)}>
            Cancelar
          </button>
        </div>
      ) : showEnvidoMenu ? (
        /* Submenú compacto de Envido: sólo los cantos permitidos ahora. */
        <div className={styles.grid}>
          {envidoCalls.map((call) => (
            <button
              key={call}
              className={[styles.btn, styles.envido].join(' ')}
              onClick={() => {
                onAction(envidoAction(seat, call));
                setEnvidoOpen(false);
              }}
            >
              {ENVIDO_LABEL[call]}
            </button>
          ))}
          <button
            className={[styles.btn, styles.neutral].join(' ')}
            onClick={() => setEnvidoOpen(false)}
          >
            Volver
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {/* Respuestas a un canto */}
          {options.canAccept && (
            <button className={[styles.btn, styles.quiero].join(' ')} onClick={() => onAction({ type: 'ACCEPT', seat })}>
              Quiero
            </button>
          )}
          {options.canDecline && (
            <button className={[styles.btn, styles.noquiero].join(' ')} onClick={() => onAction({ type: 'DECLINE', seat })}>
              No quiero
            </button>
          )}

          {/* Cantos de envido: un único botón que despliega las opciones
              válidas (Envido / Real Envido / Falta Envido). Con una sola
              opción se canta directo. */}
          {groupEnvido ? (
            <button
              className={[styles.btn, styles.envido].join(' ')}
              onClick={() => setEnvidoOpen(true)}
            >
              Envido ▾
            </button>
          ) : (
            envidoCalls.map((call) => (
              <button
                key={call}
                className={[styles.btn, styles.envido].join(' ')}
                onClick={() => onAction(envidoAction(seat, call))}
              >
                {ENVIDO_LABEL[call]}
              </button>
            ))
          )}

          {/* Flor */}
          {options.canFlor && hasFlor && (
            <button className={[styles.btn, styles.flor].join(' ')} onClick={() => onAction({ type: 'CALL_FLOR', seat })}>
              Flor
            </button>
          )}

          {/* Cantos de truco */}
          {options.trucoCalls.map((call) => (
            <button
              key={call}
              className={[styles.btn, styles.truco].join(' ')}
              onClick={() => onAction(trucoAction(seat, call))}
            >
              {TRUCO_LABEL[call]}
            </button>
          ))}

          {/* Irse al mazo */}
          {options.canFold && (
            <button className={[styles.btn, styles.neutral].join(' ')} onClick={() => setConfirmFold(true)}>
              Irse al mazo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
