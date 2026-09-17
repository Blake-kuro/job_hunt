import { Checkbox } from "@job-hunt/ui/components/checkbox";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@job-hunt/ui/components/form";
import { Input } from "@job-hunt/ui/components/input";
import { Textarea } from "@job-hunt/ui/components/textarea";
import type { UseFormReturn } from "react-hook-form";
import type { FormValues } from "./course-schema";

interface CourseFieldsProps {
  form: UseFormReturn<FormValues>;
}

/** 课程基本信息字段组：新建对话框与详情页表单共用 */
export function CourseFields({ form }: CourseFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>标题</FormLabel>
            <FormControl>
              <Input maxLength={200} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="summary"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>简介</FormLabel>
            <FormControl>
              <Input maxLength={500} placeholder="一句话介绍，显示在课程列表" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>详细介绍</FormLabel>
            <FormControl>
              <Textarea maxLength={5000} rows={4} placeholder="课程页展示的详细说明，可留空" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="teacher"
        render={({ field }) => (
          <FormItem>
            <FormLabel>讲师</FormLabel>
            <FormControl>
              <Input maxLength={100} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="price"
        render={({ field }) => (
          <FormItem>
            <FormLabel>价格（元）</FormLabel>
            <FormControl>
              <Input inputMode="decimal" {...field} />
            </FormControl>
            <FormDescription>0 为免费课，学生可直接观看；付费课需按课开通</FormDescription>
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
              <Input inputMode="url" placeholder="https://…" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="sortOrder"
        render={({ field }) => (
          <FormItem>
            <FormLabel>排序</FormLabel>
            <FormControl>
              <Input inputMode="numeric" placeholder="留空为 0" {...field} />
            </FormControl>
            <FormDescription>数字小的排前面</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="published"
        render={({ field }) => (
          <FormItem className="sm:col-span-2 flex items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
            </FormControl>
            <FormLabel className="font-normal">已发布（学生端可见）</FormLabel>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
