/* Íconos SVG inline (sin dependencias externas, trazo consistente). */
import type { SVGProps } from 'react';

export type IconName =
  | 'play'
  | 'friends'
  | 'ranking'
  | 'profile'
  | 'history'
  | 'settings'
  | 'menu'
  | 'close'
  | 'chevron'
  | 'trophy'
  | 'bolt'
  | 'cards'
  | 'plus'
  | 'search'
  | 'sound'
  | 'mute'
  | 'chat'
  | 'online';

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

const paths: Record<IconName, JSX.Element> = {
  play: <path d="M8 5.5v13l11-6.5-11-6.5Z" />,
  friends: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.6-3 2.9-4.6 5.5-4.6S13.9 16 14.5 19" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M15.4 14.6c2.2.2 3.8 1.7 4.3 4.4" />
    </>
  ),
  ranking: (
    <>
      <path d="M7 21h10M12 17v4M6 4h12v4a6 6 0 0 1-12 0V4Z" />
      <path d="M6 6H3.5V8A3 3 0 0 0 6 10.9M18 6h2.5V8A3 3 0 0 1 18 10.9" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6" />
    </>
  ),
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4v4h4" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5l1.5 2.6 3-.4.7 2.9 2.6 1.5-1.2 2.8 1.2 2.8-2.6 1.5-.7 2.9-3-.4L12 21.5l-1.5-2.6-3 .4-.7-2.9L4.2 15l1.2-2.8L4.2 9.4l2.6-1.5.7-2.9 3 .4L12 2.5Z" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  trophy: (
    <>
      <path d="M7 21h10M12 17v4M6 4h12v4a6 6 0 0 1-12 0V4Z" />
      <path d="M6 6H3.5V8A3 3 0 0 0 6 10.9M18 6h2.5V8A3 3 0 0 1 18 10.9" />
    </>
  ),
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  cards: (
    <>
      <rect x="3" y="6" width="11" height="15" rx="2" transform="rotate(-8 8.5 13.5)" />
      <rect x="10" y="4" width="11" height="15" rx="2" transform="rotate(8 15.5 11.5)" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8 8 0 0 1 0 12" />
    </>
  ),
  mute: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M17 9.5l4 5M21 9.5l-4 5" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5h16v11H9l-4 4v-4H4V5Z" />
    </>
  ),
  online: <circle cx="12" cy="12" r="6" />,
};

const filled: IconName[] = ['play', 'bolt', 'online'];

export function Icon({ name, size = 22, ...rest }: IconProps) {
  const isFilled = filled.includes(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={isFilled ? 'currentColor' : 'none'}
      stroke={isFilled ? 'none' : 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
