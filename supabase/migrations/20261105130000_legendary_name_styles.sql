/*
# Legendary name styles — five patterned plates above Epic (100-200 gems)

Companion to the Legendary avatars (20261105120000). Students now have five
avatar styles to save toward above Epic; this gives the nameplate the same
top end so the two ladders match.

## Why patterns rather than more gradients

The ten existing name styles are a flat tint (uncommon) or a smooth gradient
(rare/epic). Another gradient at 100 gems would be indistinguishable from the
50-gem Gilded in a roster. Each Legendary style therefore carries a real
PATTERN layer (src/index.css .name-pattern-*): stars, dragon scale, hologram,
ember feathers, crown weave. A pattern still reads at nameplate size from
across a room, which is the whole point of the tier.

All five are static by design — the plate can already animate an earned state
(goal ring / streak glow), and a moving texture under a pulsing ring in one
small box is unreadable on a projector. Pattern here, motion there.

## Prices

100 / 120 / 145 / 170 / 200, mirroring the avatar ladder, checked against the
class's real gem income of 15-30 per student per week (so 100 is roughly a
month of quizzes and 200 roughly two).

## What this migration does

1. Widens name_bg_catalog_rarity_check to allow 'legendary'. It currently
   allows free/uncommon/rare/epic (20261104100000), so seeding a legendary row
   without this step fails with
   "violates check constraint name_bg_catalog_rarity_check" — the same trap as
   the avatar catalog.
2. Upserts the five rows at sort_order 10-14, after Royal.

Idempotent: re-running is safe, and existing ownership rows are untouched —
students keep everything they bought. The visual art lives in
src/lib/nameBackgrounds.ts; this table is only the price/name/sort source of
truth.
*/

-- ===== 1. Widen the rarity check to include 'legendary' =====================

ALTER TABLE public.name_bg_catalog DROP CONSTRAINT IF EXISTS name_bg_catalog_rarity_check;
ALTER TABLE public.name_bg_catalog ADD CONSTRAINT name_bg_catalog_rarity_check
  CHECK (rarity IN ('free', 'uncommon', 'rare', 'epic', 'legendary'));

-- ===== 2. Seed the Legendary tier ==========================================

INSERT INTO public.name_bg_catalog (id, name, rarity, price, sort_order) VALUES
  ('starlit',    'Starlit',     'legendary', 100, 10),
  ('dragonscale','Dragon Scale','legendary', 120, 11),
  ('hologram',   'Hologram',    'legendary', 145, 12),
  ('emberwing',  'Emberwing',   'legendary', 170, 13),
  ('crownweave', 'Crown Weave', 'legendary', 200, 14)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      rarity = EXCLUDED.rarity,
      price = EXCLUDED.price,
      sort_order = EXCLUDED.sort_order;