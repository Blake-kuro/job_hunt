import { zodResolver } from "@hookform/resolvers/zod";
import { FormDialog } from "@job-hunt/ui/components/form-dialog";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useCreateCourse } from "@api/mutations";
import { CourseFields } from "./CourseFields";
import { defaultValues, type FormValues, schema, toBody } from "./course-schema";

interface CourseDialogProps {
  open: boolean;
  onClose: () => void;
  /** 创建成功后（对话框已关）拿到新课程 id，通常用于跳详情 */
  onCreated: (id: string) => void;
}

/** 新建课程：只填基本信息；章 / 课时 / 视频在详情页编辑 */
export function CourseDialog({ open, onClose, onCreated }: CourseDialogProps) {
  const create = useCreateCourse();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    if (open) form.reset(defaultValues);
  }, [open, form]);

  function close() {
    create.reset();
    onClose();
  }

  return (
    <FormDialog
      open={open}
      wide
      title="新建课程"
      onClose={close}
      form={form}
      onSubmit={async (values) => {
        let id: string;
        try {
          ({ id } = await create.mutateAsync(toBody(values)));
        } catch {
          return; // 错误由 create.error 显示在对话框顶部
        }
        close();
        onCreated(id);
      }}
      pending={create.isPending}
      submitLabel="创建并进入详情"
      pendingLabel="创建中…"
      error={create.error && `创建失败：${create.error.message}`}
    >
      <CourseFields form={form} />
    </FormDialog>
  );
}
