import { useEffect, useState } from "react";
import { api, patch, post, put, type Course, type Dashboard, type Material, type Question, type Student } from "./api";

type Tab = "students" | "materials" | "courses" | "questions";
const field = "w-full border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand";
const button =
  "cursor-pointer bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50";

function Login({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!sent) {
        const r = await api<{ developmentCode?: string }>("/auth/sms/send", {
          method: "POST",
          body: JSON.stringify({ phone }),
        });
        setSent(true);
        setDevCode(r.developmentCode ?? "");
        setCode(r.developmentCode ?? "");
      } else {
        await api("/auth/sms/verify", { method: "POST", body: JSON.stringify({ phone, code }) });
        onDone();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden bg-ink p-14 text-white lg:flex lg:flex-col">
        <b className="text-xl">职寻 · ADMIN</b>
        <div className="my-auto">
          <p className="text-sm text-emerald-300">运营控制台</p>
          <h1 className="mt-4 text-6xl font-semibold leading-tight">
            把内容与权限，
            <br />
            交到你手里。
          </h1>
          <p className="mt-6 max-w-md text-slate-300">管理学生、资料、题库与网课，所有授权变更实时生效。</p>
        </div>
      </section>
      <section className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm">
          <p className="text-sm font-semibold text-brand">管理员登录</p>
          <h2 className="mt-2 text-4xl font-semibold">验证手机号</h2>
          <p className="mt-3 text-sm text-slate-500">仅 ADMIN_PHONE_NUMBERS 中的手机号可进入。</p>
          <label className="mt-8 block text-sm">
            手机号
            <input
              className={`${field} mt-2`}
              value={phone}
              disabled={sent}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              maxLength={11}
            />
          </label>
          {sent && (
            <label className="mt-4 block text-sm">
              验证码
              <input
                className={`${field} mt-2 tracking-[.3em]`}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                maxLength={6}
              />
              {devCode && <small className="mt-2 block text-slate-500">开发验证码：{devCode}</small>}
            </label>
          )}
          {error && <p className="mt-4 border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button type="submit" className={`${button} mt-6 w-full py-3`} disabled={busy}>
            {busy ? "请稍候…" : sent ? "进入后台" : "获取验证码"}
          </button>
        </form>
      </section>
    </main>
  );
}

function ContentForm({
  type,
  item,
  onSaved,
}: {
  type: "MATERIAL" | "COURSE";
  item?: Material | Course;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [category, setCategory] = useState(
    type === "MATERIAL" ? ((item as Material | undefined)?.category ?? "求职资料") : "",
  );
  const [url, setUrl] = useState(type === "MATERIAL" ? ((item as Material | undefined)?.resourceUrl ?? "") : "");
  const [lessonsText, setLessonsText] = useState(
    type === "COURSE"
      ? ((item as Course | undefined)?.lessons ?? [])
          .map((lesson) => `${lesson.title}|${lesson.videoUrl}|${lesson.durationMinutes ?? ""}`)
          .join("\n")
      : "",
  );
  const [published, setPublished] = useState(item?.published ?? false);
  return (
    <form
      className="grid gap-3 border border-line bg-panel p-4 md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        await post("/admin/content", {
          id: item?.id,
          type,
          title,
          description,
          category,
          url,
          published,
          lessons:
            type === "COURSE"
              ? lessonsText
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line) => {
                    const [lessonTitle, videoUrl, duration] = line.split("|");
                    return { title: lessonTitle, videoUrl, durationMinutes: duration ? Number(duration) : null };
                  })
              : undefined,
        });
        onSaved();
      }}
    >
      <input className={field} placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <input
        className={field}
        placeholder={type === "MATERIAL" ? "分类" : "简介"}
        value={type === "MATERIAL" ? category : description}
        onChange={(e) => (type === "MATERIAL" ? setCategory(e.target.value) : setDescription(e.target.value))}
      />
      {type === "MATERIAL" && (
        <input
          className={`${field} md:col-span-2`}
          placeholder="资料链接"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
      )}
      {type === "COURSE" && (
        <textarea
          className={`${field} min-h-24 md:col-span-2`}
          placeholder={"每行一个课时：课时标题|视频链接|分钟数\n例：第一讲|https://example.com/video|45"}
          value={lessonsText}
          onChange={(e) => setLessonsText(e.target.value)}
        />
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        立即发布
      </label>
      <button type="submit" className={button}>
        保存{type === "MATERIAL" ? "资料" : "课程"}
      </button>
    </form>
  );
}

function AccessEditor({ student, data, onSaved }: { student: Student; data: Dashboard; onSaved: () => void }) {
  const [chosen, setChosen] = useState(new Set(student.grants.map((g) => `${g.contentType}:${g.contentId}`)));
  const [expiresOn, setExpiresOn] = useState("");
  const items = [
    ...data.materials.map((x) => ({ type: "MATERIAL", id: x.id, label: x.title })),
    ...data.courses.map((x) => ({ type: "COURSE", id: x.id, label: x.title })),
    ...data.questions.map((x) => ({ type: "QUESTION", id: x.id, label: x.prompt })),
  ] as const;
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm font-semibold text-brand">配置内容权限（{chosen.size}）</summary>
      <div className="mt-3 max-h-64 space-y-2 overflow-auto border border-line bg-paper p-3">
        {items.map((i) => {
          const key = `${i.type}:${i.id}`;
          return (
            <label key={key} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={chosen.has(key)}
                onChange={(e) =>
                  setChosen((s) => {
                    const n = new Set(s);
                    e.target.checked ? n.add(key) : n.delete(key);
                    return n;
                  })
                }
              />
              <span className="truncate">
                [{i.type}] {i.label}
              </span>
            </label>
          );
        })}
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm">
        授权到期（留空为永久）
        <input type="date" className={field} value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
      </label>
      <button
        type="button"
        className={`${button} mt-2`}
        onClick={async () => {
          await put(`/admin/students/${student.id}/access`, {
            grants: [...chosen].map((k) => {
              const [type, contentId] = k.split(":");
              return {
                contentType: type,
                contentId,
                expiresAt: expiresOn ? new Date(`${expiresOn}T23:59:59+08:00`).toISOString() : null,
              };
            }),
          });
          onSaved();
        }}
      >
        保存权限
      </button>
    </details>
  );
}

function QuestionForm({ data, item, onSaved }: { data: Dashboard; item?: Question; onSaved: () => void }) {
  const [prompt, setPrompt] = useState(item?.prompt ?? "");
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? data.categories[0]?.id ?? "");
  const [options, setOptions] = useState(item?.options.map((o) => o.text).join("\n") ?? "\n\n\n");
  const [answer, setAnswer] = useState(item?.answer ?? "A");
  const [difficulty, setDifficulty] = useState(item?.difficulty ?? "MEDIUM");
  const [source, setSource] = useState(item?.source ?? "后台录入");
  return (
    <form
      className="mt-3 grid gap-2 border border-line bg-paper p-3 md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const texts = options
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean);
        if (texts.length !== 4) {
          window.alert("请填写四个选项，每行一个");
          return;
        }
        const body = {
          prompt,
          categoryId,
          options: texts.map((text, i) => ({ letter: ["A", "B", "C", "D"][i], text })),
          answer,
          difficulty,
          source,
          published: item?.published ?? false,
          explanation: [],
        };
        if (item) await patch(`/admin/questions/${item.id}`, body);
        else await post("/admin/questions", body);
        onSaved();
      }}
    >
      <textarea
        className={`${field} min-h-20 md:col-span-2`}
        placeholder="题干"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        required
      />
      <select className={field} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
        {data.categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input className={field} value={source} onChange={(e) => setSource(e.target.value)} placeholder="来源" />
      <textarea
        className={`${field} min-h-24 md:col-span-2`}
        value={options}
        onChange={(e) => setOptions(e.target.value)}
        placeholder="四个选项，每行一个"
      />
      <select className={field} value={answer} onChange={(e) => setAnswer(e.target.value)}>
        {["A", "B", "C", "D"].map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <select className={field} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
        <option value="EASY">简单</option>
        <option value="MEDIUM">中等</option>
        <option value="HARD">困难</option>
      </select>
      <button type="submit" className={button}>
        保存题目
      </button>
    </form>
  );
}

function DashboardView() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("students");
  const load = () =>
    api<Dashboard>("/admin/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    api<Dashboard>("/admin/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  if (error) return <div className="p-10 text-red-700">{error}</div>;
  if (!data) return <div className="p-10">正在加载…</div>;
  const tabs: { id: Tab; label: string }[] = [
    { id: "students", label: "学生权限" },
    { id: "materials", label: "资料" },
    { id: "courses", label: "网课" },
    { id: "questions", label: "题库" },
  ];
  return (
    <div className="min-h-screen">
      <header className="flex items-center border-b border-line bg-panel px-6 py-4">
        <b className="text-lg">职寻 · ADMIN</b>
        <span className="ml-auto text-xs text-slate-500">内容与权限控制台</span>
      </header>
      <div className="grid md:grid-cols-[220px_1fr]">
        <aside className="border-r border-line p-4">
          {tabs.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`mb-1 w-full cursor-pointer px-4 py-3 text-left text-sm ${tab === t.id ? "bg-ink text-white" : "hover:bg-white"}`}
            >
              {t.label}
            </button>
          ))}
        </aside>
        <main className="p-5 md:p-8">
          <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Object.entries(data.summary).map(([k, v]) => (
              <div key={k} className="border border-line bg-panel p-4">
                <p className="text-xs text-slate-500">{k}</p>
                <b className="mt-2 block text-3xl">{v}</b>
              </div>
            ))}
          </div>
          {tab === "students" && (
            <section>
              <h1 className="mb-5 text-3xl font-semibold">学生权限</h1>
              <div className="space-y-3">
                {data.students.map((s) => (
                  <article key={s.id} className="border border-line bg-panel p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <b>{s.name}</b>
                        <p className="text-xs text-slate-500">{s.phone ?? "未绑定手机"}</p>
                      </div>
                      <select
                        className={`${field} ml-auto w-auto`}
                        value={s.plan}
                        onChange={async (e) => {
                          await patch(`/admin/students/${s.id}`, { plan: e.target.value });
                          load();
                        }}
                      >
                        <option>FREE</option>
                        <option>PRO</option>
                      </select>
                      <button
                        type="button"
                        className={
                          s.enabled
                            ? "cursor-pointer border border-red-300 px-3 py-2 text-sm text-red-700"
                            : "cursor-pointer bg-brand px-3 py-2 text-sm text-white"
                        }
                        onClick={async () => {
                          await patch(`/admin/students/${s.id}`, { enabled: !s.enabled });
                          load();
                        }}
                      >
                        {s.enabled ? "停用" : "启用"}
                      </button>
                    </div>
                    <AccessEditor student={s} data={data} onSaved={load} />
                  </article>
                ))}
              </div>
            </section>
          )}
          {tab === "materials" && (
            <section>
              <h1 className="mb-5 text-3xl font-semibold">资料管理</h1>
              <ContentForm type="MATERIAL" onSaved={load} />
              <div className="mt-5 space-y-2">
                {data.materials.map((m) => (
                  <div key={m.id} className="border border-line bg-panel p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <b>{m.title}</b>
                        <p className="text-xs text-slate-500">
                          {m.category} · {m.published ? "已发布" : "草稿"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-sm text-red-700"
                        onClick={async () => {
                          if (window.confirm("确定删除这份资料？")) {
                            await api(`/admin/content/MATERIAL/${m.id}`, { method: "DELETE" });
                            load();
                          }
                        }}
                      >
                        删除
                      </button>
                    </div>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-brand">编辑</summary>
                      <div className="mt-2">
                        <ContentForm type="MATERIAL" item={m} onSaved={load} />
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </section>
          )}
          {tab === "courses" && (
            <section>
              <h1 className="mb-5 text-3xl font-semibold">网课管理</h1>
              <ContentForm type="COURSE" onSaved={load} />
              <div className="mt-5 space-y-2">
                {data.courses.map((c) => (
                  <div key={c.id} className="border border-line bg-panel p-4">
                    <div className="flex items-center gap-3">
                      <b className="flex-1">{c.title}</b>
                      <button
                        type="button"
                        className="text-sm text-red-700"
                        onClick={async () => {
                          if (window.confirm("确定删除这门网课？")) {
                            await api(`/admin/content/COURSE/${c.id}`, { method: "DELETE" });
                            load();
                          }
                        }}
                      >
                        删除
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      {c.lessons.length} 课时 · {c.published ? "已发布" : "草稿"}
                    </p>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-brand">编辑课程与课时</summary>
                      <div className="mt-2">
                        <ContentForm type="COURSE" item={c} onSaved={load} />
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </section>
          )}
          {tab === "questions" && (
            <section>
              <h1 className="mb-5 text-3xl font-semibold">题库管理</h1>
              <details className="mb-4">
                <summary className="cursor-pointer font-semibold text-brand">新增题目</summary>
                <QuestionForm data={data} onSaved={load} />
              </details>
              <div className="space-y-2">
                {data.questions.map((q) => (
                  <div key={q.id} className="border border-line bg-panel p-4">
                    <div className="flex items-center gap-3">
                      <p className="flex-1 truncate text-sm">{q.prompt}</p>
                      <button
                        type="button"
                        className="cursor-pointer text-sm text-brand"
                        onClick={async () => {
                          await patch(`/admin/questions/${q.id}`, { published: !q.published });
                          load();
                        }}
                      >
                        {q.published ? "下架" : "发布"}
                      </button>
                    </div>
                    <details>
                      <summary className="mt-2 cursor-pointer text-sm text-brand">编辑题目</summary>
                      <QuestionForm data={data} item={q} onSaved={load} />
                    </details>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export function App() {
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    api("/admin/dashboard")
      .then(() => setReady(true))
      .catch(() => setReady(false));
  }, []);
  if (ready === null) return <div className="p-10">正在验证身份…</div>;
  return ready ? <DashboardView /> : <Login onDone={() => setReady(true)} />;
}
