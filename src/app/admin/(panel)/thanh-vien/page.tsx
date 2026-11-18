import { Hash, Landmark, UserPlus, UserRound } from "lucide-react";
import { getMembers, getTeamState } from "@/lib/data";
import { addMember } from "../../actions";
import { ActionForm } from "@/components/action-form";
import { SheetButton } from "@/components/sheet-button";
import { btn, cx, Field, TextInput } from "@/components/ui";
import { MemberList } from "./member-list";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const [members, state] = await Promise.all([getMembers(), getTeamState()]);

  return (
    <div className="space-y-3">
      <SheetButton label="Thêm thành viên" icon={<UserPlus />} title="Thêm thành viên" className={cx(btn.primary, "w-full")}>
        <ActionForm
          action={addMember}
          schema="memberCreate"
          submit="Thêm thành viên"
          submitIcon={<UserPlus />}
          resetOnSuccess
          className="space-y-4"
          submitClassName="w-full"
        >
          <Field label="Họ tên" name="name">
            <TextInput name="name" placeholder="Nguyễn Văn Hùng" autoComplete="off" icon={<UserRound />} />
          </Field>
          <Field label="Mã chuyển khoản" name="code" optional>
            <TextInput
              name="code"
              placeholder="Tự tạo"
              maxLength={11}
              autoComplete="off"
              autoCapitalize="characters"
              icon={<Hash />}
              className="font-mono uppercase"
            />
          </Field>
          <Field label="Tên chủ tài khoản" name="bankHolder" optional>
            <TextInput
              name="bankHolder"
              placeholder="NGUYEN VAN HUNG"
              autoComplete="off"
              autoCapitalize="characters"
              icon={<Landmark />}
              className="uppercase"
            />
          </Field>
        </ActionForm>
      </SheetButton>

      <MemberList
        members={members.map((m) => ({
          id: m.id,
          name: m.name,
          code: m.code,
          active: m.active,
          guest: m.guest,
          bankHolder: m.bankHolder,
          balance: state.ledgers.get(m.id)?.balance ?? 0,
        }))}
      />
    </div>
  );
}
