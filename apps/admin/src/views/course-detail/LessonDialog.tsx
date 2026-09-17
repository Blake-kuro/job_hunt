import { zodResolver } from "@hookform/resolvers/zod";
import type { AdminCourseDetail, AdminLesson } from "@job-hunt/api-client/types";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@job-hunt/ui/components/select";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useCreateLesson, usePatchLesson, useReorderLessons } from "@api/mutations";
import { defaultValues, type FormValues, fromEntity, NO_CHAPTER, schema, toBody } from "./lesson-schema";
import { moveLessonToGroup, toOrderBody } from "./structure";

interface LessonDialogProps {
  course: AdminCourseDetail;
  open: boolean;
  /** 编辑时的课时；null = 新建 */
  lesson: AdminLesson | null;
  /** 新建时的默认章（从某章的「新建课时」入口进来）；undefined = 未分章 */
  defaultChapterId?: string;
  onClose: () => void;
}

/** 新建 / 编辑课时：标题、所属章（可移动到别的章）、试看 */
export function LessonDialog({ course, open, lesson, defaultChapterId, onClose }: LessonDialogProps) {
  const courseId = course.id;
  const chapters = course.chapters;
  const create = useCreateLesson();
  const patch = usePatchLesson();
  const reorder = useReorderLessons();
  const pending = create.isPending || patch.isPending || reorder.isPending;
  const serverError = (lesson ? (patch.error ?? reorder.error) : create.error)?.message ?? null;

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    if (open) form.reset(lesson ? fromEntity(lesson) : { ...defaultValues, chapterId: defaultChapterId ?? NO_CHAPTER });
  }, [open, lesson, defaultChapterId, form]);

  function close() {
    create.reset();
    patch.reset();
    reorder.reset();
    onClose();
  }

  return (
    <FormDialog
      open={open}
      title={lesson ? `编辑课时 · ${lesson.title}` : "新建课时"}
      onClose={close}
      form={form}
      onSubmit={async (values) => {
        const body = toBody(values);
        try {
          if (lesson) {
            await patch.mutateAsync({ id: lesson.id, courseId, body });
            // 后端换章只改 chapterId 不改序号：再提交一次整体顺序，让它排到目标组末尾
            const moved =
              body.chapterId !== lesson.chapterId ? moveLessonToGroup(course, lesson.id, body.chapterId ?? null) : null;
            if (moved) await reorder.mutateAsync({ courseId, body: toOrderBody(moved) });
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
            <FormLabel>课时标题</FormLabel>
            <FormControl>
              <Input autoFocus maxLength={200} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="chapterId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>所属章</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value={NO_CHAPTER}>未分章</SelectItem>
                {chapters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lesson && <FormDescription>换章后课时会排到目标章末尾</FormDescription>}
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="freePreview"
        render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
            </FormControl>
            <FormLabel className="font-normal">允许试看（未开通的学生也能播放）</FormLabel>
            <FormMessage />
          </FormItem>
        )}
      />
    </FormDialog>
  );
}
