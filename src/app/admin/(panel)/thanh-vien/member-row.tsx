"use client";

import { ChevronRight, Hash, QrCode, Save, UserRound, UserRoundPen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatK, memberPath } from "@/lib/text";
import type { ActionState } from "@/lib/schemas";
import { updateMember } from "../../actions";
import { ActionForm } from "@/components/action-form";
import { Avatar, Badge, btn, cx, Field, Sheet, Switch, TextInput } from "@/components/ui";

export function MemberRow({
  member: m,
  balance,
}: {
  member: { id: number; name: string; code: string; active: boolean };
  balance: number;
}) {
  const [open, setOpen] = useState(false);
  // Đóng sheet khi lưu thành công
  const action = async (prev: ActionState, fd: FormData) => {
    const res = await updateMember(prev, fd);
    if (res?.ok) setOpen(false);
    return res;
  };

  return (
    <li>
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left active:bg-card-2">
        <Avatar name={m.name} id={m.id} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{m.name}</span>
          <span className="block font-mono text-xs text-muted">{m.code}</span>
        </span>
        {balance < 0 && <Badge tone="due">Nợ {formatK(-balance)}</Badge>}
        {balance > 0 && <Badge tone="paid">Dư {formatK(balance)}</Badge>}
        <ChevronRight className="size-4 shrink-0 text-muted" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={m.name} description={`Mã: ${m.code}`} icon={<UserRoundPen />}>
        <ActionForm action={action} schema="memberUpdate" submit="Lưu thay đổi" submitIcon={<Save />} className="space-y-4" submitClassName="w-full">
          <input type="hidden" name="id" value={m.id} />
          <Field label="Họ tên" name="name">
            <TextInput name="name" defaultValue={m.name} icon={<UserRound />} />
          </Field>
          <Field label="Mã chuyển khoản" name="code">
            <TextInput name="code" defaultValue={m.code} maxLength={11} icon={<Hash />} autoCapitalize="characters" className="font-mono uppercase" />
          </Field>
          <Switch name="active" defaultChecked={m.active} label="Đang hoạt động" />
          <Link href={memberPath(m.code)} className={cx(btn.soft, "w-full")}>
            <QrCode /> Xem thẻ QR
          </Link>
        </ActionForm>
      </Sheet>
    </li>
  );
}
