import { useState } from "react";
import { useSaveContent } from "@api/mutations";
import type { AdminContentBody, AdminCourse } from "@api/types";
import { Button } from "@shared/ui/Button";
import { Dialog } from "@shared/ui/Dialog";
import { Field } from "@shared/ui/Field";
import { Input } from "@shared/ui/Input";
import { Textarea } from "@shared/ui/Textarea";
import { emptyLessonRow, fromLessons, HTTP_RE, type LessonRow, moveLesson, toCourseLessons } from "./lesson-rows";

const FORM_ID = "course-form";

interface CourseDialogProps {
  mode: "create" | "edit";
  course: AdminCourse | null;
  open: boolean;
  onClose: () => void;
}

/** 新增 / 编辑课程：同一个表单，edit 时用 course 预填；保存会整体替换课时（顺序即 sortOrder） */
export function CourseDialog({ mode, course, open, onClose }: CourseDialogProps) {
  const save = useSaveContent();

  function close() {
    save.reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      wide
      title={mode === "create" ? "新增课程" : "编辑课程"}
      onClose={close}
      footer={
        <>
          <Button type="button" onClick={close}>
            取消
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} disabled={save.isPending}>
            {save.isPending ? "保存中…" : "保存"}
          </Button>
        </>
      }
    >
      {open && (mode === "create" || course) && (
        <CourseForm
          key={course?.id ?? "new"}
          course={course}
          serverError={save.error?.message ?? null}
          onSubmit={(body) => save.mutate(body, { onSuccess: close })}
        />
      )}
    </Dialog>
  );
}

interface CourseFormState {
  title: string;
  description: string;
  coverUrl: string;
  published: boolean;
}

interface CourseFormProps {
  course: AdminCourse | null;
  serverError: string | null;
  onSubmit: (body: AdminContentBody) => void;
}

const lessonGrid = "grid grid-cols-[1fr_1.4fr_96px_auto] items-start gap-2";

function CourseForm({ course, serverError, onSubmit }: CourseFormProps) {
  const [state, setState] = useState<CourseFormState>(() =>
    course
      ? {
          title: course.title,
          description: course.description ?? "",
          coverUrl: course.coverUrl ?? "",
          published: course.published,
        }
      : { title: "", description: "", coverUrl: "", published: false },
  );
  const [rows, setRows] = useState<LessonRow[]>(() => (course ? fromLessons(course.lessons) : []));
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof CourseFormState>(key: K, value: CourseFormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function updateRow(index: number, next: Partial<LessonRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...next } : r)));
  }

  return (
    <form
      id={FORM_ID}
      className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const title = state.title.trim();
        if (!title) {
          setError("请填写标题");
          return;
        }
        const coverUrl = state.coverUrl.trim();
        if (coverUrl && !HTTP_RE.test(coverUrl)) {
          setError("封面链接需以 http:// 或 https:// 开头");
          return;
        }
        const result = toCourseLessons(rows);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setError(null);
        const description = state.description.trim();
        onSubmit({
          type: "COURSE",
          id: course?.id,
          title,
          description: description || null,
          coverUrl: coverUrl || null,
          published: state.published,
          lessons: result.lessons,
        });
      }}
    >
      <Field label="标题" htmlFor="course-title">
        <Input id="course-title" value={state.title} onChange={(e) => set("title", e.target.value)} />
      </Field>
      <Field label="封面 URL" htmlFor="course-cover" hint="可选；需以 http:// 或 https:// 开头">
        <Input
          id="course-cover"
          inputMode="url"
          placeholder="https://"
          value={state.coverUrl}
          onChange={(e) => set("coverUrl", e.target.value)}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="描述" htmlFor="course-description" hint="可选；学生端课程页显示">
          <Textarea
            id="course-description"
            rows={3}
            value={state.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1.5 text-xs font-medium text-neutral-800">课时（保存会整体替换，顺序即播放顺序）</legend>
        {rows.length > 0 && (
          <div className={`${lessonGrid} text-[11px] uppercase tracking-[0.08em] text-neutral-700`}>
            <span>标题</span>
            <span>视频 URL</span>
            <span>时长（分钟）</span>
            <span />
          </div>
        )}
        {rows.map((row, i) => (
          // 行没有稳定 id，用索引；移动 / 删除会重排，但输入是受控的所以不会串值
          <div key={i} className={lessonGrid}>
            <Input
              aria-label={`第 ${i + 1} 课时标题`}
              placeholder="课时标题"
              value={row.title}
              onChange={(e) => updateRow(i, { title: e.target.value })}
            />
            <Input
              aria-label={`第 ${i + 1} 课时视频 URL`}
              inputMode="url"
              placeholder="https://"
              value={row.videoUrl}
              onChange={(e) => updateRow(i, { videoUrl: e.target.value })}
            />
            <Input
              aria-label={`第 ${i + 1} 课时时长`}
              type="number"
              min={1}
              step={1}
              value={row.durationMinutes}
              onChange={(e) => updateRow(i, { durationMinutes: e.target.value })}
            />
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-h-10"
                aria-label={`上移第 ${i + 1} 课时`}
                disabled={i === 0}
                onClick={() => setRows((prev) => moveLesson(prev, i, "up"))}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-h-10"
                aria-label={`下移第 ${i + 1} 课时`}
                disabled={i === rows.length - 1}
                onClick={() => setRows((prev) => moveLesson(prev, i, "down"))}
              >
                ↓
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-h-10"
                onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
              >
                删除
              </Button>
            </div>
          </div>
        ))}
        <div>
          <Button type="button" size="sm" onClick={() => setRows((prev) => [...prev, emptyLessonRow])}>
            添加课时
          </Button>
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={state.published} onChange={(e) => set("published", e.target.checked)} />
        已发布（学生端可见）
      </label>

      {(error || serverError) && (
        <p role="alert" className="text-xs text-red-700 sm:col-span-2">
          {error ?? `保存失败：${serverError}`}
        </p>
      )}
    </form>
  );
}
