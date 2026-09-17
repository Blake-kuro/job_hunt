import { zodResolver } from "@hookform/resolvers/zod";
import type { AdminCourseDetail } from "@job-hunt/api-client/types";
import { Alert, AlertDescription } from "@job-hunt/ui/components/alert";
import { Button } from "@job-hunt/ui/components/button";
import { Form } from "@job-hunt/ui/components/form";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { usePatchCourse } from "@api/mutations";
import { CourseFields } from "@views/courses/CourseFields";
import { type FormValues, fromEntity, schema, toBody } from "@views/courses/course-schema";

interface CourseInfoFormProps {
  course: AdminCourseDetail;
}

/** 页内基本信息表单：保存走 PATCH（整体发送 body，所有字段都在表单里） */
export function CourseInfoForm({ course }: CourseInfoFormProps) {
  const patch = usePatchCourse();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: fromEntity(course) });

  // 服务端数据变化（保存成功 / 重新拉取）时同步表单，避免留着旧值
  useEffect(() => {
    form.reset(fromEntity(course));
  }, [course, form]);

  return (
    <Form {...form}>
      <form
        noValidate
        className="mt-4 flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => patch.mutate({ id: course.id, body: toBody(values) }))}
      >
        {patch.error && (
          <Alert variant="destructive">
            <AlertDescription>保存失败：{patch.error.message}</AlertDescription>
          </Alert>
        )}
        <CourseFields form={form} />
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={patch.isPending || !form.formState.isDirty}>
            {patch.isPending ? "保存中…" : "保存基本信息"}
          </Button>
          {patch.isSuccess && !form.formState.isDirty && <span className="text-xs text-neutral-600">已保存</span>}
        </div>
      </form>
    </Form>
  );
}
