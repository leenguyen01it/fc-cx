import { DEFAULT_TEAM_NAMES, netAmount, sponsorThanks, summarizeTotals, teamName, type SplitResult, type TeamNames } from "./split";
import { formatDate, formatK } from "./text";

export interface ZaloMatchInput {
  teamName: string;
  date: string;
  venue: string;
  scoreA: number | null;
  scoreB: number | null;
  split: SplitResult;
  names: Map<number, string>;
  teamNames?: TeamNames;
  /** Link trận trên trang đội – in ở cuối để mọi người xem số tiền và kiểm tra đã đóng chưa. */
  link?: string;
}

const payLine = (link?: string) => (link ? ["", `👀 Xem số tiền & kiểm tra đã đóng chưa: ${link}`] : []);

const RULE_TEXT: Record<string, (i: SplitResult["items"][number]) => string> = {
  ratio: (b) => (b.item.loserPct === 50 ? "50/50" : `${b.item.loserPct / 10}/${10 - b.item.loserPct / 10}`),
  eaters: (b) => `bổ đầu ${b.groups[0]?.count ?? 0} người đi ăn`,
  all: () => "chia đều",
  bet: (b) => (b.item.bearer === "loser" ? "đội thua" : "đội thắng"),
};

export function buildSummaryText(m: ZaloMatchInput): string {
  const { split, names } = m;
  const tn = m.teamNames ?? DEFAULT_TEAM_NAMES;
  const d = formatDate(m.date);
  const nm = (id: number) => names.get(id) ?? "?";
  const teamNames = (t: "A" | "B") =>
    split.players.filter((p) => p.team === t).map((p) => nm(p.memberId)).join(", ");

  const lines: string[] = [];
  const score = m.scoreA != null && m.scoreB != null ? `${teamName("A", tn)} ${m.scoreA}–${m.scoreB} ${teamName("B", tn)}` : "";
  lines.push(`⚽ ${m.teamName.toUpperCase()} · TRẬN ${d.short}${score ? ` – ${score}` : ""}`);
  lines.push("");

  if (split.teamless) {
    lines.push(`⚽ Đá: ${teamNames("A")}`);
  } else if (split.outcome === "draw") {
    lines.push(`🤝 Hòa`);
    lines.push(`🔴 ${teamName("A", tn)}: ${teamNames("A")}`);
    lines.push(`🔵 ${teamName("B", tn)}: ${teamNames("B")}`);
  } else if (split.winner && split.loser) {
    lines.push(`🏆 Thắng (${teamName(split.winner, tn)}): ${teamNames(split.winner)}`);
    lines.push(`😢 Thua (${teamName(split.loser, tn)}): ${teamNames(split.loser)}`);
  }
  const eatOnly = split.players.filter((p) => !p.team && !p.pending).map((p) => nm(p.memberId));
  if (eatOnly.length) lines.push(`🍽 Chỉ ăn: ${eatOnly.join(", ")}`);
  const pend = split.players.filter((p) => p.pending).map((p) => nm(p.memberId));
  if (pend.length) lines.push(`❓ Chưa chọn đội: ${pend.join(", ")}`);
  lines.push("");

  const costs = split.items
    .filter((b) => b.item.amount > 0)
    .map((b) => {
      const net = netAmount(b.item);
      const money = net < b.item.amount ? `${formatK(b.item.amount)} − ${formatK(b.item.amount - net)} ủng hộ` : formatK(b.item.amount);
      return `${b.item.name} ${money} (${RULE_TEXT[b.item.rule](b)})`;
    });
  if (costs.length) lines.push(`💰 ${costs.join(" · ")}`);
  for (const t of sponsorThanks(split)) {
    lines.push(`🎁 Cảm ơn ${t.name} đã ủng hộ ${formatK(t.amount)} ${t.items.join(", ").toLowerCase()}!`);
  }

  for (const t of summarizeTotals(split, tn)) {
    lines.push(`👉 ${t.label}: ${formatK(t.common)}/người`);
    for (const e of t.exceptions) {
      lines.push(`👉 ${nm(e.memberId)}${e.reason ? ` (${e.reason})` : ""}: ${formatK(e.total)}`);
    }
  }

  lines.push(...payLine(m.link));
  return lines.join("\n");
}

export function buildReminderText(
  teamName: string,
  date: string,
  unpaid: { name: string; remaining: number | null }[],
  link?: string,
): string {
  const d = formatDate(date);
  if (unpaid.length === 0) return `✅ ${teamName} · Trận ${d.short}: mọi người đã trả đủ. Cảm ơn cả nhà!`;
  const lines = [
    `⏰ NHẮC ĐÓNG TIỀN · ${teamName.toUpperCase()} · TRẬN ${d.short}`,
    `Còn ${unpaid.length} người chưa đóng:`,
    ...unpaid.map((u) => `• ${u.name}: ${u.remaining == null ? "chọn đội để xem số tiền" : formatK(u.remaining)}`),
    ...payLine(link),
  ];
  return lines.join("\n");
}
