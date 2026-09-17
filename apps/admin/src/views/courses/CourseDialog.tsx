import { zodResolver } from "@hookform/resolvers/zod";
import type { AdminCourse } from "@job-hunt/api-client/types";
import { Button } from "@job-hunt/ui/components/button";
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
import { useFieldArray, useForm } from "react-hook-form";
import { useSaveContent } from "@api/mutations";
import { defaultValues, emptyLessonRow, type FormValues, fromEntity, schema, toBody } from "./course-schema";

interface CourseDialogProps {
  mode: "create" | "edit";
  course: AdminCourse | null;
  open: boolean;
  onClose: () => void;
}

const lessonGrid = "grid grid-cols-[1fr_1.4fr_96px_auto] items-start gap-2";

/** 新增 / 编辑课程：同一个表单，edit 时用 course 预填；保存会整体替换课时（顺序即 sortOrder） */
export function CourseDialog({ mode, course, open, onClose }: CourseDialogProps) {
  const save = useSaveContent();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: "lessons" });

  useEffect(() => {
    if (open) form.reset(course ? fromEntity(course) : defaultValues);
  }, [open, course, form]);

  function close() {
    save.reset();
    onClose();
  }

  return (
    <FormDialog
      open={open}
      wide
      title={mode === "create" ? "新增课程" : "编辑课程"}
      onClose={close}
      form={form}
      onSubmit={async (values) => {
        try {
          await save.mutateAsync(toBody(values, course?.id));
        } catch {
          return; // 错误由 save.error 显示在对话框顶部
        }
        close();
      }}
      pending={save.isPending}
      error={save.error && `保存失败：${save.error.message}`}
    >
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>标题</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="coverUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>封面 URL</FormLabel>
              <FormControl>
                <Input inputMode="url" placeholder="https://" {...field} />
              </FormControl>
              <FormDescription>可选；需以 http:// 或 https:// 开头</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>描述</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormDescription>可选；学生端课程页显示</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1.5 text-xs font-medium text-neutral-800">
            课时（保存会整体替换，顺序即播放顺序）
          </legend>
          {fields.length > 0 && (
            <div className={`${lessonGrid} text-[11px] uppercase tracking-[0.08em] text-neutral-700`}>
              <span>标题</span>
              <span>视频 URL</span>
              <span>时长（分钟）</span>
              <span />
            </div>
          )}
          {fields.map((row, i) => (
            <div key={row.id} className={lessonGrid}>
              <FormField
                control={form.control}
                name={`lessons.${i}.title`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input aria-label={`第 ${i + 1} 课时标题`} placeholder="课时标题" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`lessons.${i}.videoUrl`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        aria-label={`第 ${i + 1} 课时视频 URL`}
                        inputMode="url"
                        placeholder="https://"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`lessons.${i}.durationMinutes`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input aria-label={`第 ${i + 1} 课时时长`} type="number" min={1} step={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-9"
                  aria-label={`上移第 ${i + 1} 课时`}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-9"
                  aria-label={`下移第 ${i + 1} 课时`}
                  disabled={i === fields.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  ↓
                </Button>
                <Button type="button" size="sm" variant="ghost" className="min-h-9" onClick={() => remove(i)}>
                  删除
                </Button>
              </div>
            </div>
          ))}
          <div>
            <Button type="button" size="sm" onClick={() => append({ ...emptyLessonRow })}>
              添加课时
            </Button>
          </div>
        </fieldset>

        <FormField
          control={form.control}
          name="published"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 sm:col-span-2">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              </FormControl>
              <FormLabel className="cursor-pointer text-sm font-normal text-text">已发布（学生端可见）</FormLabel>
            </FormItem>
          )}
        />
      </div>
    </FormDialog>
  );
}
