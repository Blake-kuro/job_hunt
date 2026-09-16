import { useState } from "react";
import { useCreateJob, usePatchJob } from "@api/mutations";
import type { AdminJob, AdminJobBody, CategoryId } from "@api/types";
import { Button } from "@shared/ui/Button";
import { Dialog } from "@shared/ui/Dialog";
import { Field } from "@shared/ui/Field";
import { Input } from "@shared/ui/Input";
import { Select } from "@shared/ui/Select";
import { CATEGORY_LABEL, emptyJobForm, fromJob, type JobFormState, toJobBody } from "./job-form";

const FORM_ID = "job-form";

interface JobDialogProps {
  mode: "create" | "edit";
  job: AdminJob | null;
  open: boolean;
  onClose: () => void;
}

/** 新增 / 编辑岗位：同一个表单，edit 时用 job 预填 */
export function JobDialog({ mode, job, open, onClose }: JobDialogProps) {
  const create = useCreateJob();
  const patch = usePatchJob();
  const pending = create.isPending || patch.isPending;
  const serverError = (mode === "create" ? create.error : patch.error)?.message ?? null;

  function close() {
    create.reset();
    patch.reset();
    onClose();
  }

  function save(body: AdminJobBody) {
    if (mode === "edit") {
      if (!job) return;
      patch.mutate({ id: job.id, body }, { onSuccess: close });
    } else {
      create.mutate(body, { onSuccess: close });
    }
  }

  return (
    <Dialog
      open={open}
      wide
      title={mode === "create" ? "新增岗位" : job ? `编辑岗位 · ${job.enterpriseName}` : "编辑岗位"}
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
      {open && (mode === "create" || job) && (
        <JobForm key={job?.id ?? "new"} job={job} serverError={serverError} onSubmit={save} />
      )}
    </Dialog>
  );
}

interface JobFormProps {
  job: AdminJob | null;
  serverError: string | null;
  onSubmit: (body: AdminJobBody) => void;
}

type TextKey = Exclude<keyof JobFormState, "categoryId">;

const TEXT_FIELDS: { key: TextKey; label: string; type?: "date" | "url"; hint?: string }[] = [
  { key: "enterpriseName", label: "企业名称" },
  { key: "position", label: "岗位名称" },
  { key: "serialNumber", label: "序号" },
  { key: "recruitmentBatch", label: "批次" },
  { key: "enterpriseNature", label: "企业性质" },
  { key: "industry", label: "行业" },
  { key: "workLocation", label: "城市" },
  { key: "graduationYear", label: "届别" },
  { key: "degree", label: "学历" },
  { key: "announcementLink", label: "公告链接", type: "url" },
  { key: "deliveryAddress", label: "投递地址", type: "url" },
  { key: "deadline", label: "截止说明", hint: "展示给学生的文字，如「10 月底」" },
  { key: "deadlineAt", label: "截止日期", type: "date", hint: "用于排序与到期提示，可留空" },
];

function JobForm({ job, serverError, onSubmit }: JobFormProps) {
  const [state, setState] = useState<JobFormState>(() => (job ? fromJob(job) : emptyJobForm));
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof JobFormState>(key: K, value: JobFormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  return (
    <form
      id={FORM_ID}
      className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const result = toJobBody(state);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setError(null);
        onSubmit(result.body);
      }}
    >
      <Field label="分类" htmlFor="job-category">
        <Select
          id="job-category"
          value={state.categoryId}
          onChange={(e) => set("categoryId", e.target.value as JobFormState["categoryId"])}
        >
          {([1, 2, 3] as CategoryId[]).map((id) => (
            <option key={id} value={String(id)}>
              {CATEGORY_LABEL[id]}
            </option>
          ))}
        </Select>
      </Field>
      {TEXT_FIELDS.map((f) => (
        <Field key={f.key} label={f.label} htmlFor={`job-${f.key}`} hint={f.hint}>
          <Input
            id={`job-${f.key}`}
            type={f.type === "date" ? "date" : "text"}
            inputMode={f.type === "url" ? "url" : undefined}
            value={state[f.key]}
            onChange={(e) => set(f.key, e.target.value)}
          />
        </Field>
      ))}

      {(error || serverError) && (
        <p role="alert" className="text-xs text-red-700 sm:col-span-2">
          {error ?? `保存失败：${serverError}`}
        </p>
      )}
    </form>
  );
}
