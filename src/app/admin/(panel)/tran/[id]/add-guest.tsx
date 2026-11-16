"use client";

import { LoaderCircle, UserPlus, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { addGuest } from "../../../actions";
import { btn, cx, Field, Sheet, TextInput, toast } from "@/components/ui";

export interface GuestMember {
  id: number;
  name: string;
  code: string;
  active: boolean;
  guest: boolean;
}

export function AddGuestButton({ onAdded }: { onAdded: (m: GuestMember) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const r = await addGuest(name);
      if (r?.member) {
        onAdded({ ...r.member, active: false, guest: true });
        toast.success(r.message ?? "Đã thêm khách");
        setName("");
        setError(undefined);
        setOpen(false);
      } else setError(r?.fieldErrors?.name ?? r?.error ?? "Không thêm được");
    });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cx(btn.soft, "w-full")}>
        <UserPlus /> Thêm khách
      </button>
      <Sheet
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Thêm khách"
        icon={<UserPlus />}
        footer={
          <button type="button" disabled={pending} onClick={submit} className={cx(btn.primary, "w-full")}>
            {pending ? <LoaderCircle className="animate-spin" /> : <UserPlus />}
            Thêm
          </button>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label="Tên" error={error}>
            <TextInput
              value={name}
              autoFocus
              maxLength={60}
              placeholder="Nguyễn Văn A"
              icon={<UserRound />}
              invalid={!!error}
              onChange={(e) => {
                setName(e.target.value);
                setError(undefined);
              }}
            />
          </Field>
        </form>
      </Sheet>
    </>
  );
}
