/*
# Legendary avatars — five gem styles above Epic (100-200 gems)

Students asked for a collection to save toward, so this adds a fifth rarity
tier above Epic with five styles at 100, 120, 145, 170 and 200 gems.

## Why a new tier rather than more Epics

The existing ladder tops out at 80. Slotting five more styles at 80-100 would
have flattened the top of the shop: nothing left to aim at, and the 80-gem
Epics would stop feeling like the reward they are. A distinct Legendary tier
gives the ladder somewhere to go and makes the biggest purchase in the
economy a visible milestone. The client marks them with an iridescent overlay
on top of the gold foil (src/index.css .avatar-prism).

## Prices, checked against the real earning rate

Gems come from quizzes (max 10 per quiz, default). A student earning a few
quizzes a week reaches 100 in roughly a term; 200 is the ambitious one.
That is deliberate — the tier is the long game, not the impulse buy.

## What this migration does

1. Widens avatar_catalog_rarity_check to allow 'legendary'. It currently
   allows free/uncommon/rare/epic (widened in 20261105090000), so seeding a
   legendary row without this step fails with
   "violates check constraint avatar_catalog_rarity_check".
2. Upserts the five rows at sort_order 11-15, after the Epics.

Idempotent: re-running is safe, and existing ownership rows are untouched —
students keep everything they bought. The visual art lives in
src/lib/avatars.ts; this table is only the price/name/sort source of truth.
*/

-- ===== 1. Widen the rarity check to include 'legendary' =====================

ALTER TABLE public.avatar_catalog DROP CONSTRAINT IF EXISTS avatar_catalog_rarity_check;
ALTER TABLE public.avatar_catalog ADD CONSTRAINT avatar_catalog_rarity_check
  CHECK (rarity IN ('free', 'uncommon', 'rare', 'epic', 'legendary'));

-- ===== 2. Seed the Legendary tier ==========================================

INSERT INTO public.avatar_catalog (id, name, rarity, price, sort_order) VALUES
  ('crystal-unicorn', 'Crystal Unicorn', 'legendary', 100, 11),
  ('bamboo-panda',    'Bamboo Panda',    'legendary', 120, 12),
  ('abyss-shark',     'Abyss Shark',     'legendary', 145, 13),
  ('moon-wolf',       'Moon Wolf',       'legendary', 170, 14),
  ('void-kraken',     'Void Kraken',     'legendary', 200, 15)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      rarity = EXCLUDED.rarity,
      price = EXCLUDED.price,
      sort_order = EXCLUDED.sort_order;