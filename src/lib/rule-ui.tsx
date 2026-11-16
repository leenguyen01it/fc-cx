import { Drumstick, Scale, Users, Utensils, type LucideIcon } from "lucide-react";
import type { SplitItem } from "./split";
import { RULE_LABELS } from "./presets";

export const RULE_ICONS: Record<SplitItem["rule"], LucideIcon> = {
  ratio: Scale,
  eaters: Utensils,
  all: Users,
  bet: Drumstick,
};

export const RULE_HINTS: Record<SplitItem["rule"], string> = {
  ratio: "Tiền sân: đội thua trả nhiều hơn (7/3, 5/5…)",
  eaters: "Tiền ăn: chỉ người có đi ăn mới chia",
  all: "Mọi người có mặt chia đều (nước, áo…)",
  bet: "Bia, gà…: một đội chịu toàn bộ",
};

export function ruleDescription(
  item: Pick<SplitItem, "rule" | "loserPct" | "bearer" | "includeNonEaters" | "drawMode" | "eatersOnly">,
) {
  const draw = item.drawMode === "half" ? "hoà: mỗi đội 50%" : "hoà: chia đều";
  switch (item.rule) {
    case "ratio": {
      const who = item.eatersOnly ? " · người ăn" : "";
      return item.loserPct === 100
        ? `Đội thua bao hết${who} · ${draw}`
        : item.loserPct === 50
          ? `Mỗi đội 50%${who}`
          : `Thua ${item.loserPct}% · thắng ${100 - item.loserPct}%${who} · ${draw}`;
    }
    case "bet":
      return `${item.bearer === "loser" ? "Đội thua" : "Đội thắng"} chịu${
        item.includeNonEaters ? "" : " (chỉ người có ăn)"
      } · ${draw}`;
    default:
      return RULE_LABELS[item.rule];
  }
}
