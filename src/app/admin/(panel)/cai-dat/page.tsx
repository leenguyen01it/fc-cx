import { Users, CalendarClock, KeyRound, MapPin, MessageSquareText, Hash, Landmark, Save, Settings, Shield, UserRound, Wallet } from "lucide-react";
import Image from "next/image";
import { getMembers, getSettings } from "@/lib/data";
import { BANKS } from "@/lib/vietqr";
import { saveSettings } from "../../actions";
import { ActionForm } from "@/components/action-form";
import { Card, CardHeader, Field, Select, Switch, TextInput, TimeField } from "@/components/ui";
import { TransferPreview } from "./transfer-preview";
import type { Settings as SettingsRow } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [st, mems] = await Promise.all([getSettings(), getMembers()]);
  const treasurerOptions = [
    { value: "", label: "Không có" },
    ...mems
      .filter((m) => (m.active && !m.guest) || m.id === st.treasurerId)
      .map((m) => ({ value: String(m.id), label: m.name, keywords: m.code })),
  ];

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader icon={<Settings />} title="Đội & tài khoản nhận tiền" />
        <ActionForm action={saveSettings} schema="settings" submit="Lưu cài đặt" submitIcon={<Save />} className="space-y-4 px-4 pb-4" submitClassName="w-full">
          <input type="hidden" name="defaultVenue" value={st.defaultVenue} />
          <input type="hidden" name="defaultTime" value={st.defaultTime} />
          <input type="hidden" name="teamAName" value={st.teamAName} />
          <input type="hidden" name="teamBName" value={st.teamBName} />
          <div className="grid grid-cols-[1fr_7.5rem] gap-3">
            <Field label="Tên đội" name="teamName">
              <TextInput name="teamName" defaultValue={st.teamName} icon={<Shield />} />
            </Field>
            <Field label="Mã đội" name="prefix">
              <TextInput name="prefix" defaultValue={st.prefix} icon={<Hash />} autoCapitalize="characters" className="font-mono uppercase" />
            </Field>
          </div>
          <Field
            label="Nội dung thêm sau mã"
            name="transferSuffix"
            optional
            hint={<TransferPreview />}
          >
            <TextInput name="transferSuffix" defaultValue={st.transferSuffix} placeholder="CK da bong" maxLength={25} icon={<MessageSquareText />} />
          </Field>
          <Field label="Ngân hàng" name="bankBin">
            <Select
              name="bankBin"
              defaultValue={st.bankBin}
              title="Chọn ngân hàng"
              placeholder="Chọn ngân hàng"
              icon={<Landmark />}
              searchable
              options={BANKS.map((b) => ({
                value: b.bin,
                label: b.name,
                icon: <Image src={`/banks/${b.bin}.png`} alt="" width={64} height={24} className="h-auto w-full object-contain" />,
              }))}
            />
          </Field>
          <Field label="Số tài khoản" name="accountNo">
            <TextInput name="accountNo" defaultValue={st.accountNo} inputMode="numeric" autoComplete="off" icon={<Wallet />} className="font-mono" />
          </Field>
          <Field label="Chủ tài khoản" name="accountName">
            <TextInput name="accountName" defaultValue={st.accountName} placeholder="NGUYEN VAN A" autoCapitalize="characters" icon={<UserRound />} className="uppercase" />
          </Field>
          <Switch
            name="dedicatedAccount"
            defaultChecked={st.dedicatedAccount}
            label="Tài khoản riêng của đội"
          />
          <Field label="Thành viên đứng tên tài khoản" name="treasurerId" optional>
            <Select
              name="treasurerId"
              defaultValue={st.treasurerId ? String(st.treasurerId) : ""}
              title="Thành viên đứng tên tài khoản"
              placeholder="Không có"
              icon={<KeyRound />}
              searchable
              options={treasurerOptions}
            />
          </Field>
        </ActionForm>
      </Card>

      <Card>
        <CardHeader icon={<CalendarClock />} title="Mặc định khi tạo trận" />
        <ActionForm action={saveSettings} schema="settings" submit="Lưu mặc định" submitIcon={<Save />} className="space-y-4 px-4 pb-4" submitClassName="w-full">
          <HiddenSettings st={st} except={["defaultVenue", "defaultTime", "teamAName", "teamBName"]} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tên đội 1" name="teamAName">
              <TextInput name="teamAName" defaultValue={st.teamAName} maxLength={12} icon={<Users />} />
            </Field>
            <Field label="Tên đội 2" name="teamBName">
              <TextInput name="teamBName" defaultValue={st.teamBName} maxLength={12} icon={<Users />} />
            </Field>
          </div>
          <Field label="Sân" name="defaultVenue">
            <TextInput name="defaultVenue" defaultValue={st.defaultVenue} maxLength={100} icon={<MapPin />} />
          </Field>
          <Field label="Giờ đá" name="defaultTime">
            <TimeField name="defaultTime" defaultValue={st.defaultTime} title="Giờ đá" />
          </Field>
        </ActionForm>
      </Card>

    </div>
  );
}

/** Form mặc định chỉ sửa 2 ô; các ô cài đặt khác gửi kèm dạng ẩn để giữ nguyên giá trị. */
function HiddenSettings({ st, except }: { st: SettingsRow; except: string[] }) {
  const values: Record<string, string> = {
    teamName: st.teamName,
    prefix: st.prefix,
    transferSuffix: st.transferSuffix,
    bankBin: st.bankBin,
    accountNo: st.accountNo,
    accountName: st.accountName,
    dedicatedAccount: st.dedicatedAccount ? "on" : "",
    treasurerId: st.treasurerId ? String(st.treasurerId) : "",
  };
  return (
    <>
      {Object.entries(values)
        .filter(([k]) => !except.includes(k))
        .map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
    </>
  );
}
