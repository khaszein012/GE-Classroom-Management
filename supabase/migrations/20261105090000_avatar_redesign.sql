/*
# Premium avatar redesign — emoji-forward artwork, two new Epic styles

The first avatar pass put its distinguishing glyph in the tile's
bottom-right corner — exactly where the level badge overlays — and used
muted gradients, so premium avatars read as slightly-different free
monograms. Students could not see what they paid for.

The redesign moves the artwork client-side (src/lib/avatars.ts): the emoji
becomes the large, centered main image and the initials move to a small
chip in the top-left, opposite the level badge. Ownership, prices and the
security model are unchanged.

This migration only refreshes the server catalog: renamed styles, two new
Epic entries (aurora 80, nebula 80). Idempotent upsert — existing ownership
rows are untouched, students keep everything they bought.
*/

INSERT INTO public.avatar_catalog (id, name, rarity, price, sort_order) VALUES
  ('monogram',      'Classic',       'free',      0,  0),
  ('ink-scholar',   'Wise Owl',      'uncommon', 15,  1),
  ('sea-glass',     'Ocean Wave',    'uncommon', 15,  2),
  ('ember',         'Butterfly',     'uncommon', 15,  3),
  ('orchid',        'Blossom',       'uncommon', 15,  4),
  ('gilded-crown',  'Golden Crown',  'rare',     45,  5),
  ('midnight-star', 'Midnight Moon', 'rare',     45,  6),
  ('jade-dragon',   'Jade Dragon',   'rare',     60,  7),
  ('solar-flare',   'Solar Flare',   'rare',     60,  8),
  ('aurora',        'Aurora',        'epic',     80,  9),
  ('nebula',        'Nebula',        'epic',     80, 10)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      rarity = EXCLUDED.rarity,
      price = EXCLUDED.price,
      sort_order = EXCLUDED.sort_order;