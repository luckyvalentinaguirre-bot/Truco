import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getMesaAsset, MESA_THEMES, isMesaTheme } from './mesaAssets';

function onDisk(publicPath: string): string {
  return join(process.cwd(), 'public', publicPath.replace(/^\//, ''));
}

describe('mesaAssets', () => {
  it('mapea cada tema a su PNG real', () => {
    expect(getMesaAsset('verde')).toBe('/mesas/IMG_1540.PNG');
    expect(getMesaAsset('bordo')).toBe('/mesas/IMG_1539.PNG');
    expect(getMesaAsset('azul')).toBe('/mesas/IMG_1541.PNG');
  });

  it('los 3 PNG de mesa existen en disco (sin 404)', () => {
    const faltantes = MESA_THEMES.map((m) => getMesaAsset(m.id)).filter((p) => !existsSync(onDisk(p)));
    expect(faltantes, `Mesas faltantes:\n${faltantes.join('\n')}`).toEqual([]);
  });

  it('valida temas', () => {
    expect(isMesaTheme('verde')).toBe(true);
    expect(isMesaTheme('rojo')).toBe(false);
  });
});
