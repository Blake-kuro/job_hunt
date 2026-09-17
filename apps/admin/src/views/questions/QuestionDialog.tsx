import { zodResolver } from "@hookform/resolvers/zod";
import type {
  AdminQuestion,
  AdminQuizMeta,
  Difficulty,
  QuestionType,
  QuizOptionLetter,
} from "@job-hunt/api-client/types";
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
import { FieldError } from "@job-hunt/ui/components/field-error";
import { FormDialog } from "@job-hunt/ui/components/form-dialog";
import { Input } from "@job-hunt/ui/components/input";
import { Label } from "@job-hunt/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@job-hunt/ui/components/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@job-hunt/ui/components/select";
import { Textarea } from "@job-hunt/ui/components/textarea";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useCreateQuestion, usePatchQuestion } from "@api/mutations";
import {
  applyType,
  DIFFICULTY_LABEL,
  defaultValues,
  type FormValues,
  fromEntity,
  LETTERS,
  MAX_OPTIONS,
  minOptions,
  removeOption,
  schema,
  toBody,
  TYPE_LABEL,
} from "./question-schema";

interface QuestionDialogProps {
  mode: "create" | "edit";
  question: AdminQuestion | null;
  /** 新建时默认选中的分类（当前树上选中的） */
  defaultCategoryId?: string;
  meta: AdminQuizMeta;
  open: boolean;
  onClose: () => void;
}

/** 新增 / 编辑题目：同一个表单，edit 时用 question 预填，保存时整包 body 发 PATCH */
export function QuestionDialog({ mode, question, defaultCategoryId, meta, open, onClose }: QuestionDialogProps) {
  const create = useCreateQuestion();
  const patch = usePatchQuestion();
  const pending = create.isPending || patch.isPending;
  const serverError = (mode === "create" ? create.error : patch.error)?.message ?? null;

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });
  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "options" });
  const type = form.watch("type");
  const answer = form.watch("answer");
  const isJudge = type === "JUDGE";
  const isMulti = type === "MULTI";
  const { isSubmitted } = form.formState;

  useEffect(() => {
    if (open) form.reset(question ? fromEntity(question) : { ...defaultValues, categoryId: defaultCategoryId ?? "" });
  }, [open, question, defaultCategoryId, form]);

  function close() {
    create.reset();
    patch.reset();
    onClose();
  }

  function setAnswer(next: QuizOptionLetter[]) {
    form.setValue("answer", next, { shouldValidate: isSubmitted });
  }

  /** 切换题型：applyType 决定选项 / 答案；选项经 useFieldArray.replace 写回以刷新行 id */
  function changeType(next: QuestionType) {
    const current = form.getValues();
    const updated = applyType(current, next);
    if (updated === current) return;
    form.setValue("type", updated.type);
    if (updated.options !== current.options) replace(updated.options);
    setAnswer(updated.answer);
  }

  /** 删一行：removeOption 算出前移后的答案，再经 useFieldArray.remove 删行 */
  function removeRow(index: number) {
    const current = form.getValues();
    const updated = removeOption(current, index);
    if (updated === current) return;
    setAnswer(updated.answer);
    remove(index);
  }

  function toggleMulti(letter: QuizOptionLetter, checked: boolean) {
    setAnswer(checked ? [...answer, letter] : answer.filter((l) => l !== letter));
  }

  const optionRows = fields.map((row, i) => {
    const letter = LETTERS[i];
    return (
      <div key={row.id} className="flex items-start gap-3">
        <div className="flex min-h-9 w-12 shrink-0 items-center gap-1.5">
          {isMulti ? (
            <Checkbox
              id={`answer-${letter}`}
              checked={answer.includes(letter)}
              onCheckedChange={(v) => toggleMulti(letter, v === true)}
            />
          ) : (
            <RadioGroupItem id={`answer-${letter}`} value={letter} />
          )}
          <Label htmlFor={`answer-${letter}`} className="cursor-pointer text-sm font-medium">
            {letter}
          </Label>
        </div>
        <FormField
          control={form.control}
          name={`options.${i}.text`}
          render={({ field }) => (
            <FormItem className="min-w-0 flex-1">
              <FormControl>
                <Input
                  aria-label={`选项 ${letter}`}
                  readOnly={isJudge}
                  className={isJudge ? "bg-bg text-neutral-700" : undefined}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {!isJudge && (
          <Button
            type="button"
            size="sm"
            className="min-h-9"
            aria-label={`删除选项 ${letter}`}
            disabled={fields.length <= minOptions(type)}
            onClick={() => removeRow(i)}
          >
            删除
          </Button>
        )}
      </div>
    );
  });

  return (
    <FormDialog
      open={open}
      wide
      title={mode === "create" ? "新增题目" : "编辑题目"}
      onClose={close}
      form={form}
      onSubmit={async (values) => {
        const body = toBody(values);
        try {
          if (mode === "edit") {
            if (!question) return;
            await patch.mutateAsync({ id: question.id, body });
          } else {
            await create.mutateAsync(body);
          }
        } catch {
          return; // 错误由 mutation.error 显示在对话框顶部
        }
        close();
      }}
      pending={pending}
      error={serverError && `保存失败：${serverError}`}
    >
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>分类</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="请选择分类" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {meta.companies.flatMap((co) =>
                    co.categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {co.name} · {c.name}
                      </SelectItem>
                    )),
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>题型</FormLabel>
              <Select value={field.value} onValueChange={(v) => changeType(v as QuestionType)}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="section"
          render={({ field }) => (
            <FormItem>
              <FormLabel>所属部分</FormLabel>
              <FormControl>
                <Input maxLength={50} {...field} />
              </FormControl>
              <FormDescription>可选，如「形势政策」「企业文化」</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sortOrder"
          render={({ field }) => (
            <FormItem>
              <FormLabel>序号</FormLabel>
              <FormControl>
                <Input type="number" step="1" inputMode="numeric" {...field} />
              </FormControl>
              <FormDescription>分类内的顺序，留空由系统排在最后</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="prompt"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>题干</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1.5 text-xs font-medium text-neutral-800">
            选项
            <span className="ml-2 font-normal text-neutral-600">
              {isJudge
                ? "判断题选项固定，选出正确答案即可"
                : isMulti
                  ? "勾选所有正确答案（至少两个）"
                  : "选出唯一正确答案"}
            </span>
          </legend>
          {isMulti ? (
            <div className="flex flex-col gap-2">{optionRows}</div>
          ) : (
            <RadioGroup
              className="flex flex-col gap-2"
              value={answer[0] ?? ""}
              onValueChange={(l) => setAnswer([l as QuizOptionLetter])}
            >
              {optionRows}
            </RadioGroup>
          )}
          <FieldError<FormValues> name="options" />
          <FieldError<FormValues> name="answer" />
          {!isJudge && (
            <div>
              <Button
                type="button"
                size="sm"
                disabled={fields.length >= MAX_OPTIONS}
                onClick={() => append({ text: "" })}
              >
                添加选项
              </Button>
            </div>
          )}
        </fieldset>

        <FormField
          control={form.control}
          name="explanation"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>解析</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormDescription>每行一条，可留空</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="difficulty"
          render={({ field }) => (
            <FormItem>
              <FormLabel>难度</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
                    <SelectItem key={d} value={d}>
                      {DIFFICULTY_LABEL[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="source"
          render={({ field }) => (
            <FormItem>
              <FormLabel>来源</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>如「中国华电 · 公共与行业知识」「自编」</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

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
