"use client";

import { Search, UserRound, Users, UserX, X } from "lucide-react";
import { useState } from "react";
import { stripDiacritics } from "@/lib/text";
import { Card, CardHeader, Empty } from "@/components/ui";
import { MemberRow } from "./member-row";

export interface MemberItem {
  id: number;
  name: string;
  code: string;
  active: boolean;
  guest: boolean;
  bankHolder: string;
  balance: number;
}

/** Danh sách thành viên có ô tìm kiếm (tên hoặc mã). */
export function MemberList({ members }: { members: MemberItem[] }) {
  const [q, setQ] = useState("");
  const n = stripDiacritics(q.trim()).toLowerCase();
  const match = (m: MemberItem) => !n || stripDiacritics(`${m.name} ${m.code}`).toLowerCase().includes(n);
  const groups = [
    { key: "active", title: "Đang hoạt động", icon: <Users />, items: members.filter((m) => m.active) },
    { key: "guest", title: "Khách", icon: <UserRound />, items: members.filter((m) => m.guest) },
    { key: "off", title: "Đã nghỉ", icon: <UserX />, items: members.filter((m) => !m.active && !m.guest) },
  ];

  return (
    <>
      <label className="flex h-12 items-center gap-2 rounded-2xl border border-line bg-card px-3.5 shadow-sm">
        <Search className="size-[18px] text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm tên hoặc mã…"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/70"
        />
        {q && (
          <button type="button" aria-label="Xoá tìm kiếm" onClick={() => setQ("")} className="text-muted">
            <X className="size-4" />
          </button>
        )}
      </label>
      {groups.map((g) => {
        const items = g.items.filter(match);
        if (!items.length && (g.key !== "active" || n)) return null;
        return (
          <Card key={g.key}>
            <CardHeader icon={g.icon} title={g.title} subtitle={`${items.length} người`} />
            {items.length === 0 ? (
              <Empty icon={<Users />} title="Chưa có thành viên" />
            ) : (
              <ul className="divide-y divide-line">
                {items.map((m) => (
                  <MemberRow key={m.id} member={{ id: m.id, name: m.name, code: m.code, active: m.active, bankHolder: m.bankHolder }} balance={m.balance} />
                ))}
              </ul>
            )}
          </Card>
        );
      })}
      {n && groups.every((g) => !g.items.some(match)) && (
        <p className="py-6 text-center text-sm text-muted">Không tìm thấy “{q}”</p>
      )}
    </>
  );
}
