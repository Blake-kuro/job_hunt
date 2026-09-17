import { zodResolver } from "@hookform/resolvers/zod";
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
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useGrantCourse } from "@api/mutations";
import { studentsQuery } from "@api/queries";
import { defaultValues, type FormValues, parsePhones, schema, toBody } from "./grant-schema";

interface GrantDialogProps {
  courseId: string;
  open: boolean;
  onClose: () => void;
}

/**
 * 批量开通：手机号（多行）→ 逐个用学生搜索接口换成 userId（精确匹配 phone）→ POST grants。
 * 任何一个手机号找不到就整体不提交，把缺的列出来。
 */
export function GrantDialog({ courseId, open, onClose }: GrantDialogProps) {
  const qc = useQueryClient();
  const grant = useGrantCourse();
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
      setLookupError(null);
    }
  }, [open, form]);

  function close() {
    grant.reset();
    setLookupError(null);
    onClose();
  }

  /** 手机号 → userId；找不到 / 非学生 / 已停用的号码分别列出（后端 400 文案只有 id，管理员看不出是谁） */
  async function resolveUserIds(phones: string[]): Promise<{ ids: string[]; missing: string[]; blocked: string[] }> {
    const ids: string[] = [];
    const missing: string[] = [];
    const blocked: string[] = [];
    // 管理端一次开通的量小，逐个 q= 查询即可；接口是 contains 匹配，这里再做精确比对
    const results = await Promise.all(phones.map((phone) => qc.fetchQuery(studentsQuery({ q: phone, pageSize: 20 }))));
    results.forEach((r, i) => {
      const phone = phones[i] as string;
      const hit = r.items.find((s) => s.phone === phone);
      if (!hit) missing.push(phone);
      else if (hit.role !== "STUDENT" || !hit.enabled) blocked.push(phone);
      else ids.push(hit.id);
    });
    return { ids, missing, blocked };
  }

  return (
    <FormDialog
      open={open}
      title="开通学员"
      onClose={close}
      form={form}
      onSubmit={async (values) => {
        setLookupError(null);
        const phones = parsePhones(values.phones);
        setLooking(true);
        let ids: string[];
        try {
          const r = await resolveUserIds(phones);
          const problems = [
            r.missing.length > 0 && `没有对应的学生（需先注册登录）：${r.missing.join("、")}`,
            r.blocked.length > 0 && `已停用 / 非学生账号：${r.blocked.join("、")}`,
          ].filter((x): x is string => typeof x === "string");
          if (problems.length > 0) {
            setLookupError(`以下手机号无法开通，本次未提交。${problems.join("；")}`);
            return;
          }
          ids = r.ids;
        } catch (e) {
          setLookupError(`查询学生失败：${e instanceof Error ? e.message : String(e)}`);
          return;
        } finally {
          setLooking(false);
        }
        try {
          await grant.mutateAsync({ courseId, body: toBody(ids, values) });
        } catch {
          return; // 错误由 grant.error 显示在对话框顶部
        }
        close();
      }}
      pending={looking || grant.isPending}
      submitLabel="开通"
      pendingLabel={looking ? "查询学生…" : "开通中…"}
      error={lookupError ?? (grant.error && `开通失败：${grant.error.message}`)}
    >
      <FormField
        control={form.control}
        name="phones"
        render={({ field }) => (
          <FormItem>
            <FormLabel>学生手机号</FormLabel>
            <FormControl>
              <Textarea
                autoFocus
                rows={6}
                placeholder={"一行一个，也可用逗号 / 空格分隔\n13800000001\n13800000002"}
                {...field}
              />
            </FormControl>
            <FormDescription>只能开通已注册的学生；已开通的学生再次开通只会更新到期日</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="expiresAt"
        render={({ field }) => (
          <FormItem>
            <FormLabel>到期日期</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormDescription>留空为永久有效（不会改动已开通学生的到期日）</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </FormDialog>
  );
}
