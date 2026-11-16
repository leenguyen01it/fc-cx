"use client";

import { ChevronDown, History } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { btn, Card, CardHeader, cx, Segmented } from "@/components/ui";
import { HistoryRow } from "./tx-items";

type Tx = ComponentProps<typeof HistoryRow>["tx"];
type Filter = "all" | "bank" | "cash" | "ignored";
const PAGE = 20;

/** Lịch sử giao dịch: lọc theo nguồn, hiện 20 dòng + "Xem thêm". */
export function TxHistory({ txs }: { txs: Tx[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE);
  const list = txs.filter((t) =>
    filter === "all"
      ? t.status !== "ignored"
      : filter === "ignored"
        ? t.status === "ignored"
        : t.status !== "ignored" && t.source === (filter === "bank" ? "webhook" : "manual"),
  );
  return (
    <Card>
      <CardHeader icon={<History />} title="Lịch sử" subtitle={`${list.length} giao dịch`} />
      <div className="px-4 pb-3">
        <Segmented
          size="sm"
          ariaLabel="Lọc giao dịch"
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setLimit(PAGE);
          }}
          options={[
            { value: "all", label: "Tất cả" },
            { value: "bank", label: "Ngân hàng" },
            { value: "cash", label: "Tiền mặt" },
            { value: "ignored", label: "Đã gỡ" },
          ]}
        />
      </div>
      {list.length === 0 ? (
        <p className="px-4 pb-5 text-center text-sm text-muted">Không có giao dịch</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.slice(0, limit).map((t) => (
            <HistoryRow key={t.id} tx={t} />
          ))}
        </ul>
      )}
      {list.length > limit && (
        <div className="p-3">
          <button type="button" onClick={() => setLimit((l) => l + PAGE)} className={cx(btn.ghost, "w-full")}>
            <ChevronDown /> Xem thêm ({list.length - limit})
          </button>
        </div>
      )}
    </Card>
  );
}
