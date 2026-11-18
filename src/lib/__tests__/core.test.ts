import { describe, expect, it } from "vitest";
import { computeSplit, settledTotal, sponsorThanks, summarizeTotals, teamFromAmount, type SplitItem, type SplitPlayer } from "../split";
import { allocate } from "../ledger";
import { buildVietQr, crc16 } from "../vietqr";
import { parseTransferContent } from "../reconcile";
import { suggestCode } from "../text";
import { transferContent } from "../reconcile";
import { bankAppDeeplink } from "../vietqr";
import { buildSummaryText } from "../zalo";

const item = (p: Partial<SplitItem>): SplitItem => ({
  id: p.name ?? "x",
  name: "x",
  amount: 0,
  rule: "all",
  loserPct: 70,
  bearer: "loser",
  includeNonEaters: true,
  drawMode: "half",
  ...p,
});

// 7 đấu 7: id 1-7 đội A, 8-14 đội B; id 9 (đội B) không đi ăn
const players: SplitPlayer[] = Array.from({ length: 14 }, (_, i) => ({
  memberId: i + 1,
  team: i < 7 ? "A" : "B",
  ate: i + 1 !== 9,
}));
const by = (r: ReturnType<typeof computeSplit>, id: number) => r.players.find((p) => p.memberId === id)!;

describe("computeSplit", () => {
  const items = [
    item({ name: "Tiền sân", amount: 600_000, rule: "ratio", loserPct: 50 }),
    item({ name: "Tiền ăn", amount: 1_200_000, rule: "eaters" }),
    item({ name: "Bia + gà", amount: 500_000, rule: "bet" }),
  ];

  it("kèo 50/50 + bia gà, đội A thua", () => {
    const r = computeSplit(players, items, 2, 4);
    expect(r.loser).toBe("A");
    // sân 300k/7 = 42.857 → 43k; ăn 1.2tr/13 = 92.3k → 93k; kèo 500k/7 = 71.4k → 72k
    expect(by(r, 1).total).toBe(43_000 + 93_000 + 72_000);
    expect(by(r, 8).total).toBe(43_000 + 93_000);
    expect(by(r, 9).total).toBe(43_000); // thắng, không ăn
  });

  it("người đội thua không ăn vẫn góp kèo (mặc định)", () => {
    const ps = players.map((p) => (p.memberId === 2 ? { ...p, ate: false } : p));
    const r = computeSplit(ps, items, 0, 1);
    expect(by(r, 2).lines.map((l) => l.name)).toEqual(["Tiền sân", "Bia + gà"]);
  });

  it("tắt tuỳ chọn: người không ăn không góp kèo", () => {
    const ps = players.map((p) => (p.memberId === 2 ? { ...p, ate: false } : p));
    const r = computeSplit(
      ps,
      [item({ name: "Gà", amount: 600_000, rule: "bet", includeNonEaters: false })],
      0,
      1,
    );
    expect(by(r, 2).total).toBe(0);
    expect(by(r, 1).total).toBe(100_000); // 600k / 6 người ăn
  });

  it("tỷ lệ 7/3", () => {
    const r = computeSplit(players, [item({ name: "Sân", amount: 700_000, rule: "ratio" })], 3, 1);
    expect(r.loser).toBe("B");
    expect(by(r, 8).total).toBe(70_000); // 490k / 7
    expect(by(r, 1).total).toBe(30_000); // 210k / 7
  });

  it("hòa: mặc định 50/50, hoặc chia đều mọi người", () => {
    const r1 = computeSplit(players, [item({ name: "Gà", amount: 700_000, rule: "bet" })], 2, 2);
    expect(by(r1, 1).total).toBe(50_000);
    expect(by(r1, 8).total).toBe(50_000);
    const lop = [...players, { memberId: 99, team: "A" as const, ate: true }]; // 8 vs 7
    const r2 = computeSplit(lop, [item({ name: "Gà", amount: 750_000, rule: "bet", drawMode: "all" })], 1, 1);
    expect(by(r2, 99).total).toBe(50_000);
    expect(by(r2, 8).total).toBe(50_000);
  });

  it("chưa có tỷ số thì chưa tính tiền sân/kèo, nhưng tiền ăn vẫn tính", () => {
    const r = computeSplit(players, items, null, null);
    expect(r.outcome).toBeNull();
    expect(by(r, 1).lines.map((l) => l.name)).toEqual(["Tiền ăn"]);
  });

  it("tóm tắt mức chung và ngoại lệ", () => {
    const t = summarizeTotals(computeSplit(players, items, 2, 4));
    expect(t[0]).toMatchObject({ label: "Đội thua", common: 208_000, exceptions: [] });
    expect(t[1]).toMatchObject({ label: "Đội thắng", common: 136_000 });
    expect(t[1].exceptions).toEqual([{ memberId: 9, total: 43_000, reason: "không ăn" }]);
  });

  it("có người ủng hộ tiền ăn: trừ trước rồi mới chia", () => {
    const sponsored = items.map((i) =>
      i.name === "Tiền ăn" ? { ...i, sponsorAmount: 300_000, sponsorName: "Anh Tuấn" } : i,
    );
    const r = computeSplit(players, sponsored, 2, 4);
    // ăn: (1.2tr − 300k) / 13 = 69.2k → 70k
    expect(by(r, 1).total).toBe(43_000 + 70_000 + 72_000);
    expect(by(r, 9).total).toBe(43_000); // không ăn → không hưởng/không ảnh hưởng
    expect(r.totalSponsored).toBe(300_000);
    expect(sponsorThanks(r)).toEqual([{ name: "Anh Tuấn", amount: 300_000, items: ["Tiền ăn"] }]);
  });

  it("ủng hộ nhiều hơn khoản chi thì khoản đó về 0, không âm", () => {
    const r = computeSplit(players, [item({ name: "Nước", amount: 100_000, rule: "all", sponsorAmount: 500_000 })], 1, 0);
    expect(by(r, 1).total).toBe(0);
    expect(r.totalSponsored).toBe(100_000);
  });

  it("tin nhắn Zalo ghi lời cảm ơn người ủng hộ", () => {
    const names = new Map(players.map((p) => [p.memberId, `P${p.memberId}`]));
    const sponsored = items.map((i) => (i.name === "Tiền ăn" ? { ...i, sponsorAmount: 300_000, sponsorName: "Anh Tuấn" } : i));
    const txt = buildSummaryText({ teamName: "FC CX", date: "2026-11-15", venue: "", scoreA: 2, scoreB: 4,
      split: computeSplit(players, sponsored, 2, 4), names });
    expect(txt).toContain("Tiền ăn 1.200k − 300k ủng hộ");
    expect(txt).toContain("🎁 Cảm ơn Anh Tuấn đã ủng hộ 300k tiền ăn!");
    expect(txt).toContain("Đội thua: 185k/người");
  });

  it("tin nhắn Zalo", () => {
    const names = new Map(players.map((p) => [p.memberId, `P${p.memberId}`]));
    const txt = buildSummaryText({
      teamName: "FC CX",
      date: "2026-11-15",
      venue: "Sân X",
      scoreA: 2,
      scoreB: 4,
      split: computeSplit(players, items, 2, 4),
      names,
    });
    expect(txt).toContain("Đội thua: 208k/người");
    expect(txt).toContain("P9 (không ăn): 43k");
  });
});

describe("allocate (FIFO)", () => {
  const d = (s: string) => new Date(s);
  it("trả gộp, trả thiếu, trả dư", () => {
    const r = allocate(
      [
        { matchId: 2, date: "2026-11-08", amount: 150_000 },
        { matchId: 1, date: "2026-11-01", amount: 100_000 },
        { matchId: 3, date: "2026-11-15", amount: 200_000 },
      ],
      [
        { amount: 200_000, at: d("2026-11-09T12:00:00Z") },
        { amount: 100_000, at: d("2026-11-16T12:00:00Z") },
      ],
    );
    expect(r.charges.map((c) => [c.matchId, c.status, c.remaining])).toEqual([
      [1, "paid", 0],
      [2, "paid", 0],
      [3, "partial", 150_000],
    ]);
    expect(r.charges[1].paidAt).toEqual(d("2026-11-16T12:00:00Z"));
    expect(r.balance).toBe(-150_000);

    const over = allocate([{ matchId: 1, date: "2026-11-01", amount: 100_000 }], [{ amount: 150_000, at: d("2026-11-02") }]);
    expect(over.balance).toBe(50_000);
  });

  it("chủ tài khoản: phần còn nợ tự coi là đã trả, khoản đã ghi vẫn giữ", () => {
    const r = allocate(
      [
        { matchId: 1, date: "2026-11-01", amount: 100_000 },
        { matchId: 2, date: "2026-11-08", amount: 120_000 },
      ],
      [{ amount: 100_000, at: d("2026-11-02"), matchId: 1 }],
      { selfFunded: true },
    );
    expect(r.charges.map((c) => [c.status, c.remaining])).toEqual([
      ["paid", 0],
      ["paid", 0],
    ]);
    expect(r.charges[0].paidAt).toEqual(d("2026-11-02"));
    expect(r.charges[1].paidAt).toBeNull();
    expect(r.balance).toBe(0);
    expect(r.totalPaid).toBe(220_000);
  });
});

describe("vietqr", () => {
  it("crc16 chuẩn CCITT-FALSE", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
  it("QR tĩnh không có số tiền", () => {
    const s = buildVietQr({ bankBin: "970422", accountNo: "0123456789", content: "TB HUNG" });
    expect(s.startsWith("000201010211")).toBe(true);
    expect(s).toContain("0010A000000727");
    expect(s).toContain("0807TB HUNG");
    expect(s).not.toContain("5406");
    expect(s.slice(-8, -4)).toBe("6304");
    expect(s.slice(-4)).toBe(crc16(s.slice(0, -4)));
  });
  it("QR động có số tiền", () => {
    const s = buildVietQr({ bankBin: "970422", accountNo: "01", amount: 172000, content: "TB HUNG" });
    expect(s).toContain("010212");
    expect(s).toContain("5406172000");
  });
});

describe("parseTransferContent", () => {
  const codes = ["HUNG", "HUNGA", "NAM", "VHUNG"];
  it.each([
    ["TB HUNG", "HUNG"],
    ["tb hùng", "HUNG"],
    ["MBVCB.1234.TB HUNG.CT tu 0123 NGUYEN VAN HUNG", "HUNG"],
    ["TBHUNG chuyen tien", "HUNG"],
    ["TB HUNGA", "HUNGA"],
    ["123TBNAM", "NAM"],
    ["FT25 TB-NAM", "NAM"],
  ])("%s → %s", (raw, code) => {
    expect(parseTransferContent(raw, "TB", codes)).toEqual({ hasPrefix: true, code });
  });
  it("có mã đội nhưng sai tên → chờ admin xác nhận, không gán nhầm", () => {
    expect(parseTransferContent("TB TUAN", "TB", codes)).toEqual({ hasPrefix: true, code: null });
    expect(parseTransferContent("TB HUNGGG", "TB", codes)).toEqual({ hasPrefix: true, code: null });
    expect(parseTransferContent("TB TUAN", "TB", [...codes, "TU"])).toEqual({ hasPrefix: true, code: null });
    expect(parseTransferContent("TBTUAN", "TB", [...codes, "TU"])).toEqual({ hasPrefix: true, code: null });
  });
  it("chuyển việc riêng", () => {
    expect(parseTransferContent("tra tien cafe", "TB", codes)).toEqual({ hasPrefix: false, code: null });
  });
});

describe("suggestCode", () => {
  it("tên đệm + tên, phân biệt người trùng tên", () => {
    expect(suggestCode("Trần Quang Ngọc", [])).toBe("QUANG NGOC");
    expect(suggestCode("Lê Bảo Ngọc", ["QUANG NGOC"])).toBe("BAO NGOC");
    expect(suggestCode("Nguyễn Văn Hùng", [])).toBe("VAN HUNG");
    expect(suggestCode("Phan Văn Hùng", ["VAN HUNG"])).toBe("P VAN HUNG");
    expect(suggestCode("Phan Văn Hùng", ["VAN HUNG", "P VAN HUNG"])).toBe("VAN HUNG 2");
    expect(suggestCode("Đức", [])).toBe("DUC");
    // quá 11 ký tự (kể cả dấu cách) → chỉ lấy tên
    expect(suggestCode("Lê Nghiêm Trường", [])).toBe("TRUONG"); // "NGHIEM TRUONG" 13 ký tự
  });
});

describe("nội dung chuyển khoản & deeplink", () => {
  it("ghép mã đội + mã + phần thêm", () => {
    expect(transferContent("cx", "HUNG", "CK da bong")).toBe("CX HUNG CK da bong");
    expect(transferContent("CX", "HUNG")).toBe("CX HUNG");
  });
  it("vẫn nhận ra người khi có phần thêm phía sau", () => {
    expect(parseTransferContent("CX HUNG CK da bong", "CX", ["HUNG", "NAM"])).toEqual({ hasPrefix: true, code: "HUNG" });
    expect(parseTransferContent("MBVCB.123.CX HUNG CK da bong.CT tu 0123", "CX", ["HUNG"]).code).toBe("HUNG");
  });
  it("deeplink VietQR đúng tham số", () => {
    const u = new URL(
      bankAppDeeplink({ app: "mb", bankBin: "970422", accountNo: "0123", accountName: "NGUYEN VAN A", amount: 172000, content: "CX HUNG CK da bong", returnUrl: "https://x/" })!,
    );
    expect(u.origin + u.pathname).toBe("https://dl.vietqr.io/pay");
    expect(Object.fromEntries(u.searchParams)).toEqual({
      app: "mb", ba: "0123@mb", am: "172000", tn: "CX HUNG CK da bong", url: "https://x/", bn: "NGUYEN VAN A",
    });
  });
});

describe("tên đội", () => {
  const items = [item({ name: "Sân", amount: 700_000, rule: "ratio" })];
  it("mặc định Đội Nhất / Đội Bét trong nhãn chia tiền", () => {
    const r = computeSplit(players, items, 3, 1);
    expect(r.items[0].groups.map((g) => g.label)).toEqual(["Đội Nhất (thắng)", "Đội Bét (thua)"]);
  });
  it("đổi tên được, và tin Zalo dùng tên mới", () => {
    const tn = { A: "Áo đỏ", B: "Áo xanh" };
    const r = computeSplit(players, items, 1, 1, tn);
    expect(r.items[0].groups.map((g) => g.label)).toEqual(["Đội Áo đỏ (hoà)", "Đội Áo xanh (hoà)"]);
    const txt = buildSummaryText({ teamName: "FC CX", date: "2026-11-15", venue: "", scoreA: 1, scoreB: 1, split: r,
      names: new Map(players.map((p) => [p.memberId, `P${p.memberId}`])), teamNames: tn });
    expect(txt).toContain("Đội Áo đỏ 1–1 Đội Áo xanh");
  });
});

describe("người chỉ ăn", () => {
  // 2 đấu 2 + 1 người chỉ ăn (id 9)
  const ps: SplitPlayer[] = [
    { memberId: 1, team: "A", ate: true },
    { memberId: 2, team: "A", ate: false },
    { memberId: 3, team: "B", ate: true },
    { memberId: 4, team: "B", ate: true },
    { memberId: 9, team: null, ate: false }, // chỉ ăn → luôn tính là ăn
  ];
  const items = [
    item({ name: "Sân", amount: 400_000, rule: "ratio", loserPct: 50 }),
    item({ name: "Ăn", amount: 400_000, rule: "eaters" }),
    item({ name: "Nước", amount: 40_000, rule: "all" }),
    item({ name: "Gà", amount: 200_000, rule: "bet" }),
  ];
  const r = computeSplit(ps, items, 1, 0);
  it("chỉ góp tiền ăn, không chịu sân / kèo / chia đều", () => {
    expect(by(r, 9).lines.map((l) => [l.name, l.amount])).toEqual([["Ăn", 100_000]]); // 400k / 4 người ăn
  });
  it("người đá vẫn chia sân / nước / kèo như cũ", () => {
    expect(by(r, 3).total).toBe(100_000 + 100_000 + 10_000 + 100_000); // B thua: sân 200k/2, ăn, nước 40k/4, gà 200k/2
    expect(by(r, 2).total).toBe(100_000 + 10_000); // A thắng, không ăn
  });
  it("tóm tắt có nhóm Chỉ ăn ở cuối", () => {
    const t = summarizeTotals(r);
    expect(t.at(-1)).toMatchObject({ team: null, label: "Chỉ ăn", common: 100_000, commonCount: 1 });
  });
});

describe("mã nhiều chữ", () => {
  const codes = ["QUANG NGOC", "BAO NGOC", "VAN HUNG", "P VAN HUNG", "NGOC"];
  it.each([
    ["CX QUANG NGOC CK da bong", "QUANG NGOC"],
    ["cx bảo ngọc ck đá bóng", "BAO NGOC"],
    ["CX QUANGNGOC CK da bong", "QUANG NGOC"],
    ["CXQUANG NGOC", "QUANG NGOC"],
    ["CXBAONGOC", "BAO NGOC"],
    ["MBVCB.12.CX P VAN HUNG CK da bong.CT tu", "P VAN HUNG"],
    ["CX VAN HUNG CK", "VAN HUNG"],
    ["CX NGOC CK", "NGOC"],
    ["FT123CXQUANGNGOC", "QUANG NGOC"],
  ])("%s → %s", (raw, code) => {
    expect(parseTransferContent(raw, "CX", codes)).toEqual({ hasPrefix: true, code });
  });
  it("không gán nhầm khi chỉ trùng một phần", () => {
    expect(parseTransferContent("CX QUANG CK", "CX", codes)).toEqual({ hasPrefix: true, code: null });
    expect(parseTransferContent("CX HUNG", "CX", codes)).toEqual({ hasPrefix: true, code: null });
  });
});

describe("chưa chọn đội (tự chọn khi đóng tiền)", () => {
  // 3 đã chọn đội + 3 chưa chọn; admin nhập mỗi đội 3 người. Đội A thắng.
  const ps: SplitPlayer[] = [
    { memberId: 1, team: "A", ate: true },
    { memberId: 2, team: "A", ate: true },
    { memberId: 3, team: "B", ate: true },
    { memberId: 4, team: null, ate: true, pending: true },
    { memberId: 5, team: null, ate: false, pending: true },
    { memberId: 6, team: null, ate: true, pending: true },
  ];
  const items = [
    item({ name: "Sân", amount: 600_000, rule: "ratio", loserPct: 70 }), // thua 420k/3 = 140k, thắng 180k/3 = 60k
    item({ name: "Ăn", amount: 500_000, rule: "eaters" }), // 5 người ăn → 100k
  ];
  const r = computeSplit(ps, items, 2, 1, undefined, { A: 3, B: 3 });
  it("người đã chọn đội: chia theo số người admin nhập, không phụ thuộc ai chọn sau", () => {
    expect(by(r, 1).total).toBe(60_000 + 100_000);
    expect(by(r, 3).total).toBe(140_000 + 100_000);
  });
  it("người chưa chọn: chỉ tạm tính tiền ăn, kèm 2 mức theo đội", () => {
    expect(by(r, 4)).toMatchObject({ pending: true, total: 100_000, choices: { A: 160_000, B: 240_000 } });
    expect(by(r, 5).choices).toEqual({ A: 60_000, B: 140_000 }); // không ăn
    expect(settledTotal(by(r, 4))).toBeNull();
    expect(teamFromAmount(by(r, 4), 240_000)).toBe("B");
    expect(teamFromAmount(by(r, 4), 200_000)).toBeNull();
  });
  it("hai đội cùng mức (sân 50/50) → đội không quan trọng, tính tiền luôn", () => {
    const r2 = computeSplit(ps, [item({ name: "Sân", amount: 600_000, rule: "ratio", loserPct: 50 })], 2, 1, undefined, { A: 3, B: 3 });
    expect(settledTotal(by(r2, 4))).toBe(100_000);
    expect(teamFromAmount(by(r2, 4), 100_000)).toBeNull();
  });
  it("không nằm trong nhóm đội / chỉ ăn của bảng tóm tắt", () => {
    const labels = summarizeTotals(r).map((t) => [t.label, t.commonCount]);
    expect(labels).toEqual([["Đội thua", 1], ["Đội thắng", 2]]);
  });
});

describe("allocate – khoản gắn trận", () => {
  const d = (s: string) => new Date(s);
  it("chuyển đúng tiền trận mới → không bị trừ vào trận cũ", () => {
    const r = allocate(
      [
        { matchId: 1, date: "2026-11-01", amount: 100_000 },
        { matchId: 2, date: "2026-11-08", amount: 150_000 },
      ],
      [{ amount: 150_000, at: d("2026-11-09"), matchId: 2 }],
    );
    expect(r.charges.map((c) => [c.matchId, c.status])).toEqual([
      [1, "unpaid"],
      [2, "paid"],
    ]);
  });
  it("khoản không gắn trận vẫn trừ trận cũ trước; phần thừa của khoản gắn trận cũng vậy", () => {
    const r = allocate(
      [
        { matchId: 1, date: "2026-11-01", amount: 100_000 },
        { matchId: 2, date: "2026-11-08", amount: 150_000 },
      ],
      [{ amount: 200_000, at: d("2026-11-09"), matchId: 2 }],
    );
    expect(r.charges.map((c) => [c.matchId, c.status, c.remaining])).toEqual([
      [1, "partial", 50_000],
      [2, "paid", 0],
    ]);
  });
});

describe("tiền ăn 50/50 theo đội (chỉ tính người ăn)", () => {
  const an5050 = item({ name: "Ăn", amount: 1_200_000, rule: "ratio", loserPct: 50, eatersOnly: true });
  it("mỗi đội chịu 50%, chia cho người có ăn của đội", () => {
    // đội A: 3 người ăn; đội B: 2 người ăn + 1 không ăn
    const ps: SplitPlayer[] = [
      { memberId: 1, team: "A", ate: true },
      { memberId: 2, team: "A", ate: true },
      { memberId: 3, team: "A", ate: true },
      { memberId: 4, team: "B", ate: true },
      { memberId: 5, team: "B", ate: true },
      { memberId: 6, team: "B", ate: false },
    ];
    const r = computeSplit(ps, [an5050], 2, 1);
    expect(by(r, 1).total).toBe(200_000); // 600k / 3
    expect(by(r, 4).total).toBe(300_000); // 600k / 2
    expect(by(r, 6).total).toBe(0);
  });
  it("người chỉ ăn trả mức trung bình, phần còn lại chia 50/50", () => {
    const ps: SplitPlayer[] = [
      { memberId: 1, team: "A", ate: true },
      { memberId: 2, team: "B", ate: true },
      { memberId: 9, team: null, ate: true },
    ];
    const r = computeSplit(ps, [an5050], 1, 0);
    expect(by(r, 9).total).toBe(400_000); // 1.2tr / 3 người ăn
    expect(by(r, 1).total).toBe(400_000); // (1.2tr − 400k) / 2
    expect(by(r, 2).total).toBe(400_000);
  });
});

describe("ăn 50/50 khi còn người chưa chọn đội", () => {
  it("người chọn đội sớm không phải gánh phần ăn của người chưa chọn", () => {
    // mỗi đội 3 người; đã chọn: A1(ăn) B1(ăn); chưa chọn: 4 người đều ăn
    const ps: SplitPlayer[] = [
      { memberId: 1, team: "A", ate: true },
      { memberId: 2, team: "B", ate: true },
      ...[3, 4, 5, 6].map((id) => ({ memberId: id, team: null, ate: true, pending: true })),
    ];
    const an = item({ name: "Ăn", amount: 600_000, rule: "ratio", loserPct: 50, eatersOnly: true });
    const r = computeSplit(ps, [an], 1, 0, undefined, { A: 3, B: 3 });
    expect(by(r, 1).total).toBe(100_000); // 300k / 3 người ăn dự kiến của đội A
    expect(by(r, 3).choices).toEqual({ A: 100_000, B: 100_000 });
  });
});

describe("đá đối (không chia đội)", () => {
  const ps: SplitPlayer[] = [
    { memberId: 1, team: null, ate: true, pending: true },
    { memberId: 2, team: null, ate: false, pending: true },
    { memberId: 3, team: "A", ate: true },
  ];
  const items = [
    item({ name: "Sân", amount: 300_000, rule: "all" }),
    item({ name: "Ăn", amount: 200_000, rule: "eaters" }),
  ];
  it("không cần tỷ số / chọn đội vẫn ghi nợ được", () => {
    const r = computeSplit(ps, items, null, null);
    expect(settledTotal(by(r, 1))).toBe(200_000);
    expect(settledTotal(by(r, 2))).toBe(100_000);
  });
  it("trận nội bộ chưa có tỷ số thì vẫn chờ", () => {
    const r = computeSplit(ps, [...items, item({ name: "Sân 7/3", amount: 100_000, rule: "ratio" })], null, null);
    expect(settledTotal(by(r, 1))).toBeNull();
  });
});
