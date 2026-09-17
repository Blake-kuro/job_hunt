import { zodResolver } from "@hookform/resolvers/zod";
import type { AdminStudent, ContentType } from "@job-hunt/api-client/types";
import { Button } from "@job-hunt/ui/components/button";
import { FormControl, FormField, FormItem, FormMessage } from "@job-hunt/ui/components/form";
import { FormDialog } from "@job-hunt/ui/components/form-dialog";
import { Input } from "@job-hunt/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@job-hunt/ui/components/select";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { usePutStudentAccess } from "@api/mutations";
import { coursesQuery, materialsQuery } from "@api/queries";
import { defaultValues, emptyRow, type FormValues, fromEntity, schema, toBody } from "./grants-schema";

const typeLabel: Record<ContentType, string> = { MATERIAL: "资料", QUESTION: "题目", COURSE: "课程" };

const rowGrid = "grid grid-cols-[110px_1fr_150px_56px] gap-2";

interface GrantsDialogProps {
  student: AdminStudent | null;
  onClose: () => void;
}

/** 单独授权：整表替换学生的资料 / 题目 / 课程访问权 */
export function GrantsDialog({ student, onClose }: GrantsDialogProps) {
  const put = usePutStudentAccess();
  const materials = useQuery(materialsQuery());
  const courses = useQuery(coursesQuery());

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "grants" });
  const rows = form.watch("grants");

  useEffect(() => {
    if (student) form.reset(fromEntity(student.grants));
  }, [student, form]);

  function close() {
    put.reset();
    onClose();
  }

  return (
    <FormDialog
      open={student !== null}
      wide
      title={student ? `授权 · ${student.name}` : "授权"}
      onClose={close}
      form={form}
      onSubmit={async (values) => {
        if (!student) return;
        try {
          await put.mutateAsync({ id: student.id, body: toBody(values) });
        } catch {
          return; // 错误由 put.error 显示在对话框顶部
        }
        close();
      }}
      pending={put.isPending}
      submitLabel={put.isPending ? "保存中…" : "保存"}
      error={put.error && `保存失败：${put.error.message}`}
    >
      <p className="text-xs text-neutral-600">保存会整体替换该学生的授权；到期日留空表示永久有效。</p>

      {fields.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className={`${rowGrid} text-[11px] uppercase tracking-[0.08em] text-neutral-700`}>
            <span>类型</span>
            <span>内容</span>
            <span>到期</span>
            <span />
          </div>
          {fields.map((field, i) => {
            const row = rows[i] ?? field;
            const options =
              row.contentType === "MATERIAL" ? materials.data : row.contentType === "COURSE" ? courses.data : undefined;
            const known = options?.some((o) => o.id === row.contentId) ?? false;
            return (
              <div key={field.id} className={`${rowGrid} items-start`}>
                <FormField
                  control={form.control}
                  name={`grants.${i}.contentType`}
                  render={({ field: f }) => (
                    <FormItem className="gap-1.5">
                      <Select
                        value={f.value}
                        onValueChange={(v) => {
                          // 换类型时清空内容，避免 id 指向另一种类型的资源
                          f.onChange(v as ContentType);
                          form.setValue(`grants.${i}.contentId`, "");
                          form.setValue(`grants.${i}.contentTitle`, null);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger aria-label={`第 ${i + 1} 行类型`} className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(Object.keys(typeLabel) as ContentType[]).map((t) => (
                            <SelectItem key={t} value={t}>
                              {typeLabel[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`grants.${i}.contentId`}
                  render={({ field: f }) => (
                    <FormItem className="min-w-0 gap-1.5">
                      {row.contentType === "QUESTION" ? (
                        <>
                          <FormControl>
                            <Input aria-label={`第 ${i + 1} 行题目 id`} placeholder="题目 id" {...f} />
                          </FormControl>
                          <div className="truncate text-xs text-neutral-600">
                            {row.contentTitle ?? "保存后显示题干"}
                          </div>
                        </>
                      ) : (
                        <Select
                          value={f.value}
                          onValueChange={(id) => {
                            f.onChange(id);
                            form.setValue(`grants.${i}.contentTitle`, options?.find((o) => o.id === id)?.title ?? null);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger aria-label={`第 ${i + 1} 行内容`} className="w-full">
                              <SelectValue placeholder={options ? "请选择" : "加载中…"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {row.contentId && !known && (
                              <SelectItem value={row.contentId}>{row.contentTitle ?? row.contentId}</SelectItem>
                            )}
                            {options?.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`grants.${i}.expiresAt`}
                  render={({ field: f }) => (
                    <FormItem className="gap-1.5">
                      <FormControl>
                        <Input aria-label={`第 ${i + 1} 行到期日期`} type="date" {...f} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <Button type="button" size="sm" variant="ghost" className="min-h-9" onClick={() => remove(i)}>
                  删除
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <Button type="button" size="sm" onClick={() => append({ ...emptyRow })}>
          添加一行
        </Button>
      </div>
    </FormDialog>
  );
}
