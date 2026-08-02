import { Link } from 'react-router-dom';
import { Button, Panel } from '@/components/ui';
import styles from './NotFoundPage.module.css';

export function NotFoundPage() {
  return (
    <Panel raised className={styles.wrap}>
      <span className={styles.code}>404</span>
      <h1 className={styles.title}>Te fuiste al mazo</h1>
      <p className={styles.desc}>Esta página no existe o todavía no está en juego.</p>
      <Link to="/">
        <Button size="lg">Volver a la mesa</Button>
      </Link>
    </Panel>
  );
}
