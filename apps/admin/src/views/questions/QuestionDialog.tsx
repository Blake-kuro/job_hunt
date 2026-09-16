import { useState } from "react";
import { useCreateQuestion, usePatchQuestion } from "@api/mutations";
import type { AdminQuestion, AdminQuestionBody, AdminQuizMeta, Difficulty } from "@api/types";
import { Button } from "@shared/ui/Button";
import { Dialog } from "@shared/ui/Dialog";
import { Field } from "@shared/ui/Field";
import { Input } from "@shared/ui/Input";
import { Select } from "@shared/ui/Select";
import { Textarea } from "@shared/ui/Textarea";
import {
  DIFFICULTY_LABEL,
  emptyQuestionForm,
  fromQuestion,
  LETTERS,
  type QuestionFormState,
  toQuestionBody,
} from "./question-form";

const FORM_ID = "question-form";

interface QuestionDialogProps {
  mode: "create" | "edit";
  question: AdminQuestion | null;
  meta: AdminQuizMeta;
  open: boolean;
  onClose: () => void;
}

/** 新增 / 编辑题目：同一个表单，edit 时用 question 预填，保存时整包 body 发 PATCH */
export function QuestionDialog({ mode, question, meta, open, onClose }: QuestionDialogProps) {
  const create = useCreateQuestion();
  const patch = usePatchQuestion();
  const pending = create.isPending || patch.isPending;
  const serverError = (mode === "create" ? create.error : patch.error)?.message ?? null;

  function close() {
    create.reset();
    patch.reset();
    onClose();
  }

  function save(body: AdminQuestionBody) {
    if (mode === "edit") {
      if (!question) return;
      patch.mutate({ id: question.id, body }, { onSuccess: close });
    } else {
      create.mutate(body, { onSuccess: close });
    }
  }

  return (
    <Dialog
      open={open}
      wide
      title={mode === "create" ? "新增题目" : "编辑题目"}
      onClose={close}
      footer={
        <>
          <Button type="button" onClick={close}>
            取消
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} disabled={pending}>
            {pending ? "保存中…" : "保存"}
          </Button>
        </>
      }
    >
      {open && (mode === "create" || question) && (
        <QuestionForm
          key={question?.id ?? "new"}
          question={question}
          meta={meta}
          serverError={serverError}
          onSubmit={save}
        />
      )}
    </Dialog>
  );
}

interface QuestionFormProps {
  question: AdminQuestion | null;
  meta: AdminQuizMeta;
  serverError: string | null;
  onSubmit: (body: AdminQuestionBody) => void;
}

function QuestionForm({ question, meta, serverError, onSubmit }: QuestionFormProps) {
  const [state, setState] = useState<QuestionFormState>(() => (question ? fromQuestion(question) : emptyQuestionForm));
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof QuestionFormState>(key: K, value: QuestionFormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function setOption(index: number, text: string) {
    setState((s) => {
      const options = [...s.options] as QuestionFormState["options"];
      options[index] = text;
      return { ...s, options };
    });
  }

  return (
    <form
      id={FORM_ID}
      className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const result = toQuestionBody(state);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setError(null);
        onSubmit(result.body);
      }}
    >
      <div className="sm:col-span-2">
        <Field label="题干" htmlFor="question-prompt">
          <Textarea
            id="question-prompt"
            rows={3}
            value={state.prompt}
            onChange={(e) => set("prompt", e.target.value)}
          />
        </Field>
      </div>

      <Field label="分类" htmlFor="question-category">
        <Select id="question-category" value={state.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
          <option value="">请选择分类</option>
          {meta.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="公司题集" htmlFor="question-company-set" hint="可选；用于公司专项练习">
        <Select
          id="question-company-set"
          value={state.companySetId}
          onChange={(e) => set("companySetId", e.target.value)}
        >
          <option value="">无</option>
          {meta.companySets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.company} · {s.track}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1.5 text-xs font-medium text-neutral-800">选项（选中单选框标记正确答案）</legend>
        {LETTERS.map((letter, i) => (
          <div key={letter} className="flex items-center gap-3">
            <label className="flex w-12 shrink-0 cursor-pointer items-center gap-1.5 text-sm font-medium">
              <input
                type="radio"
                name="question-answer"
                value={letter}
                checked={state.answer === letter}
                onChange={() => set("answer", letter)}
              />
              {letter}
            </label>
            <Input
              aria-label={`选项 ${letter}`}
              value={state.options[i]}
              onChange={(e) => setOption(i, e.target.value)}
            />
          </div>
        ))}
      </fieldset>

      <div className="sm:col-span-2">
        <Field label="解析" htmlFor="question-explanation" hint="每行一条">
          <Textarea
            id="question-explanation"
            rows={4}
            value={state.explanation}
            onChange={(e) => set("explanation", e.target.value)}
          />
        </Field>
      </div>

      <Field label="难度" htmlFor="question-difficulty">
        <Select
          id="question-difficulty"
          value={state.difficulty}
          onChange={(e) => set("difficulty", e.target.value as Difficulty)}
        >
          {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABEL[d]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="来源" htmlFor="question-source" hint="如「牛客网」「自编」">
        <Input id="question-source" value={state.source} onChange={(e) => set("source", e.target.value)} />
      </Field>

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
