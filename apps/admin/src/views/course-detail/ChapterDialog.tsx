import { zodResolver } from "@hookform/resolvers/zod";
import type { AdminChapter } from "@job-hunt/api-client/types";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@job-hunt/ui/components/form";
import { FormDialog } from "@job-hunt/ui/components/form-dialog";
import { Input } from "@job-hunt/ui/components/input";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useCreateChapter, usePatchChapter } from "@api/mutations";
import { defaultValues, type FormValues, fromEntity, schema, toBody } from "./chapter-schema";

interface ChapterDialogProps {
  courseId: string;
  open: boolean;
  /** 编辑时的章；null = 新建 */
  chapter: AdminChapter | null;
  onClose: () => void;
}

/** 新建 / 重命名章 */
export function ChapterDialog({ courseId, open, chapter, onClose }: ChapterDialogProps) {
  const create = useCreateChapter();
  const patch = usePatchChapter();
  const pending = create.isPending || patch.isPending;
  const serverError = (chapter ? patch.error : create.error)?.message ?? null;

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    if (open) form.reset(chapter ? fromEntity(chapter) : defaultValues);
  }, [open, chapter, form]);

  function close() {
    create.reset();
    patch.reset();
    onClose();
  }

  return (
    <FormDialog
      open={open}
      title={chapter ? "重命名章" : "新建章"}
      onClose={close}
      form={form}
      onSubmit={async (values) => {
        const body = toBody(values);
        try {
          if (chapter) {
            if (body.title !== chapter.title) await patch.mutateAsync({ id: chapter.id, courseId, body });
          } else {
            await create.mutateAsync({ courseId, body });
          }
        } catch {
          return; // 错误由 mutation.error 显示在对话框顶部
        }
        close();
      }}
      pending={pending}
      error={serverError && `保存失败：${serverError}`}
    >
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>章名称</FormLabel>
            <FormControl>
              <Input autoFocus maxLength={200} placeholder="如「第一章 简历准备」" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </FormDialog>
  );
}
