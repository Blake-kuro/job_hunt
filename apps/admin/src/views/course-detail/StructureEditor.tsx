import type { AdminChapter, AdminCourseDetail, AdminLesson } from "@job-hunt/api-client/types";
import { Badge } from "@job-hunt/ui/components/badge";
import { Button } from "@job-hunt/ui/components/button";
import { useState } from "react";
import { useDeleteChapter, useDeleteLesson, useRefreshLessonVideo, useReorderLessons } from "@api/mutations";
import { formatDuration } from "@views/courses/format";
import { ChapterDialog } from "./ChapterDialog";
import { LessonDialog } from "./LessonDialog";
import { type Direction, moveChapter, moveLesson, toOrderBody } from "./structure";
import { UploadButton, useLessonUpload } from "./UploadButton";
import type { UploadState } from "./upload-state";

type DialogState =
  | { kind: "chapter"; chapter: AdminChapter | null }
  | { kind: "lesson"; lesson: AdminLesson | null; defaultChapterId?: string }
  | null;

/** 视频状态 Badge：本地上传状态优先于服务端状态 */
function VideoBadge({ lesson, upload }: { lesson: AdminLesson; upload: UploadState }) {
  if (upload.status === "signing") return <Badge variant="outline">准备上传…</Badge>;
  if (upload.status === "uploading") return <Badge variant="outline">上传中 {upload.progress}%</Badge>;
  if (upload.status === "saving") return <Badge variant="outline">保存中…</Badge>;
  switch (lesson.videoStatus) {
    case "NONE":
      return <Badge variant="neutral">无视频</Badge>;
    case "UPLOADING":
      return <Badge variant="outline">上传中</Badge>;
    case "PROCESSING":
      return <Badge variant="outline">处理中</Badge>;
    case "READY":
      return (
        <Badge variant="accent">
          就绪{lesson.durationSeconds !== null && ` · ${formatDuration(lesson.durationSeconds)}`}
        </Badge>
      );
    case "FAILED":
      return <Badge className="bg-red-100 text-red-800">失败</Badge>;
  }
}

interface LessonRowProps {
  courseId: string;
  lesson: AdminLesson;
  index: number;
  canUp: boolean;
  canDown: boolean;
  /** 整页级别的忙碌（重排 / 删除进行中）：禁用会改结构的按钮 */
  busy: boolean;
  onMove: (dir: Direction) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function LessonRow({ courseId, lesson, index, canUp, canDown, busy, onMove, onEdit, onDelete }: LessonRowProps) {
  const { state, upload, retrySave } = useLessonUpload(lesson, courseId);
  const refresh = useRefreshLessonVideo();
  const uploading = state.status === "signing" || state.status === "uploading" || state.status === "saving";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-hairline px-3 py-2 text-sm">
      <span className="w-6 shrink-0 text-right text-xs text-neutral-600 tabular-nums">{index + 1}</span>
      <span className="min-w-0 flex-1 truncate" title={lesson.title}>
        {lesson.title}
      </span>
      {lesson.freePreview && <Badge variant="outline">试看</Badge>}
      <VideoBadge lesson={lesson} upload={state} />
      <span className="flex shrink-0 flex-wrap gap-1">
        <Button size="sm" disabled={busy || !canUp} onClick={() => onMove("up")} aria-label="上移">
          ↑
        </Button>
        <Button size="sm" disabled={busy || !canDown} onClick={() => onMove("down")} aria-label="下移">
          ↓
        </Button>
        <Button size="sm" disabled={busy} onClick={onEdit}>
          编辑
        </Button>
        <UploadButton state={state} hasVideo={lesson.videoStatus !== "NONE"} disabled={busy} onFile={upload} />
        {state.status === "error" && state.fileId !== undefined && (
          <Button size="sm" variant="primary" disabled={busy} onClick={retrySave}>
            重试保存
          </Button>
        )}
        {lesson.videoStatus === "PROCESSING" && !uploading && (
          <Button size="sm" disabled={refresh.isPending} onClick={() => refresh.mutate({ id: lesson.id, courseId })}>
            {refresh.isPending ? "刷新中…" : "刷新状态"}
          </Button>
        )}
        <Button size="sm" disabled={busy || uploading} onClick={onDelete}>
          删除
        </Button>
      </span>
      {(state.status === "error" || refresh.error) && (
        <span role="alert" className="basis-full pl-9 text-xs text-red-700">
          {state.status === "error" ? state.message : `刷新失败：${refresh.error?.message}`}
        </span>
      )}
    </li>
  );
}

interface StructureEditorProps {
  course: AdminCourseDetail;
}

/** 章 → 课时的结构编辑：「未分章」组在最前，章按 sortOrder；上移 / 下移用纯函数算新顺序后整体提交 */
export function StructureEditor({ course }: StructureEditorProps) {
  const reorder = useReorderLessons();
  const removeChapter = useDeleteChapter();
  const removeLesson = useDeleteLesson();
  const [dialog, setDialog] = useState<DialogState>(null);
  const busy = reorder.isPending || removeChapter.isPending || removeLesson.isPending;
  const actionError = reorder.error ?? removeChapter.error ?? removeLesson.error;

  function submitOrder(next: ReturnType<typeof moveLesson>) {
    if (next) reorder.mutate({ courseId: course.id, body: toOrderBody(next) });
  }

  function confirmDeleteChapter(c: AdminChapter) {
    if (!window.confirm(`删除章「${c.title}」？其下 ${c.lessons.length} 个课时会回到「未分章」`)) return;
    removeChapter.mutate({ id: c.id, courseId: course.id });
  }

  function confirmDeleteLesson(l: AdminLesson) {
    if (!window.confirm(`删除课时「${l.title}」？学习进度会一并删除，VOD 上的视频不会删除`)) return;
    removeLesson.mutate({ id: l.id, courseId: course.id });
  }

  const renderLessons = (lessons: AdminLesson[], chapterId: string | undefined) => (
    <ul>
      {lessons.length === 0 && (
        <li className="border-t border-hairline px-3 py-3 text-xs text-neutral-600">暂无课时</li>
      )}
      {lessons.map((l, i) => (
        <LessonRow
          key={l.id}
          courseId={course.id}
          lesson={l}
          index={i}
          canUp={i > 0}
          canDown={i < lessons.length - 1}
          busy={busy}
          onMove={(dir) => submitOrder(moveLesson(course, l.id, dir))}
          onEdit={() => setDialog({ kind: "lesson", lesson: l, defaultChapterId: chapterId })}
          onDelete={() => confirmDeleteLesson(l)}
        />
      ))}
    </ul>
  );

  const groupHeader = "flex flex-wrap items-center gap-2 bg-neutral-100 px-3 py-2";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-neutral-700">
          课时按章组织；试看课时未开通也能播放。视频上传后状态为「处理中」，转码完成后点「刷新状态」变为「就绪」。
        </p>
        <div className="ml-auto flex gap-2">
          <Button onClick={() => setDialog({ kind: "lesson", lesson: null })}>新建课时</Button>
          <Button variant="primary" onClick={() => setDialog({ kind: "chapter", chapter: null })}>
            新建章
          </Button>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          操作失败：{actionError.message}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-4">
        <section className="border border-divider bg-surface">
          <div className={groupHeader}>
            <h3 className="font-heading font-semibold">未分章</h3>
            <span className="text-xs text-neutral-600 tabular-nums">{course.unchaptered.length} 课时</span>
            <span className="ml-auto flex gap-1">
              <Button size="sm" disabled={busy} onClick={() => setDialog({ kind: "lesson", lesson: null })}>
                新建课时
              </Button>
            </span>
          </div>
          {renderLessons(course.unchaptered, undefined)}
        </section>

        {course.chapters.map((c, ci) => (
          <section key={c.id} className="border border-divider bg-surface">
            <div className={groupHeader}>
              <h3 className="min-w-0 truncate font-heading font-semibold" title={c.title}>
                {c.title}
              </h3>
              <span className="text-xs text-neutral-600 tabular-nums">{c.lessons.length} 课时</span>
              <span className="ml-auto flex flex-wrap gap-1">
                <Button
                  size="sm"
                  disabled={busy || ci === 0}
                  onClick={() => submitOrder(moveChapter(course, c.id, "up"))}
                  aria-label="章上移"
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  disabled={busy || ci === course.chapters.length - 1}
                  onClick={() => submitOrder(moveChapter(course, c.id, "down"))}
                  aria-label="章下移"
                >
                  ↓
                </Button>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => setDialog({ kind: "lesson", lesson: null, defaultChapterId: c.id })}
                >
                  新建课时
                </Button>
                <Button size="sm" disabled={busy} onClick={() => setDialog({ kind: "chapter", chapter: c })}>
                  重命名
                </Button>
                <Button size="sm" disabled={busy} onClick={() => confirmDeleteChapter(c)}>
                  删除章
                </Button>
              </span>
            </div>
            {renderLessons(c.lessons, c.id)}
          </section>
        ))}
      </div>

      <ChapterDialog
        courseId={course.id}
        open={dialog?.kind === "chapter"}
        chapter={dialog?.kind === "chapter" ? dialog.chapter : null}
        onClose={() => setDialog(null)}
      />
      <LessonDialog
        course={course}
        open={dialog?.kind === "lesson"}
        lesson={dialog?.kind === "lesson" ? dialog.lesson : null}
        defaultChapterId={dialog?.kind === "lesson" ? dialog.defaultChapterId : undefined}
        onClose={() => setDialog(null)}
      />
    </>
  );
}
