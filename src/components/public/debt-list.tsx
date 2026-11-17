"use client";

import Link from "next/link";
import { ChevronRight, CircleCheck, Hourglass, PiggyBank, Search, SearchX, UserRound, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { formatK, memberPath, stripDiacritics } from "@/lib/text";
import { Avatar, Badge, Card, CardHeader } from "../ui";
import { useMe } from "../use-me";

export interface DebtRow {
  id: number;
  name: string;
  code: string;
  guest: boolean;
  balance: number;
  totalPaid: number;
  unpaid: number;
}

type Tone = "due" | "paid" | "muted";
const toneOf = (r: DebtRow): Tone => (r.balance < 0 ? "due" : r.balance > 0 ? "paid" : "muted");

function Row({ r }: { r: DebtRow }) {
  const tone = toneOf(r);
  return (
    <li>
      <Link href={memberPath(r.code)} className="flex min-h-16 items-center gap-3 px-4 py-2 active:bg-card-2">
        <Avatar name={r.name} id={r.id} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="truncate">{r.name}</span>
            {r.guest && <Badge tone="muted">Khách</Badge>}
          </span>
          <span className="block text-xs text-muted">
            {tone === "due" ? `${r.unpaid} trận chưa đủ` : `Đã trả ${formatK(r.totalPaid)}`}
          </span>
        </span>
        {tone === "due" && <Badge tone="due">Còn {formatK(-r.balance)}</Badge>}
        {tone === "paid" && <Badge tone="paid">Dư {formatK(r.balance)}</Badge>}
        {tone === "muted" && (
          <Badge tone="muted">
            <CircleCheck /> Đủ
          </Badge>
        )}
        <ChevronRight className="size-4 text-muted" />
      </Link>
    </li>
  );
}

function Section({ icon, title, rows }: { icon: ReactNode; title: string; rows: DebtRow[] }) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader icon={icon} title={title} />
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <Row key={r.id} r={r} />
        ))}
      </ul>
    </Card>
  );
}

/** rows đã sắp sẵn: chưa đóng (nợ nhiều trước) → trả dư → đã đủ. */
export function DebtList({ rows }: { rows: DebtRow[] }) {
  const [q, setQ] = useState("");
  const me = useMe();
  const n = stripDiacritics(q.trim()).toLowerCase();
  const mine = !n ? rows.find((r) => r.id === me) : undefined;
  const list = rows.filter((r) => r !== mine && (!n || stripDiacritics(r.name).toLowerCase().includes(n)));

  return (
    <>
      <label className="flex h-11 items-center gap-2 rounded-2xl border border-line bg-card px-3.5 shadow-sm">
        <Search className="size-[18px] text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm tên…"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/70"
        />
        {q && (
          <button type="button" aria-label="Xoá tìm kiếm" onClick={() => setQ("")} className="text-muted">
            <X className="size-4" />
          </button>
        )}
      </label>
      {mine && <Section icon={<UserRound />} title="Bạn" rows={[mine]} />}
      <Section icon={<Hourglass />} title="Chưa đóng" rows={list.filter((r) => r.balance < 0)} />
      <Section icon={<PiggyBank />} title="Trả dư" rows={list.filter((r) => r.balance > 0)} />
      <Section icon={<CircleCheck />} title="Đã đủ" rows={list.filter((r) => r.balance === 0)} />
      {n && list.length === 0 && (
        <Card className="flex flex-col items-center gap-2 p-8 text-muted">
          <SearchX className="size-8" />
          <p className="text-sm font-semibold">Không tìm thấy</p>
        </Card>
      )}
    </>
  );
}
