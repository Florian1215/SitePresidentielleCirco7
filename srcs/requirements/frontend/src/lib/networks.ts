/** Couleur de marque de chaque réseau social (tuiles « Suivez-nous », bulles de la carte des groupes). */
export const NETWORK_COLORS: Record<string, string> = {
  bluesky: '#0a7aff',
  discord: '#5865f2',
  facebook: '#1877f2',
  instagram: '#d62976',
  linkedin: '#0a66c2',
  linktree: '#254f1a',
  mastodon: '#6364ff',
  telegram: '#229ed9',
  threads: '#000000',
  tiktok: '#000000',
  twitch: '#9146ff',
  whatsapp: '#25d366',
  x: '#000000',
  youtube: '#ff0000',
  other: 'var(--color-violet)',
};

const NETWORK_NAMES: Record<string, string> = {
  bluesky: 'Bluesky',
  discord: 'Discord',
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  linktree: 'Linktree',
  mastodon: 'Mastodon',
  telegram: 'Telegram',
  threads: 'Threads',
  tiktok: 'TikTok',
  twitch: 'Twitch',
  whatsapp: 'WhatsApp',
  x: 'X',
  youtube: 'YouTube',
};

/** Nom affiché d'un réseau (« instagram » → « Instagram »). */
export const networkName = (network: string, other = 'Site') => NETWORK_NAMES[network] ?? other;

export const networkColor = (network: string) => NETWORK_COLORS[network] ?? NETWORK_COLORS.other;
