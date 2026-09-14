import { useState } from "react";
import { usePatchStudent } from "@api/mutations";
import type { AdminStudent, AdminStudentPatch, Plan } from "@api/types";
import { Button } from "@shared/ui/Button";
import { Dialog } from "@shared/ui/Dialog";
import { Field } from "@shared/ui/Field";
import { Input } from "@shared/ui/Input";

const FORM_ID = "plan-form";

interface PlanDialogProps {
  student: AdminStudent | null;
  onClose: () => void;
}

/** 调整学生档位：FREE / PRO，PRO 可选到期日（空 = 永久） */
export function PlanDialog({ student, onClose }: PlanDialogProps) {
  const patch = usePatchStudent();

  function close() {
    patch.reset();
    onClose();
  }

  function save(body: AdminStudentPatch) {
    if (!student) return;
    patch.mutate({ id: student.id, body }, { onSuccess: close });
  }

  return (
    <Dialog
      open={student !== null}
      title={student ? `档位 · ${student.name}` : "档位"}
      onClose={close}
      footer={
        <>
          <Button type="button" onClick={close}>
            取消
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} disabled={patch.isPending}>
            {patch.isPending ? "保存中…" : "保存"}
          </Button>
        </>
      }
    >
      {student && <PlanForm key={student.id} student={student} error={patch.error?.message ?? null} onSubmit={save} />}
    </Dialog>
  );
}

interface PlanFormProps {
  student: AdminStudent;
  error: string | null;
  onSubmit: (body: AdminStudentPatch) => void;
}

function PlanForm({ student, error, onSubmit }: PlanFormProps) {
  const [plan, setPlan] = useState<Plan>(student.plan);
  const [date, setDate] = useState(student.proExpiresAt?.slice(0, 10) ?? "");

  return (
    <form
      id={FORM_ID}
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ plan, proExpiresAt: plan === "PRO" && date ? `${date}T00:00:00.000Z` : null });
      }}
    >
      <fieldset className="flex gap-6">
        <legend className="mb-1.5 text-xs font-medium text-neutral-800">档位</legend>
        {(["FREE", "PRO"] as const).map((p) => (
          <label key={p} className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="radio" name="plan" value={p} checked={plan === p} onChange={() => setPlan(p)} />
            {p}
          </label>
        ))}
      </fieldset>

      {plan === "PRO" && (
        <Field label="PRO 到期日期" htmlFor="plan-expires" hint="留空表示永久有效">
          <Input id="plan-expires" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-700">
          保存失败：{error}
        </p>
      )}
    </form>
  );
}
