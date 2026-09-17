import { Badge } from "@job-hunt/ui/components/badge";
import { Segmented } from "@job-hunt/ui/components/segmented";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useState } from "react";
import { adminCourseQuery } from "@api/queries";
import { formatPrice } from "@views/courses/format";
import { CourseInfoForm } from "./CourseInfoForm";
import { StructureEditor } from "./StructureEditor";
import { StudentsTab } from "./StudentsTab";

const route = getRouteApi("/_admin/courses_/$courseId");

type Tab = "structure" | "students";

const TABS: { value: Tab; label: string }[] = [
  { value: "structure", label: "结构" },
  { value: "students", label: "学员" },
];

/** 课程详情：基本信息表单 + 「结构」/「学员」两个页签 */
export function CourseDetailPage() {
  const { courseId } = route.useParams();
  const { data: course } = useSuspenseQuery(adminCourseQuery(courseId));
  const [tab, setTab] = useState<Tab>("structure");

  return (
    <>
      <Link to="/courses" className="text-sm text-accent underline-offset-2 hover:underline">
        ← 返回课程列表
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl">{course.title}</h1>
        <Badge variant={course.published ? "accent" : "neutral"}>{course.published ? "已发布" : "未发布"}</Badge>
        <span className="text-sm text-neutral-700 tabular-nums">
          {formatPrice(course.priceCents)} · {course.lessonCount} 课时（{course.readyCount} 就绪）· 已开通{" "}
          {course.grantCount} 人
        </span>
      </div>

      <section className="mt-6 border border-divider bg-surface px-5 py-4">
        <h2 className="text-lg">基本信息</h2>
        <CourseInfoForm course={course} />
      </section>

      <div className="mt-8">
        <Segmented name="course-tab" options={TABS} value={tab} onChange={setTab} />
      </div>

      <div className="mt-4 pb-6">
        {tab === "structure" ? <StructureEditor course={course} /> : <StudentsTab course={course} />}
      </div>
    </>
  );
}
