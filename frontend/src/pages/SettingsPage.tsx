import { useEffect, useState } from 'react';
import { PageHeader, Panel, Button, Badge } from '@/components/ui';
import { Toggle } from '@/components/ui/Toggle';
import { RULESETS, OFFICIAL_40 } from '@/game';
import {
  loadSettings,
  saveSettings,
  applyAnimationPreference,
  type Difficulty,
} from '@/services/settings';
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
  const [settings, setSettings] = useState(() => loadSettings());
  const [ruleset, setRuleset] = useState(OFFICIAL_40.id);

  useEffect(() => {
    applyAnimationPreference(settings.animations);
  }, [settings.animations]);

  const update = (patch: Partial<ReturnType<typeof loadSettings>>) => {
    setSettings(saveSettings(patch));
  };

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Preferencias"
        title="Configuración"
        subtitle="Se guardan en este dispositivo. Cuando conectemos el backend, viajarán con tu cuenta."
      />

      <section className={styles.group}>
        <h3 className={styles.groupTitle}>Juego</h3>
        <Panel padding="none" className={styles.card}>
          <SettingRow title="Reglamento" desc="Variante de puntuación de las partidas.">
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
          <SettingRow title="Dificultad de la IA" desc="Nivel del rival en las partidas vs IA.">
            <select
              className={styles.select}
              value={settings.difficulty}
              onChange={(e) => update({ difficulty: e.target.value as Difficulty })}
            >
              <option value="facil">Fácil</option>
              <option value="normal">Normal</option>
              <option value="dificil">Difícil</option>
            </select>
          </SettingRow>
          <SettingRow title="Animaciones" desc="Transiciones y efectos de la mesa.">
            <Toggle
              checked={settings.animations}
              onChange={(v) => update({ animations: v })}
              label="Animaciones"
            />
          </SettingRow>
        </Panel>
      </section>

      <section className={styles.group}>
        <h3 className={styles.groupTitle}>Audio</h3>
        <Panel padding="none" className={styles.card}>
          <SettingRow title="Sonido" desc="Efectos de cartas y cantos.">
            <Toggle
              checked={settings.sound}
              onChange={(v) => update({ sound: v })}
              label="Sonido"
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
