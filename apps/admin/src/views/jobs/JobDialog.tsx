import { zodResolver } from "@hookform/resolvers/zod";
import type { AdminJob, CategoryId } from "@job-hunt/api-client/types";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@job-hunt/ui/components/select";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useCreateJob, usePatchJob } from "@api/mutations";
import { CATEGORY_LABEL, defaultValues, type FormValues, fromEntity, schema, toBody } from "./job-schema";

interface JobDialogProps {
  mode: "create" | "edit";
  job: AdminJob | null;
  open: boolean;
  onClose: () => void;
}

type TextKey = Exclude<keyof FormValues, "categoryId">;

const TEXT_FIELDS: { key: TextKey; label: string; type?: "date" | "url"; hint?: string }[] = [
  { key: "enterpriseName", label: "企业名称" },
  { key: "position", label: "岗位名称" },
  { key: "serialNumber", label: "序号" },
  { key: "recruitmentBatch", label: "批次" },
  { key: "enterpriseNature", label: "企业性质" },
  { key: "industry", label: "行业" },
  { key: "workLocation", label: "城市" },
  { key: "graduationYear", label: "届别" },
  { key: "degree", label: "学历" },
  { key: "announcementLink", label: "公告链接", type: "url" },
  { key: "deliveryAddress", label: "投递地址", type: "url" },
  { key: "deadline", label: "截止说明", hint: "展示给学生的文字，如「10 月底」" },
  { key: "deadlineAt", label: "截止日期", type: "date", hint: "用于排序与到期提示，可留空" },
];

/** 新增 / 编辑岗位：同一个表单，edit 时用 job 预填 */
export function JobDialog({ mode, job, open, onClose }: JobDialogProps) {
  const create = useCreateJob();
  const patch = usePatchJob();
  const pending = create.isPending || patch.isPending;
  const serverError = (mode === "create" ? create.error : patch.error)?.message ?? null;

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });

  // 打开时按 job 预填（或清空）；关闭时不动，避免关闭动画期间闪回空表单
  useEffect(() => {
    if (open) form.reset(job ? fromEntity(job) : defaultValues);
  }, [open, job, form]);

  function close() {
    create.reset();
    patch.reset();
    onClose();
  }

  return (
    <FormDialog
      open={open}
      wide
      title={mode === "create" ? "新增岗位" : job ? `编辑岗位 · ${job.enterpriseName}` : "编辑岗位"}
      onClose={close}
      form={form}
      onSubmit={async (values) => {
        const body = toBody(values);
        try {
          if (mode === "edit") {
            if (!job) return;
            await patch.mutateAsync({ id: job.id, body });
          } else {
            await create.mutateAsync(body);
          }
        } catch {
          return; // 错误由 mutation.error 显示在对话框顶部
        }
        close();
      }}
      pending={pending}
      submitLabel={pending ? "保存中…" : "保存"}
      error={serverError && `保存失败：${serverError}`}
    >
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem className="gap-1.5">
              <FormLabel className="text-xs text-neutral-800">分类</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {([1, 2, 3] as CategoryId[]).map((id) => (
                    <SelectItem key={id} value={String(id)}>
                      {CATEGORY_LABEL[id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
        {TEXT_FIELDS.map((f) => (
          <FormField
            key={f.key}
            control={form.control}
            name={f.key}
            render={({ field }) => (
              <FormItem className="gap-1.5">
                <FormLabel className="text-xs text-neutral-800">{f.label}</FormLabel>
                <FormControl>
                  <Input
                    type={f.type === "date" ? "date" : "text"}
                    inputMode={f.type === "url" ? "url" : undefined}
                    {...field}
                  />
                </FormControl>
                {f.hint && <FormDescription className="text-xs text-neutral-600">{f.hint}</FormDescription>}
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        ))}
      </div>
    </FormDialog>
  );
}
