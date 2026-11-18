"use client";

import {
  Pencil,
  SlidersHorizontal,
  UserPlus,
  Check,
  CloudRain,
  Undo2,
  Vote,
  CalendarDays,
  Drumstick,
  Eye,
  EyeOff,
  Gift,
  LoaderCircle,
  MapPin,
  Plus,
  Receipt,
  Save,
  Search,
  Send,
  StickyNote,
  Trash2,
  Trophy,
  UserRound,
  Users,
  Utensils,
  UtensilsCrossed,
  Wallet,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { computeSplit, isTeamless, summarizeTotals, teamName, type SplitItem, type Team, type TeamNames } from "@/lib/split";
import { formatK, formatVnd, stripDiacritics } from "@/lib/text";
import { matchSchema, toFieldErrors, type FieldErrors, type MatchInput } from "@/lib/schemas";
import { RULE_ICONS, RULE_HINTS, ruleDescription } from "@/lib/rule-ui";
import { RULE_LABELS } from "@/lib/presets";
import { deleteMatch, restoreMatch, saveMatch } from "../../../actions";
import { MessagePreview } from "@/components/message-preview";
import { CancelMatchButton } from "./cancel-match";
import { AddGuestButton, type GuestMember } from "./add-guest";
import { formatDate } from "@/lib/text";
import {
  Avatar,
  Badge,
  btn,
  Card,
  CardHeader,
  ConfirmButton,
  cx,
  DateField,
  TimeField,
  Field,
  MoneyInput,
  Segmented,
  Select,
  Stepper,
  Switch,
  TextArea,
  TextInput,
  toast,
} from "@/components/ui";

export interface ItemData {
  name: string;
  amount: number;
  rule: SplitItem["rule"];
  loserPct: number;
  bearer: "loser" | "winner";
  includeNonEaters: boolean;
  drawMode: "half" | "all";
  eatersOnly: boolean;
  sponsorAmount: number;
  sponsorName: string;
  sponsorMemberId: number | null;
  sponsorCash: boolean;
}
type Item = ItemData & { key: string };
/** team null = chỉ ăn */
type Slot = { team: Team | null; ate: boolean; pending?: boolean };
/** play = có đá nhưng chưa chọn đội (VD quên điểm danh): tự chọn đội khi vào đóng tiền. */
type Choice = "none" | "play" | "A" | "B" | "eat";

export interface EditorProps {
  id: number;
  initial: {
    date: string;
    venue: string;
    timeRange: string;
    scoreA: number | null;
    scoreB: number | null;
    note: string;
    published: boolean;
    voting: boolean;
    players: { memberId: number; team: Team | null; ate: boolean; pending: boolean }[];
    sizeA: number | null;
    sizeB: number | null;
    items: ItemData[];
  };
  members: { id: number; name: string; code: string; active: boolean; guest: boolean }[];
  teamNames: TeamNames;
  rsvps: { memberId: number; going: boolean; eat: boolean; team: Team | null }[];
  cancelled: boolean;
  cancelReason: string;
  siteUrl: string;
}

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

const RULE_OPTIONS = (Object.keys(RULE_LABELS) as SplitItem["rule"][]).map((r) => {
  const Icon = RULE_ICONS[r];
  return { value: r, label: RULE_LABELS[r], description: RULE_HINTS[r], icon: <Icon /> };
});

const RATIO_PRESETS = [
  { value: "70", label: "7/3" },
  { value: "60", label: "6/4" },
  { value: "50", label: "5/5" },
  { value: "100", label: "Thua bao" },
];

export function MatchEditor({
  id,
  initial,
  members: serverMembers,
  teamNames: tn,
  rsvps,
  cancelled,
  cancelReason,
  siteUrl,
}: EditorProps) {
  // Khách vừa thêm trong phiên này (hiện ngay, trước khi server trả về danh sách mới)
  const [extra, setExtra] = useState<GuestMember[]>([]);
  const members = useMemo(
    () => [...serverMembers, ...extra.filter((g) => !serverMembers.some((m) => m.id === g.id))],
    [serverMembers, extra],
  );
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [dirty, setDirty] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const [info, setInfo] = useState({ date: initial.date, venue: initial.venue, timeRange: initial.timeRange, note: initial.note });
  const [scoreA, setScoreA] = useState<number | null>(initial.scoreA);
  const [scoreB, setScoreB] = useState<number | null>(initial.scoreB);
  const [published, setPublished] = useState(initial.published);
  const [voting, setVoting] = useState(initial.voting);
  const rsvpOf = useMemo(() => new Map(rsvps.map((r) => [r.memberId, r])), [rsvps]);
  const rsvpGoing = rsvps.filter((r) => r.going);
  const [slots, setSlots] = useState<Map<number, Slot>>(() => {
    const m = new Map<number, Slot>(
      initial.players.map((p) => [p.memberId, { team: p.team, ate: p.ate, pending: p.pending }]),
    );
    if (initial.published) return m;
    // Chưa công bố: bổ sung từ điểm danh những người admin chưa xếp (đã tự chọn đội / chỉ ăn)
    for (const r of rsvps) {
      if (m.has(r.memberId)) continue;
      if (r.going) m.set(r.memberId, r.team ? { team: r.team, ate: r.eat } : { team: null, ate: r.eat, pending: true });
      else if (r.eat) m.set(r.memberId, { team: null, ate: true });
    }
    return m;
  });
  const [items, setItems] = useState<Item[]>(() => initial.items.map((i) => ({ ...i, key: newKey() })));
  const [filter, setFilter] = useState("");
  const [editInfo, setEditInfo] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [editRoster, setEditRoster] = useState(false);
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const toggleOpen = (key: string) =>
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  // Thứ tự đội hình chỉ tính khi mở / tải lại trang: đã xếp đội → đăng ký đá → chưa trả lời → không đá
  const [order] = useState(() => {
    const inMatch = new Set(initial.players.map((p) => p.memberId));
    const rv = new Map(rsvps.map((r) => [r.memberId, r]));
    const rank = (mid: number) => (inMatch.has(mid) ? 0 : rv.get(mid)?.going ? 1 : rv.get(mid)?.eat ? 2 : rv.has(mid) ? 4 : 3);
    const sorted = [...serverMembers].sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name, "vi"));
    return new Map(sorted.map((m, i) => [m.id, i]));
  });

  // Cảnh báo khi rời trang mà chưa lưu
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  /** Đánh dấu đã sửa + xoá lỗi của các ô liên quan. */
  const touch = (...paths: string[]) => {
    setDirty(true);
    if (paths.length)
      setErrors((prev) => {
        const keys = Object.keys(prev).filter((k) => paths.some((p) => k === p || k.startsWith(p + ".")));
        if (!keys.length) return prev;
        const next = { ...prev };
        for (const k of keys) delete next[k];
        return next;
      });
  };

  // Đá đối: không chia đội – ai đá cũng vào chung một nhóm (đội A)
  const teamless = isTeamless(items);
  const players = useMemo(
    () =>
      [...slots.entries()].map(([memberId, s]) =>
        teamless && (s.team || s.pending)
          ? { memberId, team: "A" as Team, ate: s.ate, pending: false }
          : { memberId, team: s.team, ate: s.ate, pending: !s.team && !!s.pending },
      ),
    [slots, teamless],
  );
  const countA = players.filter((p) => p.team === "A").length;
  const countB = players.filter((p) => p.team === "B").length;
  const countEat = players.filter((p) => !p.team && !p.pending).length;
  const countPending = players.filter((p) => p.pending).length;
  // Số người mỗi đội (khi còn người chưa chọn đội): gợi ý = đã chọn + chia đều phần chưa chọn
  const [sizeA, setSizeA] = useState<number | null>(initial.sizeA);
  const [sizeB, setSizeB] = useState<number | null>(initial.sizeB);
  const suggestA = countA + Math.ceil(countPending / 2);
  const suggestB = countB + Math.floor(countPending / 2);
  const effA = sizeA ?? suggestA;
  const effB = sizeB ?? suggestB;
  const split = useMemo(
    () =>
      computeSplit(players, items.map((i): SplitItem => ({ ...i, id: i.key })), scoreA, scoreB, tn, countPending ? { A: effA, B: effB } : {}),
    [players, items, scoreA, scoreB, tn, countPending, effA, effB],
  );
  const totals = summarizeTotals(split, tn);
  const nameOf = (mid: number) => members.find((m) => m.id === mid)?.name ?? "?";
  const eaters = players.filter((p) => (!p.team && !p.pending) || p.ate).length;

  function setSlot(mid: number, c: Choice) {
    touch("players");
    setSlots((prev) => {
      const next = new Map(prev);
      if (c === "none") next.delete(mid);
      else if (c === "eat") next.set(mid, { team: null, ate: true });
      else {
        const p = prev.get(mid);
        const ate = p?.team || p?.pending ? p.ate : (rsvpOf.get(mid)?.eat ?? true);
        next.set(mid, c === "play" ? { team: null, ate, pending: true } : { team: c, ate });
      }
      return next;
    });
  }
  function toggleAte(mid: number) {
    touch();
    setSlots((prev) => {
      const next = new Map(prev);
      const s = next.get(mid);
      if (s) next.set(mid, { ...s, ate: !s.ate });
      return next;
    });
  }
  function updateItem(idx: number, patch: Partial<Item>) {
    touch("items", ...Object.keys(patch).map((k) => `items.${idx}.${k}`));
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function removeItem(idx: number) {
    setDirty(true);
    // chỉ số các khoản phía sau bị dịch → bỏ hết lỗi của khoản chi
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith("items"))));
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function addItem(kind: "bet" | "other") {
    touch("items");
    setItems((prev) => [
      ...prev,
      {
        key: newKey(),
        name: kind === "bet" ? "Kèo bia + gà" : "",
        amount: 0,
        rule: kind === "bet" ? "bet" : "all",
        loserPct: 70,
        bearer: "loser",
        includeNonEaters: true,
        drawMode: "half",
        eatersOnly: false,
        sponsorAmount: 0,
        sponsorName: "",
        sponsorMemberId: null,
        sponsorCash: false,
      },
    ]);
  }

  /** Cuộn tới vùng có lỗi đầu tiên (các vùng đánh dấu data-field). */
  function focusFirstError(errs: FieldErrors) {
    const first = Object.keys(errs)[0];
    if (!first) return;
    const parts = first.split(".");
    for (let n = parts.length; n > 0; n--) {
      const el = rootRef.current?.querySelector<HTMLElement>(`[data-field="${parts.slice(0, n).join(".")}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
  }

  function fail(errs: FieldErrors) {
    setErrors(errs);
    toast.error(Object.values(errs)[0] ?? "Kiểm tra lại các ô báo đỏ");
    focusFirstError(errs);
    if ("vibrate" in navigator) navigator.vibrate?.([30, 40, 30]);
  }

  function save(nextPublished: boolean) {
    const payload: MatchInput = {
      ...info,
      scoreA,
      scoreB,
      published: nextPublished,
      voting,
      sizeA: countPending ? effA : null,
      sizeB: countPending ? effB : null,
      players,
      items: items.map(({ key: _key, ...rest }) => rest), // eslint-disable-line @typescript-eslint/no-unused-vars
    };
    // 1) validate ngay trên máy – báo lỗi không cần chờ server
    const check = matchSchema.safeParse(payload);
    if (!check.success) return fail(toFieldErrors(check.error));
    // 2) gửi server – server validate lại lần nữa
    start(async () => {
      const res = await saveMatch(id, payload);
      if (res?.fieldErrors) fail(res.fieldErrors);
      else if (res?.error) toast.error(res.error);
      else {
        setErrors({});
        setPublished(nextPublished);
        setDirty(false);
        toast.success(res?.message ?? "Đã lưu");
        router.refresh();
      }
    });
  }

  const d = formatDate(info.date);
  const inviteText = [
    `⚽ ĐIỂM DANH · ${d.weekday} ${d.full}${info.timeRange ? ` · ${info.timeRange}` : ""}`,
    siteUrl,
  ]
    .filter(Boolean)
    .join("\n");

  // Đang điểm danh (chưa có tỷ số): đội hình lên trước; đá xong: tỷ số & tiền lên trước
  const votingPhase = !published && voting && scoreA == null && scoreB == null;
  /** Mở phần tuỳ chỉnh của khoản khi admin bấm, hoặc khi có lỗi ở phần đó */
  const isOpen = (key: string, idx: number) =>
    openItems.has(key) ||
    ["loserPct", "sponsorAmount", "sponsorName"].some((f) => errors[`items.${idx}.${f}`]);

  const q = stripDiacritics(filter.trim()).toLowerCase();
  const visible = members.filter((m) => m.active || slots.has(m.id) || extra.some((g) => g.id === m.id));
  // Khách vừa thêm luôn ở trên cùng; còn lại theo thứ tự lúc mở trang (không nhảy khi chọn đội)
  const pos = (mid: number) => {
    const g = extra.findIndex((x) => x.id === mid);
    return g >= 0 ? -1000 + g : (order.get(mid) ?? 1e9);
  };
  const shown = (q ? visible.filter((m) => stripDiacritics(`${m.name} ${m.code}`).toLowerCase().includes(q)) : visible)
    .slice()
    .sort((a, b) => pos(a.id) - pos(b.id) || a.name.localeCompare(b.name, "vi"));
  // Chỉ hiện người tham gia (đã xếp / đã điểm danh đá hoặc ăn / khách vừa thêm); người khác gom vào "Thêm người"
  const isIn = (mid: number) =>
    slots.has(mid) || !!rsvpOf.get(mid)?.going || !!rsvpOf.get(mid)?.eat || extra.some((g) => g.id === mid);
  const listed = q || showAll ? shown : shown.filter((m) => isIn(m.id));
  const hiddenCount = q || showAll ? 0 : shown.length - listed.length;

  // Sau khi đá: đội hình thường đã xong (mọi người tự chọn đội) → thu gọn, bấm "Sửa đội hình" mới mở
  const rosterOpen = votingPhase || editRoster || !!errors.players || !!errors.sizeA || players.length === 0;
  const groupNames = (pred: (p: (typeof players)[number]) => boolean) =>
    players.filter(pred).map((p) => nameOf(p.memberId)).join(", ");
  const rosterSection = rosterOpen ? (
    <>
      <Card>
        <div data-field="players" />
        <CardHeader
          icon={<Users />}
          title="Đội hình"
          subtitle={
            players.length
              ? `${players.length} người · ${eaters} ăn`
              : rsvpGoing.length
                ? `${rsvpGoing.length} đăng ký đá`
                : undefined
          }
          right={
            <span className="flex gap-1.5">
              {teamless ? (
                <Badge tone="a">Đá · {countA}</Badge>
              ) : (
                <>
                  <Badge tone="a">{tn.A} · {countA}</Badge>
                  <Badge tone="b">{tn.B} · {countB}</Badge>
                </>
              )}
              {countPending > 0 && <Badge tone="due">Chưa chọn · {countPending}</Badge>}
              {countEat > 0 && <Badge tone="muted">Ăn · {countEat}</Badge>}
            </span>
          }
        />
        {errors.players && (
          <p className="mx-4 mb-3 rounded-2xl bg-team-a-soft px-3 py-2 text-sm font-medium text-team-a">{errors.players}</p>
        )}
        <div className="flex gap-2 px-4 pb-3">
          <div className="relative min-w-0 flex-1">
            <TextInput value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Tìm tên…" icon={<Search />} className="h-11" />
            {filter && (
              <button
                type="button"
                aria-label="Xoá tìm kiếm"
                onClick={() => setFilter("")}
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-card-2 text-muted"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
        <ul className="divide-y divide-line">
          {listed.map((m) => {
            const s = slots.get(m.id);
            return (
              <li key={m.id} className="space-y-2 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className={cx("transition", !s && "opacity-40 grayscale")}>
                    <Avatar name={m.name} id={m.id} size="sm" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cx("flex items-center gap-1.5 text-[15px] font-semibold", !s && "text-muted")}>
                      <span className="truncate">{m.name}</span>
                      {m.guest && <Badge tone="muted">Khách</Badge>}
                      {s?.pending && !teamless && <Badge tone="due">Chưa chọn đội</Badge>}
                    </p>
                    {!s && rsvpOf.get(m.id) && (
                      <p className={cx("flex items-center gap-1 text-xs font-semibold", rsvpOf.get(m.id)!.going ? "text-paid" : "text-muted")}>
                        {rsvpOf.get(m.id)!.going && <Check className="size-3.5" />}
                        {rsvpOf.get(m.id)!.going ? "Đá" : "Không đá"}
                        {rsvpOf.get(m.id)!.team && !teamless && ` · ${tn[rsvpOf.get(m.id)!.team!]}`} · {rsvpOf.get(m.id)!.eat ? "Ăn" : "Không ăn"}
                      </p>
                    )}
                  </div>
                  {(s?.team || s?.pending) && (
                    <button
                      type="button"
                      onClick={() => toggleAte(m.id)}
                      aria-pressed={s.ate}
                      className={cx(
                        "inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold transition active:scale-95",
                        s.ate ? "bg-brand-soft text-brand" : "bg-card-2 text-muted",
                      )}
                    >
                      {s.ate ? <Utensils className="size-3.5" /> : <UtensilsCrossed className="size-3.5" />}
                      {s.ate ? "Ăn" : "Không ăn"}
                    </button>
                  )}
                </div>
                <div
                  role="radiogroup"
                  aria-label={`Đội của ${m.name}`}
                  className={cx("grid gap-1 rounded-xl bg-card-2 p-1", teamless ? "grid-cols-3" : "grid-cols-5")}
                >
                  {(teamless ? (["none", "A", "eat"] as const) : (["none", "play", "A", "B", "eat"] as const)).map((c) => {
                    const cur: Choice = !s
                      ? "none"
                      : teamless && (s.team || s.pending)
                        ? "A"
                        : s.pending
                          ? "play"
                          : (s.team ?? "eat");
                    const on = cur === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={
                          c === "none"
                            ? "Không tham gia"
                            : c === "eat"
                              ? "Chỉ ăn"
                              : c === "play"
                                ? "Đá, tự chọn đội khi đóng tiền"
                                : teamless
                                  ? "Đá"
                                  : teamName(c, tn)
                        }
                        onClick={() => setSlot(m.id, c)}
                        className={cx(
                          "flex h-9 min-w-0 items-center justify-center rounded-lg px-1 text-sm font-bold whitespace-nowrap transition active:scale-95",
                          on && c === "A" && "bg-team-a text-white shadow-sm",
                          on && c === "B" && "bg-team-b text-white shadow-sm",
                          on && c === "play" && "bg-due text-white shadow-sm",
                          on && c === "eat" && "bg-brand text-brand-ink shadow-sm",
                          on && c === "none" && "bg-card text-ink shadow-sm",
                          !on && "text-muted",
                        )}
                      >
                        {c === "none" ? (
                          <X className="size-4" />
                        ) : c === "eat" ? (
                          "Chỉ ăn"
                        ) : c === "play" || teamless ? (
                          "Đá"
                        ) : (
                          <span className="truncate">{tn[c]}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
          {shown.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Không tìm thấy “{filter}”</li>}
        </ul>
        {hiddenCount > 0 && (
          <div className="px-4 pt-3">
            <button type="button" onClick={() => setShowAll(true)} className={cx(btn.ghost, "w-full")}>
              <UserPlus /> Thêm người ({hiddenCount})
            </button>
          </div>
        )}
        {countPending > 0 && (
          <div data-field="sizeA" className="mx-4 mb-3 space-y-3 rounded-2xl border border-line bg-card-2 p-3">
            <p className="text-sm font-semibold">Số người mỗi đội</p>
            <div className="flex flex-wrap items-start justify-around gap-3">
              {(["A", "B"] as const).map((t) => (
                <div key={t} className="flex flex-col items-center gap-1.5">
                  <span className={cx("rounded-full px-3 py-1 text-xs font-bold text-white", t === "A" ? "bg-team-a" : "bg-team-b")}>
                    {teamName(t, tn)}
                  </span>
                  <Stepper
                    ariaLabel={`Số người ${teamName(t, tn)}`}
                    value={t === "A" ? effA : effB}
                    min={t === "A" ? countA : countB}
                    max={30}
                    invalid={!!errors.sizeA}
                    onChange={(v) => {
                      touch("sizeA");
                      if (t === "A") setSizeA(v);
                      else setSizeB(v);
                    }}
                  />
                </div>
              ))}
            </div>
            <p className={cx("text-center text-xs", effA + effB === countA + countB + countPending ? "text-muted" : "font-semibold text-team-a")}>
              {effA + effB}/{countA + countB + countPending} người đá
            </p>
            {errors.sizeA && <p className="text-center text-xs font-medium text-team-a">{errors.sizeA}</p>}
          </div>
        )}
        <div className="px-4 pt-1 pb-4">
          <AddGuestButton
            onAdded={(g) => {
              setExtra((prev) => [...prev, g]);
              setFilter("");
            }}
          />
        </div>
      </Card>
    </>
  ) : (
    <Card>
      <CardHeader
        icon={<Users />}
        title="Đội hình"
        subtitle={`${players.length} người · ${eaters} ăn`}
        right={
          <button
            type="button"
            onClick={() => setEditRoster(true)}
            className="flex h-8 items-center gap-1 rounded-full bg-card-2 px-3 text-xs font-semibold text-muted active:scale-95"
          >
            <Pencil className="size-3.5" /> Sửa đội hình
          </button>
        }
      />
      <div className="space-y-2 px-4 pb-4 text-sm">
        {(
          [
            ["A", teamless ? "Đá" : tn.A, countA, (p: (typeof players)[number]) => p.team === "A", "bg-team-a-soft text-team-a"],
            ["B", tn.B, countB, (p: (typeof players)[number]) => p.team === "B", "bg-team-b-soft text-team-b"],
            ["P", "Chưa chọn đội", countPending, (p: (typeof players)[number]) => !!p.pending, "bg-due-soft text-due"],
            ["E", "Chỉ ăn", countEat, (p: (typeof players)[number]) => !p.team && !p.pending, "bg-brand-soft text-brand"],
          ] as const
        )
          .filter(([, , n]) => n > 0)
          .map(([k, label, n, pred, tone]) => (
            <div key={k} className={cx("rounded-2xl px-3 py-2", tone)}>
              <p className="font-bold">
                {label} <span className="font-medium opacity-70">({n})</span>
              </p>
              <p className="text-ink">{groupNames(pred)}</p>
            </div>
          ))}
      </div>
    </Card>
  );
  const resultSection = teamless ? null : (
    <>
      <Card>
        <div data-field="scoreA" />
        <div data-field="scoreB" />
        <CardHeader
          icon={<Trophy />}
          title="Kết quả"
          right={split.outcome && <Badge tone="brand">{split.outcome === "draw" ? "Hoà" : `${teamName(split.winner!, tn)} thắng`}</Badge>}
        />
        <div className="flex flex-wrap items-start justify-center gap-x-3 gap-y-4 px-2 pb-3">
          {(["A", "B"] as const).map((t) => (
            <div key={t} className="flex flex-col items-center gap-2">
              <span className={cx("rounded-full px-3 py-1 text-xs font-bold text-white", t === "A" ? "bg-team-a" : "bg-team-b")}>
                {teamName(t, tn)}
              </span>
              <Stepper
                ariaLabel={`Bàn thắng ${teamName(t, tn)}`}
                value={t === "A" ? scoreA : scoreB}
                invalid={!!errors[t === "A" ? "scoreA" : "scoreB"]}
                onChange={(v) => {
                  touch("scoreA", "scoreB");
                  if (t === "A") setScoreA(v);
                  else setScoreB(v);
                }}
              />
            </div>
          ))}
        </div>
        {(errors.scoreA || errors.scoreB) && (
          <p className="px-4 pb-2 text-center text-xs font-medium text-team-a">{errors.scoreA ?? errors.scoreB}</p>
        )}
        {(scoreA != null || scoreB != null) && (
          <div className="flex justify-center pb-3">
            <button
              type="button"
              onClick={() => {
                touch("scoreA", "scoreB");
                setScoreA(null);
                setScoreB(null);
              }}
              className="flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold text-muted active:bg-card-2"
            >
              <X className="size-3.5" /> Xoá tỷ số
            </button>
          </div>
        )}
      </Card>
    </>
  );
  const costSection = (
    <>
      <Card>
        <div data-field="items" />
        <CardHeader icon={<Wallet />} title="Chi phí & kèo" subtitle={`${items.length} khoản · ${formatVnd(split.totalCost)}`} />
        {errors.items && (
          <p className="mx-4 mb-3 rounded-2xl bg-team-a-soft px-3 py-2 text-sm font-medium text-team-a">{errors.items}</p>
        )}
        <div className="space-y-3 px-4 pb-4">
          {items.map((it, idx) => {
            const e = (f: string) => errors[`items.${idx}.${f}`];
            const RuleIcon = it.eatersOnly && it.rule === "ratio" ? Utensils : RULE_ICONS[it.rule];
            return (
              <div key={it.key} data-field={`items.${idx}`} className="space-y-2 rounded-3xl border border-line bg-card-2 p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-brand">
                    <RuleIcon className="size-[18px]" />
                  </span>
                  <Field error={e("name")} className="min-w-0 flex-1">
                    <TextInput
                      value={it.name}
                      placeholder="Tên khoản"
                      maxLength={60}
                      aria-label="Tên khoản"
                      invalid={!!e("name")}
                      onChange={(ev) => updateItem(idx, { name: ev.target.value })}
                      className="font-semibold"
                    />
                  </Field>
                  <Field error={e("amount")} className="w-36 shrink-0">
                    <MoneyInput
                      value={it.amount}
                      invalid={!!e("amount")}
                      ariaLabel={`Số tiền ${it.name}`}
                      onChange={(v) => updateItem(idx, { amount: v })}
                    />
                  </Field>
                </div>
                <div className="flex items-center gap-2 pl-11">
                  <p className="min-w-0 flex-1 text-xs text-muted">
                    {ruleDescription(it)}
                    {it.sponsorAmount > 0 && (
                      <span className="text-brand">
                        {" "}
                        · {it.sponsorMemberId != null ? nameOf(it.sponsorMemberId) : it.sponsorName || "ủng hộ"} {formatK(it.sponsorAmount)}
                      </span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleOpen(it.key)}
                    className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-card px-3 text-xs font-semibold text-muted active:scale-95"
                  >
                    <SlidersHorizontal className="size-3.5" />
                    {isOpen(it.key, idx) ? "Thu gọn" : "Tuỳ chỉnh"}
                  </button>
                </div>
                {isOpen(it.key, idx) && (
                  <div className="space-y-3 border-t border-line pt-3">
                <Field label="Cách chia">
                  <Select
                    value={it.rule}
                    onChange={(v) => updateItem(idx, { rule: v as Item["rule"] })}
                    title="Chia khoản này thế nào?"
                    options={RULE_OPTIONS}
                  />
                </Field>

                {it.rule === "ratio" && (
                  <Field label="Đội thua chịu" error={e("loserPct")}>
                    <div className="flex items-center gap-2">
                      <Segmented
                        className="min-w-0 flex-1"
                        size="sm"
                        ariaLabel="Tỷ lệ đội thua"
                        value={RATIO_PRESETS.some((r) => r.value === String(it.loserPct)) ? String(it.loserPct) : ""}
                        onChange={(v) => updateItem(idx, { loserPct: Number(v) })}
                        options={RATIO_PRESETS}
                      />
                      <div className="w-20 shrink-0">
                        <TextInput
                          inputMode="numeric"
                          aria-label="Phần trăm đội thua"
                          value={it.loserPct}
                          invalid={!!e("loserPct")}
                          suffix="%"
                          onChange={(ev) =>
                            updateItem(idx, { loserPct: Math.min(100, Number(ev.target.value.replace(/\D/g, "")) || 0) })
                          }
                          className="h-10 text-center font-bold"
                        />
                      </div>
                    </div>
                  </Field>
                )}

                {it.rule === "ratio" && (
                  <Switch
                    checked={it.eatersOnly}
                    onChange={(v) => updateItem(idx, { eatersOnly: v })}
                    icon={<Utensils />}
                    label="Chỉ tính người ăn"
                  />
                )}

                {it.rule === "bet" && (
                  <>
                    <Field label="Ai chịu kèo">
                      <Segmented
                        ariaLabel="Ai chịu kèo"
                        value={it.bearer}
                        onChange={(v) => updateItem(idx, { bearer: v })}
                        options={[
                          { value: "loser", label: "Đội thua" },
                          { value: "winner", label: "Đội thắng" },
                        ]}
                      />
                    </Field>
                    <Switch
                      checked={it.includeNonEaters}
                      onChange={(v) => updateItem(idx, { includeNonEaters: v })}
                      icon={<UtensilsCrossed />}
                      label="Người không ăn vẫn góp"
                    />
                  </>
                )}

                {(it.rule === "ratio" || it.rule === "bet") && (
                  <Field label="Nếu hoà">
                    <Segmented
                      ariaLabel="Khi hoà"
                      value={it.drawMode}
                      onChange={(v) => updateItem(idx, { drawMode: v })}
                      options={[
                        { value: "half", label: "Mỗi đội 50%" },
                        { value: "all", label: "Chia đều" },
                      ]}
                    />
                  </Field>
                )}

                <SponsorBlock
                  item={it}
                  people={players.map((p) => ({ id: p.memberId, name: nameOf(p.memberId) }))}
                  errors={{ amount: e("sponsorAmount"), name: e("sponsorName") }}
                  onChange={(patch) => updateItem(idx, patch)}
                />
                    <ConfirmButton
                      className="flex h-9 items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-team-a"
                      title={`Xoá “${it.name || "khoản này"}”?`}
                      confirmLabel="Xoá khoản"
                      icon={<Trash2 />}
                      onConfirm={() => removeItem(idx)}
                    >
                      <Trash2 className="size-4" /> Xoá khoản này
                    </ConfirmButton>
                  </div>
                )}
              </div>
            );
          })}

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => addItem("bet")} className={btn.soft}>
              <Drumstick /> Thêm kèo
            </button>
            <button type="button" onClick={() => addItem("other")} className={btn.ghost}>
              <Plus /> Khoản khác
            </button>
          </div>
        </div>
      </Card>
    </>
  );

  return (
    <div ref={rootRef} className="space-y-3 pb-32">
      {cancelled ? (
        <Card className="flex items-center gap-3 border-team-b/30 bg-team-b-soft p-4">
          <CloudRain className="size-6 shrink-0 text-team-b" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-team-b">Đã huỷ</p>
            {cancelReason && <p className="truncate text-sm text-team-b/80">{cancelReason}</p>}
          </div>
          <button
            type="button"
            className={cx(btn.small, "bg-card")}
            onClick={() =>
              start(async () => {
                const r = await restoreMatch(id);
                if (r?.ok) {
                  toast.success(r.message ?? "Đã mở lại");
                  router.refresh();
                } else toast.error(r?.error ?? "Không mở lại được");
              })
            }
          >
            <Undo2 /> Mở lại
          </button>
        </Card>
      ) : (
        !published && (
          <Card className="space-y-3 p-4">
            <Switch
              checked={voting}
              onChange={(v) => {
                touch();
                setVoting(v);
              }}
              icon={<Vote />}
              label="Điểm danh"
            />
            <MessagePreview
              text={inviteText}
              title="Lời mời điểm danh"
              trigger={
                <>
                  <Send /> Lời mời Zalo
                </>
              }
              triggerClassName={cx(btn.soft, "w-full")}
            />
          </Card>
        )
      )}
      {/* ------------ Thông tin ------------ */}
      <Card>
        {editInfo || errors.date || errors.timeRange || errors.venue ? (
          <>
        <CardHeader
          icon={<CalendarDays />}
          title="Thông tin trận"
          right={
            published ? (
              <Badge tone="paid">
                <Eye /> Đã công bố
              </Badge>
            ) : voting && !cancelled ? (
              <Badge tone="brand">
                <Vote /> Điểm danh
              </Badge>
            ) : (
              <Badge tone="muted">
                <EyeOff /> Nháp
              </Badge>
            )
          }
        />
        <div className="grid grid-cols-2 gap-3 px-4 pb-4">
          <Field label="Ngày" error={errors.date} className="col-span-2 sm:col-span-1">
            <div data-field="date">
              <DateField
                value={info.date}
                invalid={!!errors.date}
                title="Ngày đá"
                onChange={(v) => {
                  touch("date");
                  setInfo({ ...info, date: v });
                }}
              />
            </div>
          </Field>
          <Field label="Giờ" error={errors.timeRange} optional className="col-span-2 sm:col-span-1">
            <TimeField
              value={info.timeRange}
              invalid={!!errors.timeRange}
              title="Giờ đá"
              onChange={(v) => {
                touch("timeRange");
                setInfo({ ...info, timeRange: v });
              }}
            />
          </Field>
          <Field label="Sân" error={errors.venue} optional className="col-span-2">
            <TextInput
              value={info.venue}
              placeholder="Sân bóng Mai Về"
              maxLength={100}
              icon={<MapPin />}
              invalid={!!errors.venue}
              onChange={(e) => {
                touch("venue");
                setInfo({ ...info, venue: e.target.value });
              }}
            />
          </Field>
        </div>
          </>
        ) : (
          <button type="button" onClick={() => setEditInfo(true)} className="flex w-full items-center gap-3 p-4 text-left active:bg-card-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <CalendarDays className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">
                {d.weekday}, {d.full}
              </span>
              <span className="block truncate text-xs text-muted">{[info.timeRange, info.venue].filter(Boolean).join(" · ") || "Chưa có giờ / sân"}</span>
            </span>
            {published ? (
              <Badge tone="paid">
                <Eye /> Đã công bố
              </Badge>
            ) : voting && !cancelled ? (
              <Badge tone="brand">
                <Vote /> Điểm danh
              </Badge>
            ) : (
              <Badge tone="muted">
                <EyeOff /> Nháp
              </Badge>
            )}
            <Pencil className="size-4 shrink-0 text-muted" />
          </button>
        )}
      </Card>
      {votingPhase ? (
        <>
          {rosterSection}
          {resultSection}
          {costSection}
        </>
      ) : (
        <>
          {resultSection}
          {costSection}
          {rosterSection}
        </>
      )}

      {/* ------------ Xem trước ------------ */}
      <Card>
        <CardHeader icon={<Receipt />} title="Xem trước số tiền" />
        <div className="space-y-2 px-4 pb-4">
          {totals.length === 0 && <p className="text-sm text-muted">Chưa có người đá.</p>}
          {totals.map((t) => (
            <div key={t.team} className="rounded-2xl border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 font-semibold">
                  <span className={cx("size-2.5 shrink-0 rounded-full", t.team === "A" ? "bg-team-a" : "bg-team-b")} />
                  <span className="truncate">{t.label}</span>
                  <span className="shrink-0 text-xs font-medium text-muted">{t.commonCount} người</span>
                </span>
                <span className="tabular text-lg font-extrabold">{formatK(t.common)}</span>
              </div>
              <p className="tabular text-xs text-muted">
                {t.commonLines.map((l) => `${formatK(l.amount)} ${l.name.toLowerCase()}`).join(" + ") || "—"}
              </p>
              {t.exceptions.map((x) => (
                <p key={x.memberId} className="mt-1 flex justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted">
                    <UserRound className="size-3.5" />
                    {nameOf(x.memberId)} {x.reason && `(${x.reason})`}
                  </span>
                  <span className="tabular font-semibold">{formatK(x.total)}</span>
                </p>
              ))}
            </div>
          ))}
          <div className="tabular space-y-1 pt-1 text-sm">
            {split.totalSponsored > 0 && (
              <p className="flex justify-between text-brand">
                <span className="flex items-center gap-1.5">
                  <Gift className="size-4" /> Được ủng hộ
                </span>
                <span className="font-semibold">−{formatVnd(split.totalSponsored)}</span>
              </p>
            )}
            <p className="flex justify-between">
              <span className="text-muted">Cần chia / sẽ thu</span>
              <span className="font-semibold">
                {formatVnd(split.totalCost - split.totalSponsored)} /{" "}
                {formatVnd(split.items.reduce((t, b) => t + b.groups.reduce((x, g) => x + g.perPerson * g.count, 0), 0))}
              </span>
            </p>
          </div>
          {split.outcome == null && items.some((i) => i.rule === "ratio" || i.rule === "bet") && (
            <p className="rounded-2xl bg-due-soft px-3 py-2 text-xs text-due">Nhập tỷ số để tính tiền sân và kèo.</p>
          )}
        </div>
      </Card>

      {/* ------------ Ghi chú ------------ */}
      {!showNote && !info.note && !errors.note ? (
        <button type="button" onClick={() => setShowNote(true)} className={cx(btn.ghost, "w-full")}>
          <StickyNote /> Ghi chú cho mọi người
        </button>
      ) : (
      <Card>
        <div data-field="note" />
        <CardHeader icon={<StickyNote />} title="Ghi chú cho mọi người" />
        <div className="px-4 pb-4">
          <Field error={errors.note}>
            <TextArea
              value={info.note}
              rows={3}
              maxLength={1000}
              invalid={!!errors.note}
              aria-label="Ghi chú"
              placeholder="VD: Tuấn ứng tiền sân, đã trừ vào quỹ"
              onChange={(e) => {
                touch("note");
                setInfo({ ...info, note: e.target.value });
              }}
            />
          </Field>
        </div>
      </Card>
      )}

      <div className="flex flex-wrap justify-center gap-2 pt-2">
        {!cancelled && !published && <CancelMatchButton id={id} onDone={() => router.refresh()} />}
        <ConfirmButton
          className="flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-team-a active:bg-team-a-soft"
          title="Xoá trận này?"
          description="Không thể hoàn tác."
          confirmLabel="Xoá vĩnh viễn"
          icon={<Trash2 />}
          onConfirm={() => deleteMatch(id)}
        >
          <Trash2 className="size-4" /> Xoá trận
        </ConfirmButton>
      </div>

      {/* ------------ Thanh lưu ------------ */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-30 px-3">
        <div className="mx-auto max-w-3xl rounded-3xl border border-line bg-card/95 p-2 shadow-2xl shadow-black/15 backdrop-blur-xl">
          {dirty && (
            <p className="flex items-center justify-center gap-1.5 pb-1.5 text-xs font-semibold text-due">
              <span className="size-1.5 animate-pulse rounded-full bg-due" /> Có thay đổi chưa lưu
            </p>
          )}
          {published ? (
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button type="button" disabled={pending} onClick={() => save(false)} className={cx(btn.ghost, "px-4")}>
                <EyeOff /> Ẩn
              </button>
              <button type="button" disabled={pending} onClick={() => save(true)} className={btn.primary}>
                {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
                {pending ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
            </div>
          ) : (
            // Chưa đá xong: "Lưu" là chính; có tỷ số rồi thì "Công bố kết quả" là chính
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => save(false)}
                className={cx(split.outcome ? btn.ghost : btn.primary, "px-6")}
              >
                {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
                Lưu
              </button>
              <button
                type="button"
                disabled={pending || cancelled}
                onClick={() => save(true)}
                className={cx(split.outcome ? btn.primary : btn.ghost, "whitespace-nowrap")}
              >
                <Send /> Công bố kết quả
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SponsorBlock({
  item,
  people,
  errors,
  onChange,
}: {
  item: Item;
  /** Người có trong trận (đá hoặc ăn). */
  people: { id: number; name: string }[];
  errors: { amount?: string; name?: string };
  onChange: (p: Partial<Item>) => void;
}) {
  const [open, setOpen] = useState(item.sponsorAmount > 0 || item.sponsorName !== "" || item.sponsorMemberId != null);
  // Mặc định là người trong đội; trận cũ chỉ có tên → người ngoài
  const [who, setWho] = useState<"member" | "outside">(
    item.sponsorMemberId == null && item.sponsorName !== "" ? "outside" : "member",
  );
  if (!open && !errors.amount && !errors.name)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-brand active:opacity-70"
      >
        <Gift className="size-4" /> Có người ủng hộ khoản này?
      </button>
    );
  const sponsored = Math.min(item.sponsorAmount, item.amount);
  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-brand/40 bg-brand-soft/60 p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-bold text-brand">
          <Gift className="size-4" /> Ủng hộ
        </p>
        <button
          type="button"
          onClick={() => {
            onChange({ sponsorAmount: 0, sponsorName: "", sponsorMemberId: null, sponsorCash: false });
            setWho("member");
            setOpen(false);
          }}
          className="flex h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold text-muted active:bg-card"
        >
          <X className="size-3.5" /> Bỏ
        </button>
      </div>
      <Segmented
        ariaLabel="Người ủng hộ"
        value={who}
        onChange={(v) => {
          setWho(v);
          onChange({ sponsorMemberId: null, sponsorCash: false, sponsorName: "" });
        }}
        options={[
          { value: "member", label: "Người trong trận" },
          { value: "outside", label: "Người ngoài" },
        ]}
      />
      <Field label="Người ủng hộ" error={errors.name}>
        {who === "member" ? (
          <Select
            value={item.sponsorMemberId != null ? String(item.sponsorMemberId) : ""}
            title="Người ủng hộ"
            placeholder={people.length ? "Chọn người" : "Chưa có ai trong trận"}
            icon={<UserRound />}
            searchable
            invalid={!!errors.name}
            options={people.map((p) => ({ value: String(p.id), label: p.name }))}
            onChange={(v) => {
              const p = people.find((x) => String(x.id) === v);
              onChange({ sponsorMemberId: p ? p.id : null, sponsorName: p?.name ?? "" });
            }}
          />
        ) : (
          <TextInput
            value={item.sponsorName}
            placeholder="VD: Anh Tuấn"
            maxLength={60}
            icon={<UserRound />}
            invalid={!!errors.name}
            onChange={(e) => onChange({ sponsorName: e.target.value })}
          />
        )}
      </Field>
      <Field label="Số tiền ủng hộ" error={errors.amount}>
        <MoneyInput value={item.sponsorAmount} invalid={!!errors.amount} onChange={(v) => onChange({ sponsorAmount: v })} />
      </Field>
      {who === "member" && (
        <Segmented
          ariaLabel="Cách đưa tiền ủng hộ"
          value={item.sponsorCash ? "cash" : "transfer"}
          onChange={(v) => onChange({ sponsorCash: v === "cash" })}
          options={[
            { value: "transfer", label: "Cộng vào tiền chuyển" },
            { value: "cash", label: "Tiền mặt" },
          ]}
        />
      )}
      <p className="tabular flex justify-between rounded-xl bg-card px-3 py-2 text-sm">
        <span className="text-muted">Còn chia</span>
        <span>
          {formatK(item.amount)} − {formatK(sponsored)} = <b>{formatK(Math.max(0, item.amount - sponsored))}</b>
        </span>
      </p>
    </div>
  );
}
