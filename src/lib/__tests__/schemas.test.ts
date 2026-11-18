import { describe, expect, it } from "vitest";
import {
  manualPaymentSchema,
  matchSchema,
  memberCreateSchema,
  sepaySchema,
  settingsSchema,
  toFieldErrors,
  type MatchInput,
} from "../schemas";

const errs = (r: { success: boolean; error?: unknown }) =>
  r.success ? {} : toFieldErrors((r as { error: Parameters<typeof toFieldErrors>[0] }).error);

describe("memberCreateSchema", () => {
  it("chuẩn hoá mã: bỏ dấu, in hoa", () => {
    expect(memberCreateSchema.parse({ name: "Nguyễn Văn Hùng", code: "hùng" })).toEqual({ name: "Nguyễn Văn Hùng", code: "HUNG" });
  });
  it("mã để trống thì hợp lệ (server tự tạo)", () => {
    expect(memberCreateSchema.parse({ name: "Nam", code: "" }).code).toBe("");
  });
  it("từ chối tên có số / ký tự lạ và mã quá ngắn", () => {
    expect(errs(memberCreateSchema.safeParse({ name: "H", code: "" }))).toHaveProperty("name");
    expect(errs(memberCreateSchema.safeParse({ name: "Hùng123", code: "" }))).toHaveProperty("name");
    expect(errs(memberCreateSchema.safeParse({ name: "Hùng", code: "H" }))).toHaveProperty("code");
    expect(errs(memberCreateSchema.safeParse({ name: "Hùng", code: "HU-NG" }))).toHaveProperty("code");
  });
});

describe("settingsSchema", () => {
  const base = { teamName: "FC CX", prefix: "cx", bankBin: "", accountNo: "", accountName: "", dedicatedAccount: "on", transferSuffix: "CK đá bóng", defaultVenue: "Sân bóng Mai Về", defaultTime: "18:00", teamAName: "Nhất", teamBName: "Bét" };
  it("cho phép để trống toàn bộ thông tin ngân hàng", () => {
    expect(settingsSchema.parse(base)).toMatchObject({ prefix: "CX", dedicatedAccount: true, transferSuffix: "CK da bong", treasurerId: null });
    expect(settingsSchema.parse({ ...base, treasurerId: "" }).treasurerId).toBeNull();
    expect(settingsSchema.parse({ ...base, treasurerId: "7" }).treasurerId).toBe(7);
    expect(settingsSchema.safeParse({ ...base, treasurerId: "abc" }).success).toBe(false);
  });
  it("đã nhập 1 ô ngân hàng thì phải đủ cả 3", () => {
    const e = errs(settingsSchema.safeParse({ ...base, bankBin: "970422" }));
    expect(Object.keys(e).sort()).toEqual(["accountName", "accountNo"]);
  });
  it("chuẩn hoá tên chủ TK và số TK", () => {
    const v = settingsSchema.parse({ ...base, bankBin: "970422", accountNo: "0123 456 789", accountName: "Nguyễn  Văn A" });
    expect(v).toMatchObject({ accountNo: "0123456789", accountName: "NGUYEN VAN A" });
  });
  it("nội dung QR không vượt 25 ký tự với mã dài nhất (8)", () => {
    // CX + mã 8 + "chuyen khoan da bong" = 2+1+8+1+20 = 32 > 25
    expect(errs(settingsSchema.safeParse({ ...base, transferSuffix: "chuyển khoản đá bóng" }))).toHaveProperty("transferSuffix");
    // CX + 8 + "CK da bong" = 22 ≤ 25
    expect(settingsSchema.safeParse({ ...base, transferSuffix: "CK da bong" }).success).toBe(true);
    expect(settingsSchema.parse({ ...base, transferSuffix: "" }).transferSuffix).toBe("");
  });
  it("từ chối ngân hàng lạ, số TK có chữ", () => {
    const e = errs(settingsSchema.safeParse({ ...base, bankBin: "123", accountNo: "12ab", accountName: "A B" }));
    expect(e).toHaveProperty("bankBin");
    expect(e).toHaveProperty("accountNo");
  });
});

describe("manualPaymentSchema", () => {
  it("nhận số tiền có dấu chấm", () => {
    expect(manualPaymentSchema.parse({ memberId: "3", amount: "172.000", note: "" }).amount).toBe(172000);
  });
  it("từ chối tiền quá nhỏ / quá lớn / chưa chọn người", () => {
    expect(errs(manualPaymentSchema.safeParse({ memberId: "3", amount: "500" }))).toHaveProperty("amount");
    expect(errs(manualPaymentSchema.safeParse({ memberId: "3", amount: "60000000" }))).toHaveProperty("amount");
    expect(errs(manualPaymentSchema.safeParse({ memberId: "", amount: "100000" }))).toHaveProperty("memberId");
  });
});

describe("matchSchema", () => {
  const item = { name: "Tiền sân", amount: 600000, rule: "ratio" as const, loserPct: 70, bearer: "loser" as const, includeNonEaters: true, drawMode: "half" as const, sponsorAmount: 0, sponsorName: "" };
  const ok: MatchInput = {
    date: "2026-11-15", venue: "", timeRange: "", scoreA: 2, scoreB: 1, note: "", published: true,
    players: [{ memberId: 1, team: "A", ate: true }, { memberId: 2, team: "B", ate: true }],
    items: [item],
  };
  it("hợp lệ", () => expect(matchSchema.safeParse(ok).success).toBe(true));
  it("đá đối: không cần tỷ số / 2 đội, ai đá cũng vào chung một nhóm", () => {
    const r = matchSchema.safeParse({
      ...ok,
      scoreA: null,
      scoreB: null,
      players: [{ memberId: 1, team: null, ate: true, pending: true }, { memberId: 2, team: "B", ate: false }, { memberId: 3, team: null, ate: true }],
      items: [{ ...item, rule: "all" as const }],
    });
    expect(r.success).toBe(true);
    expect(r.data!.players.map((p) => [p.team, p.pending])).toEqual([["A", false], ["A", false], [null, false]]);
  });
  it("công bố: có tiền ăn mà không ai đi ăn thì báo lỗi", () => {
    const noEat = [{ memberId: 1, team: "A" as const, ate: false }, { memberId: 2, team: "B" as const, ate: false }];
    const food = { ...item, name: "Tiền ăn", amount: 300000, rule: "eaters" as const };
    expect(errs(matchSchema.safeParse({ ...ok, players: noEat, items: [item, food] }))).toHaveProperty("items.1.amount");
    expect(matchSchema.safeParse({ ...ok, players: noEat, items: [item] }).success).toBe(true);
    expect(matchSchema.safeParse({ ...ok, items: [item, food] }).success).toBe(true);
  });
  it("người ủng hộ là thành viên: phải có trong trận; không ủng hộ thì bỏ thông tin người ủng hộ", () => {
    const food = { ...item, name: "Tiền ăn", amount: 300000, rule: "eaters" as const, sponsorAmount: 100000 };
    expect(matchSchema.safeParse({ ...ok, items: [item, { ...food, sponsorMemberId: 2 }] }).success).toBe(true);
    expect(errs(matchSchema.safeParse({ ...ok, items: [item, { ...food, sponsorMemberId: 9 }] }))).toHaveProperty("items.1.sponsorName");
    expect(errs(matchSchema.safeParse({ ...ok, items: [item, food] }))).toHaveProperty("items.1.sponsorName");
    const cleared = matchSchema.parse({ ...ok, items: [{ ...item, sponsorMemberId: 2, sponsorCash: true, sponsorName: "X" }] });
    expect(cleared.items[0]).toMatchObject({ sponsorMemberId: null, sponsorCash: false, sponsorName: "" });
    const outside = matchSchema.parse({ ...ok, items: [item, { ...food, sponsorName: "Anh Tuấn", sponsorCash: true }] });
    expect(outside.items[1].sponsorCash).toBe(false);
  });
  it("ngày không tồn tại", () => {
    expect(errs(matchSchema.safeParse({ ...ok, date: "2026-02-30" }))).toHaveProperty("date");
  });
  it("công bố thì mỗi đội cần người, khoản chi cần số tiền, ratio cần tỷ số", () => {
    const e = errs(
      matchSchema.safeParse({ ...ok, scoreA: null, scoreB: null, players: [{ memberId: 1, team: "A", ate: true }], items: [{ ...item, amount: 0 }] }),
    );
    expect(e).toHaveProperty("players");
    expect(e).toHaveProperty("items.0.amount");
    expect(e).toHaveProperty("scoreA");
  });
  it("lưu nháp thì cho phép thiếu", () => {
    const r = matchSchema.safeParse({ ...ok, published: false, scoreA: null, scoreB: null, players: [], items: [{ ...item, amount: 0 }] });
    expect(r.success).toBe(true);
  });
  it("Lưu khi đang điểm danh: không bắt đội hình / chi phí / tỷ số", () => {
    const r = matchSchema.safeParse({
      ...ok, published: false, scoreA: 1, scoreB: null, players: [],
      items: [{ ...item, name: "", amount: 0 }, { ...item, name: "", amount: 0, sponsorAmount: 5000 }],
    });
    expect(r.success).toBe(true);
  });
  it("chỉ nhập tỷ số 1 đội", () => {
    expect(errs(matchSchema.safeParse({ ...ok, scoreB: null }))).toHaveProperty("scoreB");
  });
  it("ủng hộ vượt khoản chi / thiếu tên người ủng hộ / trùng tên khoản / trùng người", () => {
    const e = errs(
      matchSchema.safeParse({
        ...ok,
        players: [...ok.players, { memberId: 1, team: "B", ate: true }],
        items: [{ ...item, sponsorAmount: 700000 }, { ...item, name: "tiền sân", sponsorAmount: 1000 }],
      }),
    );
    expect(e).toHaveProperty("items.0.sponsorAmount");
    expect(e).toHaveProperty("items.1.sponsorName");
    expect(e).toHaveProperty("items.1.name");
    expect(e).toHaveProperty("players");
  });
});

describe("sepaySchema", () => {
  it("chấp nhận content null và id số", () => {
    expect(sepaySchema.parse({ id: 1, transferType: "in", transferAmount: 1000, content: null }).content).toBe("");
  });
  it("từ chối thiếu loại giao dịch", () => {
    expect(sepaySchema.safeParse({ id: 1, transferAmount: 1 }).success).toBe(false);
  });
});
