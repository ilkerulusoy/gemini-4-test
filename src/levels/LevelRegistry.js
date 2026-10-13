export const LEVELS = [
  {
    id: 'hub',
    name: 'Bear Village Hub',
    subtitle: 'Kingdom Sanctuary & World Portals',
    requiredBears: 0,
    theme: 'hub',
    skyColor: 0x7dd3fc,
    fogColor: 0xbae6fd,
    bears: [
      { id: 'hub_b1', name: 'Barnaby', hint: 'Atop the Village Watchtower' }
    ]
  },
  {
    id: 'turtletown',
    name: 'Turtletown Meadows',
    subtitle: 'Emerald Waterfalls & Bouncy Shrooms',
    requiredBears: 0,
    theme: 'meadow',
    skyColor: 0x60a5fa,
    fogColor: 0xbfdbfe,
    bears: [
      { id: 'tt_b1', name: 'Bramble', hint: 'Guarded by Purple Bees in the Flower Plaza' },
      { id: 'tt_b2', name: 'Clover', hint: 'Locked behind the Twin Stepping Stone Switch' },
      { id: 'tt_b3', name: 'Maple', hint: 'High on the Waterfall Pagoda Summit' },
      { id: 'tt_b4', name: 'Truffle', hint: 'Across the Revolving Log Bridge' }
    ]
  },
  {
    id: 'snowvalley',
    name: 'Snow Valley Peaks',
    subtitle: 'Glacier Rinks & Alpine Gondolas',
    requiredBears: 2,
    theme: 'snow',
    skyColor: 0x93c5fd,
    fogColor: 0xe0f2fe,
    bears: [
      { id: 'sv_b1', name: 'Yukon', hint: 'Sliding across the Frosted Skating Lake' },
      { id: 'sv_b2', name: 'Aurora', hint: 'Inside the Ice Cavern Switch Vault' },
      { id: 'sv_b3', name: 'Kodiak', hint: 'At the Alpine Cable Gondola Peak' }
    ]
  },
  {
    id: 'beemothep',
    name: 'Beemothep Hive',
    subtitle: 'Golden Honey Temple & Queen Boss',
    requiredBears: 4,
    theme: 'temple',
    skyColor: 0xf59e0b,
    fogColor: 0xfde68a,
    bears: [
      { id: 'bm_b1', name: 'Pharaoh Paws', hint: 'Atop the Obelisk of Golden Nectar' },
      { id: 'bm_b2', name: 'King Ursus', hint: 'Defeat Queen Beemothep in the Royal Sanctum' }
    ]
  }
];
