import type { SplitItem } from "./split";

type PresetItem = Omit<SplitItem, "id">;

const base = {
  loserPct: 70,
  bearer: "loser",
  includeNonEaters: true,
  drawMode: "half",
  sponsorAmount: 0,
  sponsorName: "",
  sponsorMemberId: null,
  sponsorCash: false,
  eatersOnly: false,
} as const;

export const PRESETS = {
  standard: {
    label: "Kèo chuẩn: sân 7/3 · tiền ăn chỉ bổ đầu người đi ăn",
    items: [
      { ...base, name: "Tiền sân", amount: 0, rule: "ratio", loserPct: 70 },
      { ...base, name: "Tiền ăn", amount: 0, rule: "eaters" },
    ] as PresetItem[],
  },
  bet: {
    label: "Kèo gà: sân 50/50 · tiền ăn chỉ bổ đầu người đi ăn · gà đội thua",
    items: [
      { ...base, name: "Tiền sân", amount: 0, rule: "ratio", loserPct: 50 },
      { ...base, name: "Tiền ăn", amount: 0, rule: "eaters" },
      { ...base, name: "Tiền gà", amount: 0, rule: "bet" },
    ] as PresetItem[],
  },
  away: {
    label: "Đá đối: sân phần mình chia đều",
    items: [{ ...base, name: "Tiền sân", amount: 0, rule: "all" }] as PresetItem[],
  },
  empty: { label: "Trống – tự thêm khoản", items: [] as PresetItem[] },
} as const;

export type PresetKey = keyof typeof PRESETS;

export const RULE_LABELS: Record<SplitItem["rule"], string> = {
  ratio: "Tỷ lệ thắng/thua",
  eaters: "Chỉ bổ đầu người đi ăn",
  all: "Chia đều tất cả",
  bet: "Kèo – một đội chịu",
};

/** Nhãn ngắn cho ô chọn trên điện thoại. */
export const RULE_SHORT: Record<SplitItem["rule"], string> = {
  ratio: "⚖️ Tỷ lệ",
  eaters: "🍜 Người ăn",
  all: "👥 Chia đều",
  bet: "🐔 Kèo",
};
