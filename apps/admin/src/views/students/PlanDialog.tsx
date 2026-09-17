import { zodResolver } from "@hookform/resolvers/zod";
import type { AdminStudent } from "@job-hunt/api-client/types";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@job-hunt/ui/components/form";
import { FormDialog } from "@job-hunt/ui/components/form-dialog";
import { Input } from "@job-hunt/ui/components/input";
import { Label } from "@job-hunt/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@job-hunt/ui/components/radio-group";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { usePatchStudent } from "@api/mutations";
import { defaultValues, type FormValues, fromEntity, schema, toBody } from "./plan-schema";

interface PlanDialogProps {
  student: AdminStudent | null;
  onClose: () => void;
}

/** 调整学生档位：FREE / PRO，PRO 可选到期日（空 = 永久） */
export function PlanDialog({ student, onClose }: PlanDialogProps) {
  const patch = usePatchStudent();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });
  const plan = form.watch("plan");

  useEffect(() => {
    if (student) form.reset(fromEntity(student));
  }, [student, form]);

  function close() {
    patch.reset();
    onClose();
  }

  return (
    <FormDialog
      open={student !== null}
      title={student ? `档位 · ${student.name}` : "档位"}
      onClose={close}
      form={form}
      onSubmit={async (values) => {
        if (!student) return;
        try {
          await patch.mutateAsync({ id: student.id, body: toBody(values) });
        } catch {
          return; // 错误由 patch.error 显示在对话框顶部
        }
        close();
      }}
      pending={patch.isPending}
      submitLabel={patch.isPending ? "保存中…" : "保存"}
      error={patch.error && `保存失败：${patch.error.message}`}
    >
      <FormField
        control={form.control}
        name="plan"
        render={({ field }) => (
          <FormItem className="gap-1.5">
            <FormLabel className="text-xs text-neutral-800">档位</FormLabel>
            <FormControl>
              <RadioGroup className="flex gap-6" value={field.value} onValueChange={field.onChange}>
                {(["FREE", "PRO"] as const).map((p) => (
                  <div key={p} className="flex items-center gap-2">
                    <RadioGroupItem id={`plan-${p}`} value={p} />
                    <Label htmlFor={`plan-${p}`} className="cursor-pointer text-sm font-normal">
                      {p}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />

      {plan === "PRO" && (
        <FormField
          control={form.control}
          name="proExpiresAt"
          render={({ field }) => (
            <FormItem className="gap-1.5">
              <FormLabel className="text-xs text-neutral-800">PRO 到期日期</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormDescription className="text-xs text-neutral-600">留空表示永久有效</FormDescription>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      )}
    </FormDialog>
  );
}
