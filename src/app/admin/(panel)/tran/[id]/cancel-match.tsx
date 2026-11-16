"use client";

import { CloudRain, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { cancelMatch } from "../../../actions";
import { btn, cx, Sheet, TextInput, toast } from "@/components/ui";

const REASONS = ["Trời mưa", "Không đủ người", "Sân bận"];

export function CancelMatchButton({ id, onDone }: { id: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Trời mưa");
  const [pending, start] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-team-b active:bg-team-b-soft"
      >
        <CloudRain className="size-4" /> Huỷ trận
      </button>
      <Sheet
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Huỷ trận?"
        icon={<CloudRain />}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={btn.ghost} disabled={pending} onClick={() => setOpen(false)}>
              Đóng
            </button>
            <button
              type="button"
              className={btn.primary}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await cancelMatch(id, reason);
                  if (r?.ok) {
                    toast.success(r.message ?? "Đã huỷ");
                    setOpen(false);
                    onDone();
                  } else toast.error(r?.error ?? "Không huỷ được");
                })
              }
            >
              {pending && <LoaderCircle className="animate-spin" />}
              Huỷ trận
            </button>
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={cx(
                "h-9 rounded-full border px-3.5 text-sm font-semibold transition active:scale-95",
                reason === r ? "border-brand bg-brand-soft text-brand" : "border-line bg-card text-muted",
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <TextInput value={reason} onChange={(e) => setReason(e.target.value)} maxLength={100} placeholder="Lý do" aria-label="Lý do huỷ" />
      </Sheet>
    </>
  );
}
