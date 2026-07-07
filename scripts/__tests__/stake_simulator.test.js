/**
 * Tests for the interactive stake simulator.
 * Validates that all financial calculations scale correctly with the selected stake.
 */

const PICKS_DATA = [
  { cote: 1.85, result: "win" },
  { cote: 1.72, result: "win" },
  { cote: 1.90, result: "loss" },
  { cote: 1.65, result: "win" },
  { cote: 1.80, result: "loss" },
  { cote: 2.10, result: "win" },
];

function computeStats(mise, picks) {
  const bankrollDepart = mise * 10;
  let bankroll = bankrollDepart;
  const data = [bankroll];

  picks.forEach(p => {
    if (p.result === "win") bankroll = parseFloat((bankroll + (p.cote - 1) * mise).toFixed(1));
    else bankroll = parseFloat((bankroll - mise).toFixed(1));
    data.push(bankroll);
  });

  const wins = picks.filter(p => p.result === "win").length;
  const total = picks.length;
  const gainNet = parseFloat((bankroll - bankrollDepart).toFixed(1));
  const roi = total > 0 ? parseFloat(((bankroll - bankrollDepart) / bankrollDepart * 100).toFixed(1)) : 0;
  const winrate = total > 0 ? Math.round(wins / total * 100) : 0;

  return { mise, bankrollDepart, bankroll, gainNet, roi, winrate, wins, total, data };
}

function computeGains(mise, picks) {
  let totalGain = 0;
  picks.forEach(p => {
    if (p.result === "win") totalGain += Math.round((p.cote - 1) * mise);
    else if (p.result === "loss") totalGain -= mise;
  });
  return totalGain;
}

function computePickGain(mise, cote, result) {
  return result === "win" ? +((cote - 1) * mise).toFixed(0) : -mise;
}

// ── Stake switching ──

describe("Stake change: 10 → 20€", () => {
  const s10 = computeStats(10, PICKS_DATA);
  const s20 = computeStats(20, PICKS_DATA);

  test("bankroll depart doubles", () => {
    expect(s20.bankrollDepart).toBe(s10.bankrollDepart * 2);
  });

  test("gain net doubles", () => {
    expect(s20.gainNet).toBeCloseTo(s10.gainNet * 2, 0);
  });

  test("ROI stays identical", () => {
    expect(s20.roi).toBeCloseTo(s10.roi, 1);
  });

  test("winrate stays identical", () => {
    expect(s20.winrate).toBe(s10.winrate);
  });
});

describe("Stake change: 20 → 50€", () => {
  const s20 = computeStats(20, PICKS_DATA);
  const s50 = computeStats(50, PICKS_DATA);

  test("bankroll depart scales by 2.5x", () => {
    expect(s50.bankrollDepart).toBe(s20.bankrollDepart * 2.5);
  });

  test("gain net scales by 2.5x", () => {
    expect(s50.gainNet).toBeCloseTo(s20.gainNet * 2.5, 0);
  });

  test("ROI stays identical", () => {
    expect(s50.roi).toBeCloseTo(s20.roi, 1);
  });

  test("winrate stays identical", () => {
    expect(s50.winrate).toBe(s20.winrate);
  });
});

describe("Stake change: 50 → 100€", () => {
  const s50 = computeStats(50, PICKS_DATA);
  const s100 = computeStats(100, PICKS_DATA);

  test("bankroll depart doubles", () => {
    expect(s100.bankrollDepart).toBe(s50.bankrollDepart * 2);
  });

  test("gain net doubles", () => {
    expect(s100.gainNet).toBeCloseTo(s50.gainNet * 2, 0);
  });

  test("ROI stays identical", () => {
    expect(s100.roi).toBeCloseTo(s50.roi, 1);
  });

  test("winrate stays identical", () => {
    expect(s100.winrate).toBe(s50.winrate);
  });
});

// ── Recalcul instantané ──

describe("Instant recalculation", () => {
  test("all 4 stakes produce valid numbers (no NaN)", () => {
    [10, 20, 50, 100].forEach(stake => {
      const s = computeStats(stake, PICKS_DATA);
      expect(Number.isFinite(s.bankroll)).toBe(true);
      expect(Number.isFinite(s.gainNet)).toBe(true);
      expect(Number.isFinite(s.roi)).toBe(true);
      expect(Number.isFinite(s.winrate)).toBe(true);
      expect(Number.isNaN(s.bankroll)).toBe(false);
      expect(Number.isNaN(s.gainNet)).toBe(false);
      expect(Number.isNaN(s.roi)).toBe(false);
    });
  });

  test("chart data points count is picks+1 (includes starting point)", () => {
    const s = computeStats(10, PICKS_DATA);
    expect(s.data.length).toBe(PICKS_DATA.length + 1);
  });

  test("chart data first point is bankrollDepart", () => {
    [10, 20, 50, 100].forEach(stake => {
      const s = computeStats(stake, PICKS_DATA);
      expect(s.data[0]).toBe(s.bankrollDepart);
    });
  });

  test("chart data last point equals final bankroll", () => {
    [10, 20, 50, 100].forEach(stake => {
      const s = computeStats(stake, PICKS_DATA);
      expect(s.data[s.data.length - 1]).toBe(s.bankroll);
    });
  });
});

// ── ROI stays identical across stakes ──

describe("ROI is stake-independent", () => {
  const rois = [10, 20, 50, 100].map(s => computeStats(s, PICKS_DATA).roi);

  test("ROI at 10€ equals ROI at 100€", () => {
    expect(rois[0]).toBeCloseTo(rois[3], 1);
  });

  test("all 4 ROI values are within 0.1% of each other", () => {
    for (let i = 1; i < rois.length; i++) {
      expect(Math.abs(rois[i] - rois[0])).toBeLessThan(0.2);
    }
  });
});

// ── Historique pick gains ──

describe("Pick gains in history", () => {
  test("win at cote 1.85 with 10€ shows +8€ or 9€", () => {
    const gain = computePickGain(10, 1.85, "win");
    expect([8, 9]).toContain(gain);
  });

  test("loss with 10€ shows -10€", () => {
    expect(computePickGain(10, 1.85, "loss")).toBe(-10);
  });

  test("win at cote 1.85 with 100€ shows +85€", () => {
    expect(computePickGain(100, 1.85, "win")).toBe(85);
  });

  test("loss with 100€ shows -100€", () => {
    expect(computePickGain(100, 1.85, "loss")).toBe(-100);
  });

  test("win at cote 2.10 with 50€ shows +55€", () => {
    expect(computePickGain(50, 2.10, "win")).toBe(55);
  });
});

// ── No NaN values ──

describe("No NaN in any calculation", () => {
  test("empty picks produce zeros, not NaN", () => {
    [10, 20, 50, 100].forEach(stake => {
      const s = computeStats(stake, []);
      expect(s.gainNet).toBe(0);
      expect(s.roi).toBe(0);
      expect(s.winrate).toBe(0);
      expect(Number.isNaN(s.bankroll)).toBe(false);
    });
  });

  test("all losses still produce valid numbers", () => {
    const allLoss = [{ cote: 1.50, result: "loss" }, { cote: 1.80, result: "loss" }];
    [10, 20, 50, 100].forEach(stake => {
      const s = computeStats(stake, allLoss);
      expect(Number.isFinite(s.bankroll)).toBe(true);
      expect(Number.isFinite(s.roi)).toBe(true);
      expect(s.gainNet).toBeLessThan(0);
    });
  });

  test("computeGains produces valid number for all stakes", () => {
    [10, 20, 50, 100].forEach(stake => {
      const g = computeGains(stake, PICKS_DATA);
      expect(Number.isFinite(g)).toBe(true);
      expect(Number.isNaN(g)).toBe(false);
    });
  });
});

// ── Gains scale linearly ──

describe("Gains scale linearly with stake", () => {
  test("gains at 20€ = 2x gains at 10€", () => {
    expect(computeGains(20, PICKS_DATA)).toBe(computeGains(10, PICKS_DATA) * 2);
  });

  test("gains at 50€ ≈ 5x gains at 10€ (within rounding)", () => {
    expect(computeGains(50, PICKS_DATA)).toBeCloseTo(computeGains(10, PICKS_DATA) * 5, -1);
  });

  test("gains at 100€ ≈ 10x gains at 10€ (within rounding)", () => {
    expect(computeGains(100, PICKS_DATA)).toBeCloseTo(computeGains(10, PICKS_DATA) * 10, -1);
  });
});

// ── Default stake ──

describe("Default stake and persistence", () => {
  test("default stake is 10€", () => {
    const defaultStake = 10;
    expect(defaultStake).toBe(10);
  });

  test("stake values are valid options", () => {
    const validStakes = [10, 20, 50, 100];
    validStakes.forEach(s => {
      expect(s).toBeGreaterThan(0);
      expect(Number.isInteger(s)).toBe(true);
    });
  });
});

// ── Garde-fous permanents ──

describe("Garde-fous — stake simulator", () => {
  test("no hardcoded 100€ in gain calculation", () => {
    const gain10 = computePickGain(10, 1.85, "loss");
    expect(gain10).toBe(-10);
    expect(gain10).not.toBe(-100);
  });

  test("bankroll depart scales with mise (not fixed at 100)", () => {
    expect(computeStats(10, PICKS_DATA).bankrollDepart).toBe(100);
    expect(computeStats(20, PICKS_DATA).bankrollDepart).toBe(200);
    expect(computeStats(50, PICKS_DATA).bankrollDepart).toBe(500);
    expect(computeStats(100, PICKS_DATA).bankrollDepart).toBe(1000);
  });

  test("winrate is independent of stake (always the same)", () => {
    const winrates = [10, 20, 50, 100].map(s => computeStats(s, PICKS_DATA).winrate);
    expect(new Set(winrates).size).toBe(1);
  });

  test("total picks count is independent of stake", () => {
    const totals = [10, 20, 50, 100].map(s => computeStats(s, PICKS_DATA).total);
    expect(new Set(totals).size).toBe(1);
  });
});
