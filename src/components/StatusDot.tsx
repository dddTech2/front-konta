import { estadoColor } from '../format';

export function StatusDot({ estado, pulse = false }: { estado: string; pulse?: boolean }) {
  return <span className={pulse ? 'dot pulse' : 'dot'} style={{ background: estadoColor(estado) }} aria-hidden="true" />;
}
