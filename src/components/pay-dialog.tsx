"use client";

import { Banknote, Info, Landmark, QrCode, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { recordCash } from "@/app/admin/actions";
import { useState, type ReactNode } from "react";
import { buildVietQr } from "@/lib/vietqr";
import { formatVnd } from "@/lib/text";
import { CopyButton } from "./copy-button";
import { VietQrFrame } from "./qr-image";
import { SaveQrButton } from "./save-qr-button";
import { BankAppPicker } from "./bank-app-picker";
import { Sheet, ConfirmButton, btn, cx, toast } from "./ui";

export interface BankInfo {
  bankBin: string;
  bankName: string;
  accountNo: string;
  accountName: string;
}

/** Nút "Trả" → sheet có QR (đã điền sẵn số tiền & nội dung) và thông tin chuyển khoản. */
export function PayDialog({
  name,
  content,
  amount,
  bank,
  trigger,
  triggerClassName,
  note,
  teamName,
  cash,
}: {
  teamName: string;
  /** Có khi admin đang đăng nhập: nút "Đã nhận tiền mặt". */
  cash?: { memberId: number; matchId?: number };
  name: string;
  content: string;
  amount: number;
  bank: BankInfo;
  trigger: ReactNode;
  triggerClassName?: string;
  note?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ready = !!(bank.bankBin && bank.accountNo);
  const payload = ready ? buildVietQr({ bankBin: bank.bankBin, accountNo: bank.accountNo, amount, content }) : null;

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        {trigger}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={name} icon={<QrCode />}>
        {!ready ? (
          <div className="flex items-start gap-3 rounded-2xl bg-due-soft p-4 text-sm text-due">
            <TriangleAlert className="size-5 shrink-0" />
            Admin chưa cấu hình tài khoản ngân hàng của đội.
          </div>
        ) : (
          <>
            {note && (
              <div role="note" className="mb-3 flex items-start gap-2.5 rounded-2xl border border-team-b/20 bg-team-b-soft px-3 py-2.5 text-sm text-team-b">
                <Info className="mt-px size-[18px] shrink-0" />
                <span>{note}</span>
              </div>
            )}
            <BankAppPicker bank={bank} amount={amount} content={content} />
            <div className="my-4 flex items-center gap-3 text-xs font-semibold text-muted">
              <span className="h-px flex-1 bg-line" /> hoặc quét mã QR <span className="h-px flex-1 bg-line" />
            </div>
            <VietQrFrame
              payload={payload!}
              bankBin={bank.bankBin}
              bankName={bank.bankName}
              alt={`VietQR chuyển ${formatVnd(amount)}`}
              className="mx-auto max-w-72"
            />
            <SaveQrButton card={{ teamName, name, content, ...bank }} />
            {cash && (
              <ConfirmButton
                className={cx(btn.ghost, "mt-2 w-full border-paid/40 text-paid")}
                title={`Đã nhận ${formatVnd(amount)} tiền mặt?`}
                description={name}
                confirmLabel="Đã nhận"
                tone="primary"
                icon={<Banknote />}
                onConfirm={async () => {
                  const r = await recordCash(cash.memberId, amount, cash.matchId);
                  if (r?.error) throw new Error(r.error);
                  toast.success(r?.message ?? "Đã ghi nhận");
                  setOpen(false);
                  router.refresh();
                }}
              >
                <Banknote /> Đã nhận tiền mặt · {formatVnd(amount)}
              </ConfirmButton>
            )}

            <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line">
              <Row k="Số tiền" v={<b className="tabular text-lg text-brand">{formatVnd(amount)}</b>} copy={String(amount)} />
              <Row k="Nội dung" v={<b className="font-mono tracking-wide">{content}</b>} copy={content} />
              <Row k="Số TK" v={<span className="font-mono">{bank.accountNo}</span>} copy={bank.accountNo} />
              <Row
                k="Ngân hàng"
                v={
                  <span className="flex items-center gap-1.5">
                    <Landmark className="size-4 text-muted" />
                    {bank.bankName}
                  </span>
                }
              />
              <Row k="Chủ TK" v={bank.accountName} />
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}

function Row({ k, v, copy }: { k: string; v: ReactNode; copy?: string }) {
  return (
    <div className="flex min-h-13 items-center gap-2 px-3.5 py-2">
      <span className="w-20 shrink-0 text-sm text-muted">{k}</span>
      <span className="min-w-0 flex-1 truncate text-sm">{v}</span>
      {copy && (
        <CopyButton
          text={copy}
          ariaLabel={`Copy ${k}`}
          toastMessage={`Đã copy ${k.toLowerCase()}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card-2 text-muted active:scale-90 [&>svg]:size-4"
        />
      )}
    </div>
  );
}
