/**
 * Unit tests for the pure logic modules — no browser, no database.
 *
 *   npm run test:unit
 *
 * Covers the two places a silent bug would corrupt real data without any
 * visible error: ledger paging (wrong balances) and streak day bucketing
 * (wrong achievements). Bundled with esbuild like the CSV suite.
 */
import { fetchAllPaged } from "../src/lib/paging";
import { buildAchievementStats } from "../src/lib/achievements";

let passed = 0;
let failed = 0;

function ok(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

// ---------- fetchAllPaged ---------------------------------------------------

/** Serves `total` fake rows, honouring the inclusive range like PostgREST. */
function makeSource(total) {
  const calls = [];
  const build = async (from, to) => {
    calls.push([from, to]);
    const data = Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => from + i);
    return { data, error: null };
  };
  return { build, calls };
}

async function testPaging() {
  console.log("\nfetchAllPaged");

  {
    const { build } = makeSource(0);
    ok("empty source → []", (await fetchAllPaged(build)).length === 0);
  }

  {
    const { build, calls } = makeSource(10);
    const rows = await fetchAllPaged(build, 1000);
    ok("under one page → all rows", rows.length === 10, rows.length);
    ok("under one page → single request", calls.length === 1, calls);
  }

  {
    // Exactly one full page must still make a second (short/empty) request,
    // otherwise the last page looks full forever and the loop misbehaves.
    const { build, calls } = makeSource(1000);
    const rows = await fetchAllPaged(build, 1000);
    ok("exactly one page → 1000 rows", rows.length === 1000, rows.length);
    ok("exactly one page → 2 requests", calls.length === 2, calls.length);
    ok("second request is empty", calls[1][0] === 1000, calls[1]);
  }

  {
    // The regression this whole change exists for: >1000 rows.
    const { build } = makeSource(2500);
    const rows = await fetchAllPaged(build, 1000);
    ok("2500 rows → all 2500 returned", rows.length === 2500, rows.length);
    ok("rows are contiguous and unique", rows.every((r, i) => r === i), rows.slice(0, 3));
    ok("last row is 2499", rows[rows.length - 1] === 2499, rows[rows.length - 1]);
  }

  {
    const { build, calls } = makeSource(2500);
    await fetchAllPaged(build, 500);
    ok("custom page size 500 → 6 requests", calls.length === 6, calls.length);
    ok("ranges are contiguous", calls.every(([from], i) => from === i * 500), calls);
  }

  {
    // Errors must propagate, never be swallowed into a partial result.
    const build = async () => ({ data: null, error: { message: "boom" } });
    let threw = false;
    try {
      await fetchAllPaged(build);
    } catch (e) {
      threw = e instanceof Error && e.message === "boom";
    }
    ok("error surfaces as a thrown Error", threw);
  }

  {
    let threw = false;
    try {
      await fetchAllPaged(async () => ({ data: [], error: null }), 0);
    } catch {
      threw = true;
    }
    ok("rejects pageSize < 1", threw);
  }
}

// ---------- buildAchievementStats / streaks ---------------------------------

const base = {
  total_awards: 0,
  lifetime_earned: 0,
  quizzes_taken: 0,
  perfect_quizzes: 0,
  rewards_redeemed: 0,
};

/** Local noon `daysAgo` days back, as an ISO string. */
function localNoonIso(daysAgo) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function testStreaks() {
  console.log("\nbuildAchievementStats");

  {
    const s = buildAchievementStats({ ...base, award_times: [] });
    ok("no awards → no streaks", s.current_streak === 0 && s.longest_streak === 0);
  }

  {
    const s = buildAchievementStats({ ...base, award_times: [localNoonIso(0)] });
    ok("award today → current streak 1", s.current_streak === 1, s.current_streak);
  }

  {
    // Yesterday-only must still count (morning check before today's award).
    const s = buildAchievementStats({ ...base, award_times: [localNoonIso(1)] });
    ok("award yesterday → current streak 1", s.current_streak === 1, s.current_streak);
  }

  {
    const s = buildAchievementStats({
      ...base,
      award_times: [localNoonIso(0), localNoonIso(1), localNoonIso(2)],
    });
    ok("three consecutive days → streak 3", s.current_streak === 3, s.current_streak);
  }

  {
    // A gap breaks the current streak but the earlier run is the longest.
    const s = buildAchievementStats({
      ...base,
      award_times: [localNoonIso(0), localNoonIso(3), localNoonIso(4), localNoonIso(5), localNoonIso(6)],
    });
    ok("gap → current streak 1", s.current_streak === 1, s.current_streak);
    ok("gap → longest streak 4", s.longest_streak === 4, s.longest_streak);
  }

  {
    // Multiple awards on one day must not inflate the streak.
    const s = buildAchievementStats({
      ...base,
      award_times: [localNoonIso(0), localNoonIso(0), localNoonIso(0)],
    });
    ok("same-day repeats → streak 1", s.current_streak === 1, s.current_streak);
    ok("same-day repeats → one award day", s.award_days.length === 1, s.award_days);
  }

  {
    // Day boundary is LOCAL: 00:30 and 23:30 local are the same local day.
    const early = new Date();
    early.setHours(0, 30, 0, 0);
    const late = new Date();
    late.setHours(23, 30, 0, 0);
    const s = buildAchievementStats({ ...base, award_times: [early.toISOString(), late.toISOString()] });
    ok("same local day, different UTC-ish hours → one day", s.award_days.length === 1, s.award_days);
  }

  {
    // Legacy fallback before the migration lands.
    const s = buildAchievementStats({ ...base, award_days: ["2026-01-01", "2026-01-02"] });
    ok("legacy award_days still produce days", s.award_days.length === 2, s.award_days);
    ok("legacy days are sorted ISO", s.award_days[0] === "2026-01-01", s.award_days[0]);
  }

  {
    // award_times wins when both are present.
    const s = buildAchievementStats({
      ...base,
      award_times: [localNoonIso(0)],
      award_days: ["2020-01-01", "2020-01-02", "2020-01-03"],
    });
    ok("award_times preferred over legacy", s.award_days.length === 1, s.award_days);
  }

  {
    // Streak thresholds actually fire through evaluateAchievements.
    const s = buildAchievementStats({
      ...base,
      award_times: [localNoonIso(0), localNoonIso(1), localNoonIso(2)],
    });
    ok("longest_streak >= 3 for streak-3 badge", s.longest_streak >= 3, s.longest_streak);
  }
}

async function main() {
  await testPaging();
  testStreaks();
  console.log(`\n${failed === 0 ? "ALL UNIT TESTS PASSED" : `${failed} TEST(S) FAILED`} — ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();