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
import { FormDialog } from "@job-hunt/ui/components/form-dialog";
import { Input } from "@job-hunt/ui/components/input";
import { Label } from "@job-hunt/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@job-hunt/ui/components/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@job-hunt/ui/components/select";
import { Textarea } from "@job-hunt/ui/components/textarea";
import { type ReactNode, useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useCreateQuestion, usePatchQuestion } from "@api/mutations";
import {
  DIFFICULTY_LABEL,
  defaultValues,
  type FormValues,
  fromEntity,
  LETTERS,
  MAX_OPTIONS,
  minOptions,
  optionsForType,
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
  const { errors, isSubmitted } = form.formState;

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

  /** 切换题型：进出判断题时重置选项；任何切换都清空答案（答案语义随题型变） */
  function changeType(next: QuestionType) {
    const options = optionsForType(type, next, form.getValues("options"));
    form.setValue("type", next);
    if (options) replace(options);
    setAnswer([]);
  }

  /** 删掉一行后字母重新排：被删行的答案去掉，其后的答案往前挪一位 */
  function removeOption(index: number) {
    if (fields.length <= minOptions(type)) return;
    setAnswer(
      answer
        .map((l) => LETTERS.indexOf(l))
        .filter((i) => i !== index)
        .map((i) => LETTERS[i > index ? i - 1 : i]),
    );
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
            <FormItem className="min-w-0 flex-1 gap-1.5">
              <FormControl>
                <Input
                  aria-label={`选项 ${letter}`}
                  readOnly={isJudge}
                  className={isJudge ? "bg-bg text-neutral-700" : undefined}
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-xs" />
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
            onClick={() => removeOption(i)}
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
      submitLabel={pending ? "保存中…" : "保存"}
      error={serverError && `保存失败：${serverError}`}
    >
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem className="gap-1.5">
              <FormLabel className="text-xs text-neutral-800">分类</FormLabel>
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
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem className="gap-1.5">
              <FormLabel className="text-xs text-neutral-800">题型</FormLabel>
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
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="section"
          render={({ field }) => (
            <FormItem className="gap-1.5">
              <FormLabel className="text-xs text-neutral-800">所属部分</FormLabel>
              <FormControl>
                <Input maxLength={50} {...field} />
              </FormControl>
              <FormDescription className="text-xs text-neutral-600">可选，如「形势政策」「企业文化」</FormDescription>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sortOrder"
          render={({ field }) => (
            <FormItem className="gap-1.5">
              <FormLabel className="text-xs text-neutral-800">序号</FormLabel>
              <FormControl>
                <Input type="number" step="1" inputMode="numeric" {...field} />
              </FormControl>
              <FormDescription className="text-xs text-neutral-600">分类内的顺序，留空由系统排在最后</FormDescription>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="prompt"
          render={({ field }) => (
            <FormItem className="gap-1.5 sm:col-span-2">
              <FormLabel className="text-xs text-neutral-800">题干</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage className="text-xs" />
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
          <ArrayMessage>{errors.options?.message ?? errors.answer?.message}</ArrayMessage>
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
            <FormItem className="gap-1.5 sm:col-span-2">
              <FormLabel className="text-xs text-neutral-800">解析</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormDescription className="text-xs text-neutral-600">每行一条，可留空</FormDescription>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="difficulty"
          render={({ field }) => (
            <FormItem className="gap-1.5">
              <FormLabel className="text-xs text-neutral-800">难度</FormLabel>
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
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="source"
          render={({ field }) => (
            <FormItem className="gap-1.5">
              <FormLabel className="text-xs text-neutral-800">来源</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription className="text-xs text-neutral-600">
                如「中国华电 · 公共与行业知识」「自编」
              </FormDescription>
              <FormMessage className="text-xs" />
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
              <FormLabel className="cursor-pointer text-sm font-normal">已发布（学生端可见）</FormLabel>
            </FormItem>
          )}
        />
      </div>
    </FormDialog>
  );
}

/** 选项 / 答案是数组级校验（superRefine 挂在 options / answer 根上），不经 FormField，手动渲染文案 */
function ArrayMessage({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-xs text-destructive">
      {children}
    </p>
  );
}
