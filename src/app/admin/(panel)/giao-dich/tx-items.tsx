"use client";

import { Ban, Building2, CircleCheck, HandCoins, LoaderCircle, Undo2, UserCheck, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { formatDateTime, formatVnd } from "@/lib/text";
import { assignTransaction, ignoreTransaction, restoreTransaction } from "../../actions";
import { Badge, btn, ConfirmButton, cx, Select, toast } from "@/components/ui";

export interface MemberOption {
  value: string;
  label: string;
  description: string;
  keywords: string;
  initials: string;
}

export function PendingItem({
  tx,
  members,
}: {
  tx: { id: number; amount: number; content: string; occurredAt: string };
  members: MemberOption[];
}) {
  const [memberId, setMemberId] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [pending, start] = useTransition();

  const assign = () => {
    if (!memberId) {
      setInvalid(true);
      toast.error("Chọn thành viên trước khi gán");
      return;
    }
    start(async () => {
      const res = await assignTransaction(tx.id, Number(memberId));
      if (res?.ok) toast.success(res.message ?? "Đã gán");
      else toast.error(res?.error ?? "Không gán được");
    });
  };

  return (
    <li className="space-y-3 rounded-2xl border border-line bg-card-2 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="tabular text-xl font-extrabold text-paid">+{formatVnd(tx.amount)}</span>
        <span className="text-xs text-muted">{formatDateTime(new Date(tx.occurredAt))}</span>
      </div>
      <p className="rounded-xl bg-card px-3 py-2 font-mono text-xs break-all text-muted">{tx.content || "(không có nội dung)"}</p>
      <Select
        value={memberId}
        onChange={(v) => {
          setMemberId(v);
          setInvalid(false);
        }}
        invalid={invalid}
        title="Tiền này của ai?"
        placeholder="Tiền này của ai?"
        icon={<UserRound />}
        searchable
        options={members.map((m) => ({ ...m, icon: <span className="text-xs font-bold">{m.initials}</span> }))}
      />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button type="button" onClick={assign} disabled={pending} className={btn.primary}>
          {pending ? <LoaderCircle className="animate-spin" /> : <UserCheck />}
          Gán cho người này
        </button>
        <ConfirmButton
          className={cx(btn.ghost, "px-4")}
          title="Không phải tiền bóng?"
          confirmLabel="Gỡ khoản này"
          icon={<Ban />}
          successMessage="Đã gỡ khỏi tiền bóng"
          onConfirm={() => ignoreTransaction(tx.id)}
        >
          <Ban />
        </ConfirmButton>
      </div>
    </li>
  );
}

export function HistoryRow({
  tx,
}: {
  tx: {
    id: number;
    amount: number;
    status: "matched" | "pending" | "ignored";
    source: "webhook" | "manual";
    label: string;
    occurredAt: string;
    memberName: string;
    matchLabel: string | null;
  };
}) {
  const [pending, start] = useTransition();
  const ignored = tx.status === "ignored";
  return (
    <li className={cx("flex min-h-16 items-center gap-3 px-4 py-2", ignored && "opacity-55")}>
      <span
        className={cx(
          "flex size-10 shrink-0 items-center justify-center rounded-xl [&>svg]:size-5",
          tx.source === "manual" ? "bg-due-soft text-due" : "bg-paid-soft text-paid",
        )}
      >
        {tx.source === "manual" ? <HandCoins /> : <Building2 />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className={cx("tabular font-bold", ignored && "line-through")}>+{formatVnd(tx.amount)}</span>
          <span className="truncate text-sm font-semibold">{tx.memberName}</span>
          {tx.matchLabel && <Badge tone="brand">{tx.matchLabel}</Badge>}
        </p>
        <p className="truncate text-xs text-muted">
          {formatDateTime(new Date(tx.occurredAt))} · {tx.label}
        </p>
      </div>
      {ignored ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await restoreTransaction(tx.id);
              if (r?.ok) toast.success(r.message ?? "Đã khôi phục");
              else toast.error(r?.error ?? "Không khôi phục được");
            })
          }
          className={cx(btn.small, "bg-card-2")}
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <Undo2 />}
          Khôi phục
        </button>
      ) : (
        <>
          <Badge tone="paid">
            <CircleCheck />
          </Badge>
          <ConfirmButton
            className={cx(btn.small, "text-muted")}
            title="Gỡ giao dịch này?"
            confirmLabel="Gỡ"
            icon={<Ban />}
            successMessage="Đã gỡ giao dịch"
            onConfirm={() => ignoreTransaction(tx.id)}
          >
            Gỡ
          </ConfirmButton>
        </>
      )}
    </li>
  );
}
