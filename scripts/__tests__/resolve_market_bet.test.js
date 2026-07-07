/**
 * Tests for resolveMarketBet — the engine that determines win/loss for every market type.
 * Extracted from api_server.js for isolated testing.
 */

function resolveMarketBet(bet, h, a, htTotal) {
  const total = h + a;
  switch (bet) {
    case "Over 2.5 buts":  return total > 2.5 ? "win" : "loss";
    case "Under 2.5 buts": return total < 2.5 ? "win" : "loss";
    case "Over 1.5 buts":  return total > 1.5 ? "win" : "loss";
    case "Under 1.5 buts": return total < 1.5 ? "win" : "loss";
    case "Over 3.5 buts":  return total > 3.5 ? "win" : "loss";
    case "Under 3.5 buts": return total < 3.5 ? "win" : "loss";
    case "BTTS Oui":       return (h > 0 && a > 0) ? "win" : "loss";
    case "BTTS Non":       return (h > 0 && a > 0) ? "loss" : "win";
    case "Victoire domicile":  return h > a ? "win" : "loss";
    case "Victoire extérieur": return a > h ? "win" : "loss";
    case "Match nul":      return h === a ? "win" : "loss";
    case "Double chance 1X": return h >= a ? "win" : "loss";
    case "Double chance X2": return a >= h ? "win" : "loss";
    case "Double chance 12": return h !== a ? "win" : "loss";
    case "But en 1ère mi-temps":       return htTotal == null ? null : (htTotal > 0 ? "win" : "loss");
    case "Aucun but en 1ère mi-temps": return htTotal == null ? null : (htTotal === 0 ? "win" : "loss");
    default: return null;
  }
}

describe("resolveMarketBet", () => {

  describe("Over/Under 2.5", () => {
    test("3-0 is Over 2.5 WIN", () => expect(resolveMarketBet("Over 2.5 buts", 3, 0)).toBe("win"));
    test("2-1 is Over 2.5 WIN", () => expect(resolveMarketBet("Over 2.5 buts", 2, 1)).toBe("win"));
    test("1-1 is Over 2.5 LOSS", () => expect(resolveMarketBet("Over 2.5 buts", 1, 1)).toBe("loss"));
    test("0-0 is Over 2.5 LOSS", () => expect(resolveMarketBet("Over 2.5 buts", 0, 0)).toBe("loss"));
    test("1-0 is Under 2.5 WIN", () => expect(resolveMarketBet("Under 2.5 buts", 1, 0)).toBe("win"));
    test("2-1 is Under 2.5 LOSS", () => expect(resolveMarketBet("Under 2.5 buts", 2, 1)).toBe("loss"));
    test("0-0 is Under 2.5 WIN", () => expect(resolveMarketBet("Under 2.5 buts", 0, 0)).toBe("win"));
  });

  describe("Over/Under 1.5", () => {
    test("2-0 is Over 1.5 WIN", () => expect(resolveMarketBet("Over 1.5 buts", 2, 0)).toBe("win"));
    test("1-0 is Over 1.5 LOSS", () => expect(resolveMarketBet("Over 1.5 buts", 1, 0)).toBe("loss"));
    test("0-0 is Under 1.5 WIN", () => expect(resolveMarketBet("Under 1.5 buts", 0, 0)).toBe("win"));
    test("1-1 is Under 1.5 LOSS", () => expect(resolveMarketBet("Under 1.5 buts", 1, 1)).toBe("loss"));
  });

  describe("Over/Under 3.5", () => {
    test("3-1 is Over 3.5 WIN", () => expect(resolveMarketBet("Over 3.5 buts", 3, 1)).toBe("win"));
    test("2-1 is Over 3.5 LOSS", () => expect(resolveMarketBet("Over 3.5 buts", 2, 1)).toBe("loss"));
    test("1-1 is Under 3.5 WIN", () => expect(resolveMarketBet("Under 3.5 buts", 1, 1)).toBe("win"));
    test("2-2 is Under 3.5 LOSS", () => expect(resolveMarketBet("Under 3.5 buts", 2, 2)).toBe("loss"));
  });

  describe("BTTS", () => {
    test("1-1 is BTTS Oui WIN", () => expect(resolveMarketBet("BTTS Oui", 1, 1)).toBe("win"));
    test("2-0 is BTTS Oui LOSS", () => expect(resolveMarketBet("BTTS Oui", 2, 0)).toBe("loss"));
    test("0-0 is BTTS Oui LOSS", () => expect(resolveMarketBet("BTTS Oui", 0, 0)).toBe("loss"));
    test("2-0 is BTTS Non WIN", () => expect(resolveMarketBet("BTTS Non", 2, 0)).toBe("win"));
    test("1-1 is BTTS Non LOSS", () => expect(resolveMarketBet("BTTS Non", 1, 1)).toBe("loss"));
    test("0-0 is BTTS Non WIN", () => expect(resolveMarketBet("BTTS Non", 0, 0)).toBe("win"));
  });

  describe("Victoire (1X2)", () => {
    test("2-1 is Victoire domicile WIN", () => expect(resolveMarketBet("Victoire domicile", 2, 1)).toBe("win"));
    test("1-2 is Victoire domicile LOSS", () => expect(resolveMarketBet("Victoire domicile", 1, 2)).toBe("loss"));
    test("1-1 is Victoire domicile LOSS", () => expect(resolveMarketBet("Victoire domicile", 1, 1)).toBe("loss"));
    test("1-2 is Victoire extérieur WIN", () => expect(resolveMarketBet("Victoire extérieur", 1, 2)).toBe("win"));
    test("2-1 is Victoire extérieur LOSS", () => expect(resolveMarketBet("Victoire extérieur", 2, 1)).toBe("loss"));
    test("1-1 is Victoire extérieur LOSS", () => expect(resolveMarketBet("Victoire extérieur", 1, 1)).toBe("loss"));
    test("1-1 is Match nul WIN", () => expect(resolveMarketBet("Match nul", 1, 1)).toBe("win"));
    test("2-1 is Match nul LOSS", () => expect(resolveMarketBet("Match nul", 2, 1)).toBe("loss"));
    test("0-0 is Match nul WIN", () => expect(resolveMarketBet("Match nul", 0, 0)).toBe("win"));
  });

  describe("Double chance", () => {
    test("2-1 is Double chance 1X WIN (domicile gagne)", () => expect(resolveMarketBet("Double chance 1X", 2, 1)).toBe("win"));
    test("1-1 is Double chance 1X WIN (nul)", () => expect(resolveMarketBet("Double chance 1X", 1, 1)).toBe("win"));
    test("0-1 is Double chance 1X LOSS (extérieur gagne)", () => expect(resolveMarketBet("Double chance 1X", 0, 1)).toBe("loss"));
    test("1-2 is Double chance X2 WIN (extérieur gagne)", () => expect(resolveMarketBet("Double chance X2", 1, 2)).toBe("win"));
    test("1-1 is Double chance X2 WIN (nul)", () => expect(resolveMarketBet("Double chance X2", 1, 1)).toBe("win"));
    test("2-0 is Double chance X2 LOSS (domicile gagne)", () => expect(resolveMarketBet("Double chance X2", 2, 0)).toBe("loss"));
    test("2-1 is Double chance 12 WIN (pas nul)", () => expect(resolveMarketBet("Double chance 12", 2, 1)).toBe("win"));
    test("1-1 is Double chance 12 LOSS (nul)", () => expect(resolveMarketBet("Double chance 12", 1, 1)).toBe("loss"));
  });

  describe("Mi-temps", () => {
    test("HT 1 but is But en 1ère mi-temps WIN", () => expect(resolveMarketBet("But en 1ère mi-temps", 1, 0, 1)).toBe("win"));
    test("HT 0 buts is But en 1ère mi-temps LOSS", () => expect(resolveMarketBet("But en 1ère mi-temps", 1, 0, 0)).toBe("loss"));
    test("HT null is But en 1ère mi-temps NULL", () => expect(resolveMarketBet("But en 1ère mi-temps", 1, 0, null)).toBeNull());
    test("HT 0 is Aucun but en 1ère mi-temps WIN", () => expect(resolveMarketBet("Aucun but en 1ère mi-temps", 1, 0, 0)).toBe("win"));
    test("HT 2 is Aucun but en 1ère mi-temps LOSS", () => expect(resolveMarketBet("Aucun but en 1ère mi-temps", 1, 1, 2)).toBe("loss"));
  });

  describe("Edge cases — scores critiques", () => {
    test("0-0 Under 2.5 WIN", () => expect(resolveMarketBet("Under 2.5 buts", 0, 0)).toBe("win"));
    test("1-2 Under 2.5 LOSS (total=3)", () => expect(resolveMarketBet("Under 2.5 buts", 1, 2)).toBe("loss"));
    test("0-3 Over 2.5 WIN", () => expect(resolveMarketBet("Over 2.5 buts", 0, 3)).toBe("win"));
    test("3-0 BTTS Non WIN", () => expect(resolveMarketBet("BTTS Non", 3, 0)).toBe("win"));
    test("0-0 Match nul WIN", () => expect(resolveMarketBet("Match nul", 0, 0)).toBe("win"));
    test("0-0 Double chance 1X WIN", () => expect(resolveMarketBet("Double chance 1X", 0, 0)).toBe("win"));
    test("0-0 Double chance X2 WIN", () => expect(resolveMarketBet("Double chance X2", 0, 0)).toBe("win"));
    test("0-0 Victoire domicile LOSS", () => expect(resolveMarketBet("Victoire domicile", 0, 0)).toBe("loss"));
  });

  describe("Regression: a losing bet must NEVER be marked as winning", () => {
    // Score 2-1: Under 2.5 is LOSS (3 goals > 2.5)
    test("2-1 Under 2.5 must be LOSS, not WIN", () => {
      expect(resolveMarketBet("Under 2.5 buts", 2, 1)).toBe("loss");
    });
    // Score 0-0: Over 2.5 is LOSS (0 goals < 2.5)
    test("0-0 Over 2.5 must be LOSS, not WIN", () => {
      expect(resolveMarketBet("Over 2.5 buts", 0, 0)).toBe("loss");
    });
    // Score 1-0: BTTS Oui is LOSS (only home scored)
    test("1-0 BTTS Oui must be LOSS", () => {
      expect(resolveMarketBet("BTTS Oui", 1, 0)).toBe("loss");
    });
    // Score 2-0: Victoire extérieur is LOSS
    test("2-0 Victoire extérieur must be LOSS", () => {
      expect(resolveMarketBet("Victoire extérieur", 2, 0)).toBe("loss");
    });
    // Score 1-1: Victoire domicile is LOSS (draw, not home win)
    test("1-1 Victoire domicile must be LOSS (draw is not home win)", () => {
      expect(resolveMarketBet("Victoire domicile", 1, 1)).toBe("loss");
    });
  });
});
