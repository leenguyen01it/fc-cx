/**
 * Tính tiền từng người cho một trận. Hàm thuần, dùng chung cho server và client
 * (màn admin xem trước kết quả ngay khi đang nhập).
 */

export type Team = "A" | "B";
export type Outcome = "A" | "B" | "draw";

export interface SplitPlayer {
  memberId: number;
  /** null = chỉ đi ăn (không đá) hoặc đá nhưng chưa chọn đội (pending). */
  team: Team | null;
  ate: boolean;
  /** Có đá nhưng chưa chọn đội: góp tiền ăn / chia đều; tiền sân & kèo tính khi chọn đội. */
  pending?: boolean;
}

/** Số người mỗi đội (admin nhập) – để chia tiền đúng khi còn người chưa chọn đội. */
export type TeamSizes = Partial<Record<Team, number | null>>;

export interface SplitItem {
  id: number | string;
  name: string;
  amount: number;
  rule: "ratio" | "eaters" | "all" | "bet";
  loserPct: number;
  bearer: "loser" | "winner";
  includeNonEaters: boolean;
  drawMode: "half" | "all";
  /** ratio: chỉ chia cho người có ăn (tiền ăn 50/50 theo đội). */
  eatersOnly?: boolean;
  /** Tiền người khác ủng hộ, trừ vào khoản này trước khi chia. */
  sponsorAmount?: number;
  sponsorName?: string;
  /** Thành viên trong trận ủng hộ: tiền ủng hộ cộng vào số tiền họ phải chuyển (trừ khi đưa tiền mặt). */
  sponsorMemberId?: number | null;
  sponsorCash?: boolean;
}

/** Tiền ủng hộ thực tế của một khoản (không vượt quá khoản chi). */
export function sponsoredAmount(item: Pick<SplitItem, "amount" | "sponsorAmount">): number {
  return Math.max(0, Math.round(item.amount)) - netAmount(item);
}

/** Tiền ủng hộ được cộng vào khoản chuyển của một thành viên. */
export function sponsorTransfer(item: Pick<SplitItem, "amount" | "sponsorAmount" | "sponsorMemberId" | "sponsorCash">): number {
  return item.sponsorMemberId != null && !item.sponsorCash ? sponsoredAmount(item) : 0;
}

/**
 * Không có khoản nào tính theo thắng/thua (VD đá đối với đội khác) → không chia đội:
 * mọi người đá chung một nhóm (lưu là đội A), không cần tỷ số.
 */
export function isTeamless(items: Pick<SplitItem, "rule">[]): boolean {
  return items.length > 0 && items.every((i) => i.rule === "all" || i.rule === "eaters");
}

/** Số tiền thực phải chia sau khi trừ ủng hộ. */
export function netAmount(item: Pick<SplitItem, "amount" | "sponsorAmount">): number {
  const gross = Math.max(0, Math.round(item.amount));
  return Math.max(0, gross - Math.max(0, Math.round(item.sponsorAmount ?? 0)));
}

export interface ChargeLine {
  itemId: SplitItem["id"];
  name: string;
  amount: number;
  /** Dòng tiền ủng hộ (không phải phần chia). */
  sponsor?: boolean;
}

export interface PlayerCharge {
  memberId: number;
  team: Team | null;
  ate: boolean;
  pending: boolean;
  /** Người chưa chọn đội: tổng tiền nếu ở đội A / đội B. */
  choices?: Record<Team, number>;
  lines: ChargeLine[];
  total: number;
}

/** Mô tả cách chia một khoản, để hiển thị cho mọi người hiểu. */
export interface ItemBreakdown {
  item: SplitItem;
  /** Các nhóm người chịu và mức mỗi người, ví dụ "Đội thua · 7 người · 43k". */
  groups: { label: string; count: number; perPerson: number }[];
  collected: number;
  /** Tiền ủng hộ cộng vào khoản chuyển của người ủng hộ (0 = người ngoài / tiền mặt). */
  sponsorDue: number;
}

export interface SplitResult {
  /** Trận không chia đội (đá đối). */
  teamless: boolean;
  outcome: Outcome | null;
  winner: Team | null;
  loser: Team | null;
  players: PlayerCharge[];
  items: ItemBreakdown[];
  /** Tổng chi thực tế (trước ủng hộ). */
  totalCost: number;
  /** Tổng tiền được ủng hộ. */
  totalSponsored: number;
  /** Tổng phải thu từ mọi người (sau làm tròn). */
  totalCharged: number;
}

export const ROUND_UNIT = 1000;

export function roundUp(n: number): number {
  if (n <= 0) return 0;
  return Math.ceil(n / ROUND_UNIT - 1e-9) * ROUND_UNIT;
}

export function getOutcome(scoreA: number | null, scoreB: number | null): Outcome | null {
  if (scoreA == null || scoreB == null) return null;
  if (scoreA > scoreB) return "A";
  if (scoreB > scoreA) return "B";
  return "draw";
}

const other = (t: Team): Team => (t === "A" ? "B" : "A");

export type TeamNames = Record<Team, string>;
export const DEFAULT_TEAM_NAMES: TeamNames = { A: "Nhất", B: "Bét" };

/** "Đội Nhất", "Đội Bét"… */
export const teamName = (team: Team, names: TeamNames = DEFAULT_TEAM_NAMES) => `Đội ${names[team]}`;

export function teamLabel(team: Team, outcome: Outcome | null, names: TeamNames = DEFAULT_TEAM_NAMES): string {
  const n = teamName(team, names);
  if (!outcome) return n;
  if (outcome === "draw") return `${n} (hoà)`;
  return outcome === team ? `${n} (thắng)` : `${n} (thua)`;
}

export function computeSplit(
  players: SplitPlayer[],
  items: SplitItem[],
  scoreA: number | null,
  scoreB: number | null,
  names: TeamNames = DEFAULT_TEAM_NAMES,
  sizes: TeamSizes = {},
  /** nội bộ: không tính choices (tránh đệ quy) */
  _skipChoices = false,
): SplitResult {
  const outcome = getOutcome(scoreA, scoreB);
  const winner: Team | null = outcome && outcome !== "draw" ? outcome : null;
  const loser: Team | null = winner ? other(winner) : null;

  const charges = new Map<number, PlayerCharge>();
  const isEatOnly = (p: SplitPlayer) => !p.team && !p.pending;
  for (const p of players) {
    charges.set(p.memberId, {
      memberId: p.memberId,
      team: p.team,
      ate: isEatOnly(p) ? true : p.ate,
      pending: !!p.pending && !p.team,
      lines: [],
      total: 0,
    });
  }
  // Người đá (có đội hoặc chưa chọn đội) – khoản chia đều, kèo/sân khi hoà chia đều
  const field = players.filter((p) => !isEatOnly(p));
  // Người ăn: người đá có ăn + người chỉ ăn
  const eaters = players.filter((p) => isEatOnly(p) || p.ate);
  // Số người tính tiền mỗi đội: admin nhập (nếu có) hoặc số người đã chọn đội
  const sizeOf = (pool: SplitPlayer[], t: Team) => Math.max(pool.filter((p) => p.team === t).length, sizes[t] ?? 0);
  /**
   * Số người chịu tiền của đội khi nhóm chia bị lọc (VD chỉ người ăn) và còn người chưa chọn đội:
   * = người trong nhóm đã chọn đội + phần người chưa chọn đội trong nhóm, chia theo số chỗ còn trống mỗi đội.
   * Khi mọi người đã chọn đội thì đúng bằng số người thực tế.
   */
  const estimateOf = (pool: SplitPlayer[], t: Team) => {
    const declared = pool.filter((p) => p.team === t).length;
    const pendingIn = pool.filter((p) => p.pending && !p.team).length;
    if (!pendingIn) return declared;
    const left = (x: Team) => Math.max(0, (sizes[x] ?? 0) - field.filter((p) => p.team === x).length);
    const total = left("A") + left("B");
    return declared + (total ? (pendingIn * left(t)) / total : pendingIn / 2);
  };

  const breakdowns: ItemBreakdown[] = [];

  const assign = (item: SplitItem, group: SplitPlayer[], share: number, label: string, bd: ItemBreakdown, divisor?: number) => {
    const n = divisor ?? group.length;
    if (n <= 0 || share <= 0) return;
    const per = roundUp(share / n);
    for (const p of group) {
      const c = charges.get(p.memberId)!;
      c.lines.push({ itemId: item.id, name: item.name, amount: per });
      c.total += per;
    }
    bd.groups.push({ label, count: Math.round(n), perPerson: per });
    bd.collected += per * group.length;
  };

  const ofTeam = (pool: SplitPlayer[], t: Team) => pool.filter((p) => p.team === t);

  /** Chia theo đội; đội nào không có người thì đội còn lại gánh phần đó. */
  const splitTeams = (
    item: SplitItem,
    pool: SplitPlayer[],
    shareA: number,
    shareB: number,
    bd: ItemBreakdown,
    useSizes = true,
  ) => {
    const a = ofTeam(pool, "A");
    const b = ofTeam(pool, "B");
    const nA = useSizes ? sizeOf(pool, "A") : estimateOf(pool, "A");
    const nB = useSizes ? sizeOf(pool, "B") : estimateOf(pool, "B");
    if (nA === 0) return assign(item, b, shareA + shareB, teamLabel("B", outcome, names), bd, nB);
    if (nB === 0) return assign(item, a, shareA + shareB, teamLabel("A", outcome, names), bd, nA);
    assign(item, a, shareA, teamLabel("A", outcome, names), bd, nA);
    assign(item, b, shareB, teamLabel("B", outcome, names), bd, nB);
  };

  for (const item of items) {
    const bd: ItemBreakdown = { item, groups: [], collected: 0, sponsorDue: 0 };
    breakdowns.push(bd);
    // Thành viên ủng hộ chuyển khoản: cộng tiền ủng hộ vào khoản của họ (sau phần chia của khoản này)
    const addSponsor = () => {
      const due = sponsorTransfer(item);
      const c = due > 0 ? charges.get(item.sponsorMemberId!) : undefined;
      if (!c) return;
      c.lines.push({ itemId: item.id, name: `Ủng hộ ${item.name.toLowerCase()}`, amount: due, sponsor: true });
      c.total += due;
      bd.sponsorDue = due;
      bd.collected += due;
    };
    const amount = netAmount(item);
    if (amount === 0 || players.length === 0) {
      addSponsor();
      continue;
    }

    switch (item.rule) {
      case "all":
        assign(item, field, amount, "Tất cả", bd);
        break;

      case "eaters":
        assign(item, eaters, amount, "Người đi ăn", bd);
        break;

      case "ratio": {
        if (!outcome) break;
        let rest = amount;
        let pool = field;
        // Chỉ tính người ăn: người chỉ ăn trả mức trung bình, phần còn lại chia theo đội cho người có ăn
        if (item.eatersOnly) {
          const eatOnly = players.filter(isEatOnly);
          pool = field.filter((p) => p.ate);
          if (eatOnly.length && eaters.length) {
            const avg = amount / eaters.length;
            assign(item, eatOnly, avg * eatOnly.length, "Chỉ ăn", bd);
            rest = amount - avg * eatOnly.length;
          }
        }
        // Theo người ăn thì không dùng số người mỗi đội admin nhập (không biết bao nhiêu người ăn mỗi đội)
        const sized = !item.eatersOnly;
        if (outcome === "draw") {
          if (item.drawMode === "all") assign(item, pool, rest, "Tất cả (hoà)", bd);
          else splitTeams(item, pool, rest / 2, rest / 2, bd, sized);
          break;
        }
        const pct = Math.min(100, Math.max(0, item.loserPct)) / 100;
        const loserShare = rest * pct;
        const winnerShare = rest - loserShare;
        splitTeams(
          item,
          pool,
          loser === "A" ? loserShare : winnerShare,
          loser === "B" ? loserShare : winnerShare,
          bd,
          sized,
        );
        break;
      }

      case "bet": {
        if (!outcome) break;
        const pool = item.includeNonEaters ? field : field.filter((p) => p.ate);
        // Số người theo đội admin nhập chỉ dùng được khi kèo tính cả người không ăn
        const useSizes = item.includeNonEaters;
        if (outcome === "draw") {
          if (item.drawMode === "all") assign(item, pool, amount, "Tất cả (hoà)", bd);
          else splitTeams(item, pool, amount / 2, amount / 2, bd, useSizes);
          break;
        }
        const bearerTeam = item.bearer === "loser" ? loser! : winner!;
        const bearers = ofTeam(pool, bearerTeam);
        const n = useSizes ? sizeOf(pool, bearerTeam) : estimateOf(pool, bearerTeam);
        // Đội chịu kèo không có ai hợp lệ → chia cho cả nhóm còn lại để khỏi mất tiền.
        if (n === 0) assign(item, pool, amount, "Tất cả", bd);
        else assign(item, bearers, amount, teamLabel(bearerTeam, outcome, names), bd, n);
        break;
      }
    }
    addSponsor();
  }

  const result = [...charges.values()];
  // Không có khoản nào phụ thuộc đội (VD đá đối) thì không cần tỷ số mới biết mỗi người trả bao nhiêu
  const byTeam = items.some((i) => (i.rule === "ratio" || i.rule === "bet") && netAmount(i) > 0);
  // Người chưa chọn đội: tính sẵn tổng tiền nếu ở mỗi đội (số người theo đội cố định nên không ảnh hưởng người khác)
  if (!_skipChoices && (outcome || !byTeam)) {
    for (const c of result) {
      if (!c.pending) continue;
      const pick = (t: Team) =>
        computeSplit(
          players.map((p) => (p.memberId === c.memberId ? { ...p, team: t, pending: false } : p)),
          items,
          scoreA,
          scoreB,
          names,
          sizes,
          true,
        ).players.find((x) => x.memberId === c.memberId)!.total;
      c.choices = { A: pick("A"), B: pick("B") };
    }
  }
  return {
    teamless: isTeamless(items),
    outcome,
    winner,
    loser,
    players: result,
    items: breakdowns,
    totalCost: items.reduce((s, i) => s + Math.max(0, Math.round(i.amount)), 0),
    totalSponsored: items.reduce((s, i) => s + Math.max(0, Math.round(i.amount)) - netAmount(i), 0),
    totalCharged: result.reduce((s, p) => s + p.total, 0),
  };
}

export interface TeamTotals {
  /** null = nhóm chỉ ăn */
  team: Team | null;
  /** "Đội thua", "Đội thắng", "Đội Nhất"... */
  label: string;
  role: "winner" | "loser" | "draw" | null;
  /** Mức chung (nhiều người nhất) và các dòng cấu thành. */
  common: number;
  commonLines: ChargeLine[];
  commonCount: number;
  exceptions: { memberId: number; total: number; reason: string }[];
}

const isSponsor = (p: PlayerCharge) => p.lines.some((l) => l.sponsor);
/** Phần chia của một người, không tính tiền ủng hộ. */
const shareOf = (p: PlayerCharge) => p.lines.reduce((s, l) => s + (l.sponsor ? 0 : l.amount), 0);

/** Mức chung = phần chia gặp nhiều nhất (bỏ tiền ủng hộ ra để người ủng hộ không kéo lệch). */
function commonOf(ps: PlayerCharge[]) {
  const freq = new Map<number, number>();
  for (const p of ps) freq.set(shareOf(p), (freq.get(shareOf(p)) ?? 0) + 1);
  const common = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  const sample = ps.find((p) => shareOf(p) === common)!;
  return {
    common,
    commonLines: sample.lines.filter((l) => !l.sponsor),
    commonCount: ps.filter((p) => p.total === common).length,
    sample,
  };
}

/** Tóm tắt "mỗi người phải trả" theo đội, tách người có mức khác (không ăn...). */
export function summarizeTotals(split: SplitResult, names: TeamNames = DEFAULT_TEAM_NAMES): TeamTotals[] {
  const out: TeamTotals[] = [];
  for (const team of ["A", "B"] as Team[]) {
    const ps = split.players.filter((p) => p.team === team && !p.pending);
    if (ps.length === 0) continue;
    const { common, commonLines, commonCount, sample } = commonOf(ps);
    const role =
      split.outcome === "draw"
        ? "draw"
        : split.winner === team
          ? "winner"
          : split.loser === team
            ? "loser"
            : null;
    out.push({
      team,
      role,
      label: split.teamless ? "Người đá" : role === "winner" ? "Đội thắng" : role === "loser" ? "Đội thua" : teamName(team, names),
      common,
      commonLines,
      commonCount,
      exceptions: ps
        .filter((p) => p.total !== common)
        .map((p) => ({
          memberId: p.memberId,
          total: p.total,
          reason: [p.ate === sample.ate ? "" : p.ate ? "có ăn" : "không ăn", isSponsor(p) ? "ủng hộ" : ""]
            .filter(Boolean)
            .join(", "),
        })),
    });
  }
  // Đội thua lên trước cho dễ đọc; nhóm chỉ ăn ở cuối
  out.sort((a, b) => (a.role === "loser" ? -1 : b.role === "loser" ? 1 : 0));
  const eatOnly = split.players.filter((p) => !p.team && !p.pending);
  if (eatOnly.length) {
    const { common, commonLines, commonCount } = commonOf(eatOnly);
    out.push({
      team: null,
      role: null,
      label: "Chỉ ăn",
      common,
      commonLines,
      commonCount,
      exceptions: eatOnly
        .filter((p) => p.total !== common)
        .map((p) => ({ memberId: p.memberId, total: p.total, reason: isSponsor(p) ? "ủng hộ" : "" })),
    });
  }
  return out;
}

/** Gom tiền ủng hộ theo người: [{ name: "Anh Tuấn", amount: 300000, items: ["Tiền ăn"] }]. */
export function sponsorThanks(split: SplitResult) {
  const by = new Map<string, { name: string; amount: number; items: string[] }>();
  for (const b of split.items) {
    const amt = sponsoredAmount(b.item);
    if (amt <= 0) continue;
    const name = b.item.sponsorName?.trim() || "Mạnh thường quân";
    const e = by.get(name) ?? { name, amount: 0, items: [] };
    e.amount += amt;
    e.items.push(b.item.name);
    by.set(name, e);
  }
  return [...by.values()];
}

/**
 * Số tiền đưa vào sổ nợ của một người:
 *  - đã có đội / chỉ ăn → tổng tiền
 *  - chưa chọn đội: nếu 2 đội cùng mức thì đội không quan trọng → tính luôn; khác mức → chờ chọn đội (null)
 */
export function settledTotal(c: PlayerCharge): number | null {
  if (!c.pending) return c.total;
  if (!c.choices) return null;
  return c.choices.A === c.choices.B ? c.choices.A : null;
}

/** Đoán đội từ số tiền chuyển khoản: chỉ khi khớp đúng 1 trong 2 mức. */
export function teamFromAmount(c: PlayerCharge, amount: number): Team | null {
  if (!c.pending || !c.choices || c.choices.A === c.choices.B) return null;
  if (amount === c.choices.A) return "A";
  if (amount === c.choices.B) return "B";
  return null;
}
