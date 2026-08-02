import { useState } from 'react';
import { PageHeader, Panel, Button, Badge } from '@/components/ui';
import { Toggle } from '@/components/ui/Toggle';
import { RULESETS, OFFICIAL_40 } from '@/game';
import styles from './SettingsPage.module.css';

interface RowProps {
  title: string;
  desc?: string;
  children: React.ReactNode;
}

function SettingRow({ title, desc, children }: RowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        {desc && <span className={styles.rowDesc}>{desc}</span>}
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const [senas, setSenas] = useState(true);
  const [sound, setSound] = useState(true);
  const [animations, setAnimations] = useState(true);
  const [notifications, setNotifications] = useState(false);
  const [ruleset, setRuleset] = useState(OFFICIAL_40.id);

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Preferencias"
        title="Configuración"
        subtitle="Ajustá tu experiencia. Estas opciones se guardarán en tu cuenta cuando conectemos el backend."
      />

      <section className={styles.group}>
        <h3 className={styles.groupTitle}>Juego</h3>
        <Panel padding="none" className={styles.card}>
          <SettingRow
            title="Reglamento"
            desc="Variante de puntuación de las partidas."
          >
            <select
              className={styles.select}
              value={ruleset}
              onChange={(e) => setRuleset(e.target.value)}
            >
              {Object.values(RULESETS).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </SettingRow>
          <SettingRow
            title="Señas"
            desc="Habilitar señas al compañero en modos por equipos."
          >
            <Toggle checked={senas} onChange={setSenas} label="Señas" />
          </SettingRow>
          <SettingRow title="Animaciones" desc="Transiciones y efectos de la mesa.">
            <Toggle checked={animations} onChange={setAnimations} label="Animaciones" />
          </SettingRow>
        </Panel>
      </section>

      <section className={styles.group}>
        <h3 className={styles.groupTitle}>Audio y notificaciones</h3>
        <Panel padding="none" className={styles.card}>
          <SettingRow title="Sonido" desc="Efectos de cartas y cantos.">
            <Toggle checked={sound} onChange={setSound} label="Sonido" />
          </SettingRow>
          <SettingRow
            title="Notificaciones"
            desc="Avisos de invitaciones y turnos."
          >
            <Toggle
              checked={notifications}
              onChange={setNotifications}
              label="Notificaciones"
            />
          </SettingRow>
        </Panel>
      </section>

      <section className={styles.group}>
        <h3 className={styles.groupTitle}>Cuenta</h3>
        <Panel padding="none" className={styles.card}>
          <SettingRow title="Autenticación" desc="Login y registro reales.">
            <Badge>Próximamente</Badge>
          </SettingRow>
          <SettingRow title="Idioma" desc="Idioma de la interfaz.">
            <select className={styles.select} defaultValue="es" disabled>
              <option value="es">Español</option>
            </select>
          </SettingRow>
          <SettingRow title="Cerrar sesión">
            <Button variant="danger" disabled>
              Salir
            </Button>
          </SettingRow>
        </Panel>
      </section>
    </div>
  );
}
