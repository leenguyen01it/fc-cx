"use client";

import { LoaderCircle } from "lucide-react";
import { startTransition, useActionState, useRef, useState, type ReactNode } from "react";
import {
  FORM_SCHEMAS,
  formDataToObject,
  toFieldErrors,
  type ActionState,
  type FieldErrors,
  type FormSchemaKey,
} from "@/lib/schemas";
import { btn, cx, FormErrorsContext, toast } from "./ui";

/**
 * Form gọi server action, có:
 *  - validate phía trình duyệt bằng cùng schema với server (báo lỗi ngay, không gửi request)
 *  - hiện lỗi từng ô (fieldErrors) server trả về
 *  - toast khi thành công / thất bại, tự reset form nếu cần
 *  - GIỮ NGUYÊN dữ liệu đã nhập khi có lỗi (React 19 mặc định xoá trắng form sau mỗi lần gửi
 *    qua <form action>, nên ở đây tự gửi bằng startTransition)
 */
export function ActionForm({
  action,
  schema,
  children,
  submit,
  submitIcon,
  className,
  submitClassName,
  resetOnSuccess,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  schema?: FormSchemaKey;
  children: ReactNode;
  submit: ReactNode;
  submitIcon?: ReactNode;
  className?: string;
  submitClassName?: string;
  resetOnSuccess?: boolean;
}) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formKey, setFormKey] = useState(0);
  const ref = useRef<HTMLFormElement>(null);

  /** Cuộn tới ô lỗi (input ẩn của Select/MoneyInput → lấy phần tử hiển thị bên cạnh). */
  function focusField(name?: string) {
    if (!name) return;
    const el = ref.current?.querySelector<HTMLElement>(`#${CSS.escape(name)}, [name="${name}"]`);
    const target =
      el instanceof HTMLInputElement && el.type === "hidden" ? (el.nextElementSibling as HTMLElement | null) : el;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus?.({ preventScroll: true });
  }

  const [, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const res = await action(prev, fd);
    setErrors(res?.fieldErrors ?? {});
    if (res?.error) toast.error(res.error);
    else if (res?.fieldErrors) {
      toast.error(Object.values(res.fieldErrors)[0] ?? "Kiểm tra lại các ô báo đỏ");
      focusField(Object.keys(res.fieldErrors)[0]);
    } else if (res?.ok) {
      toast.success(res.message ?? "Đã lưu");
      if (resetOnSuccess) setFormKey((k) => k + 1);
    }
    return res;
  }, undefined);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (schema) {
      const parsed = FORM_SCHEMAS[schema].safeParse(formDataToObject(fd));
      if (!parsed.success) {
        const errs = toFieldErrors(parsed.error);
        setErrors(errs);
        focusField(Object.keys(errs)[0]);
        if ("vibrate" in navigator) navigator.vibrate?.([30, 40, 30]);
        return;
      }
    }
    startTransition(() => formAction(fd));
  }

  return (
    <FormErrorsContext.Provider
      value={{
        errors,
        clear: (name) =>
          setErrors((prev) => {
            if (!(name in prev)) return prev;
            const next = { ...prev };
            delete next[name];
            return next;
          }),
      }}
    >
      <form ref={ref} key={formKey} onSubmit={onSubmit} noValidate className={className}>
        {children}
        {errors._form && <p className="rounded-2xl bg-team-a-soft px-3 py-2 text-sm text-team-a">{errors._form}</p>}
        <button type="submit" disabled={pending} className={cx(btn.primary, submitClassName)}>
          {pending ? <LoaderCircle className="animate-spin" /> : submitIcon}
          {pending ? "Đang xử lý…" : submit}
        </button>
      </form>
    </FormErrorsContext.Provider>
  );
}
