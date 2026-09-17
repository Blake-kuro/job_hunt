import { zodResolver } from "@hookform/resolvers/zod";
import type { AdminMaterial } from "@job-hunt/api-client/types";
import { Checkbox } from "@job-hunt/ui/components/checkbox";
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
import { Textarea } from "@job-hunt/ui/components/textarea";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useSaveContent } from "@api/mutations";
import { defaultValues, type FormValues, fromEntity, schema, toBody } from "./material-schema";

interface MaterialDialogProps {
  mode: "create" | "edit";
  material: AdminMaterial | null;
  open: boolean;
  onClose: () => void;
}

/** 新增 / 编辑资料：同一个表单，edit 时用 material 预填，保存走 useSaveContent（带 id 即更新） */
export function MaterialDialog({ mode, material, open, onClose }: MaterialDialogProps) {
  const save = useSaveContent();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    if (open) form.reset(material ? fromEntity(material) : defaultValues);
  }, [open, material, form]);

  function close() {
    save.reset();
    onClose();
  }

  return (
    <FormDialog
      open={open}
      title={mode === "create" ? "新增资料" : "编辑资料"}
      onClose={close}
      form={form}
      onSubmit={async (values) => {
        try {
          await save.mutateAsync(toBody(values, material?.id));
        } catch {
          return; // 错误由 save.error 显示在对话框顶部
        }
        close();
      }}
      pending={save.isPending}
      submitLabel={save.isPending ? "保存中…" : "保存"}
      error={save.error && `保存失败：${save.error.message}`}
    >
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem className="gap-1.5">
            <FormLabel className="text-xs text-neutral-800">标题</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem className="gap-1.5">
            <FormLabel className="text-xs text-neutral-800">描述</FormLabel>
            <FormControl>
              <Textarea rows={3} {...field} />
            </FormControl>
            <FormDescription className="text-xs text-neutral-600">可选；学生端列表里显示</FormDescription>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="category"
        render={({ field }) => (
          <FormItem className="gap-1.5">
            <FormLabel className="text-xs text-neutral-800">分类</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormDescription className="text-xs text-neutral-600">如「简历」「面经」；留空为「未分类」</FormDescription>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="url"
        render={({ field }) => (
          <FormItem className="gap-1.5">
            <FormLabel className="text-xs text-neutral-800">链接</FormLabel>
            <FormControl>
              <Input inputMode="url" placeholder="https://" {...field} />
            </FormControl>
            <FormDescription className="text-xs text-neutral-600">
              学生点击后打开的地址，需以 http:// 或 https:// 开头
            </FormDescription>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="published"
        render={({ field }) => (
          <FormItem className="flex items-center gap-2">
            <FormControl>
              <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
            </FormControl>
            <FormLabel className="cursor-pointer text-sm font-normal">已发布（学生端可见）</FormLabel>
          </FormItem>
        )}
      />
    </FormDialog>
  );
}
