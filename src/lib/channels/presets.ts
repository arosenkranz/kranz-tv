import type { ChannelPreset } from './types.ts'

export const CHANNEL_PRESETS: readonly ChannelPreset[] = [
  {
    id: 'skate',
    number: 1,
    name: 'Skate Vids',
    description: 'Skateboarding clips and edits',
    playlistId: 'PLmDOmgjgiHsiBYTWTmljl4E3Ft0DBVlDH',
    emoji: '🛹',
  },
  {
    id: 'music',
    number: 2,
    name: 'Music Videos',
    description: 'Music videos from the collection',
    playlistId: 'PLmDOmgjgiHshjqFKDhoSFjVLtyVOnOaOn',
    emoji: '🎵',
  },
  {
    id: 'party',
    number: 3,
    name: 'Party Background',
    description: 'Background vibes for any occasion',
    playlistId: 'PLmDOmgjgiHsg9L_50qUKKeTYa3CR33o9s',
    emoji: '🎉',
  },
  {
    id: 'favorites',
    number: 4,
    name: 'Favorites',
    description: 'All-time favorite videos',
    playlistId: 'FLRbSMOWF7L-IrYVrZ0qBRfw',
    emoji: '⭐',
  },
  {
    id: 'entertainment',
    number: 5,
    name: 'Entertainment',
    description: 'Entertainment picks from around the web',
    playlistId: 'PLmDOmgjgiHsgXkkeyJM1E8-Lx28ds32Nt',
    emoji: '📺',
  },
] as const
