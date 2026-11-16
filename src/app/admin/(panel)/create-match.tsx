"use client";

import { CalendarPlus, Drumstick, ListPlus, Scale, Swords } from "lucide-react";
import { useState } from "react";
import { createMatch } from "../actions";
import { ActionForm } from "@/components/action-form";
import { btn, cx, DateField, Field, Select, Sheet } from "@/components/ui";

const PRESET_OPTIONS = [
  { value: "standard", label: "Kèo chuẩn", description: "Sân 7/3 · ăn 50/50", icon: <Scale /> },
  { value: "bet", label: "Kèo gà", description: "Sân 50/50 · ăn chia đều · gà đội thua", icon: <Drumstick /> },
  { value: "away", label: "Đá đối", description: "Sân phần mình trả · chia đều", icon: <Swords /> },
  { value: "empty", label: "Trống", description: "Tự thêm từng khoản", icon: <ListPlus /> },
];

/** Nút "+ Tạo trận" mở sheet chọn ngày & mẫu kèo. */
export function CreateMatchButton({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cx(btn.primary, "w-full")}>
        <CalendarPlus /> Tạo trận
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Tạo trận" icon={<CalendarPlus />}>
        <ActionForm
          action={createMatch}
          schema="createMatch"
          submit="Tạo trận"
          submitIcon={<CalendarPlus />}
          className="space-y-4 pb-2"
          submitClassName="w-full"
        >
          <Field label="Ngày đá" name="date">
            <DateField name="date" defaultValue={today} title="Ngày đá" />
          </Field>
          <Field label="Mẫu kèo" name="preset">
            <Select name="preset" defaultValue="standard" title="Chọn mẫu kèo" options={PRESET_OPTIONS} />
          </Field>
        </ActionForm>
      </Sheet>
    </>
  );
}
