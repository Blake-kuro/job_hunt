export type Grant = {
  id: string;
  contentType: "MATERIAL" | "QUESTION" | "COURSE";
  contentId: string;
  expiresAt: string | null;
};
export type Student = {
  id: string;
  name: string;
  phone: string | null;
  enabled: boolean;
  plan: "FREE" | "PRO";
  proExpiresAt: string | null;
  createdAt: string;
  grants: Grant[];
};
export type Material = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  resourceUrl: string;
  published: boolean;
  updatedAt: string;
};
export type Course = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  published: boolean;
  updatedAt: string;
  lessons: { id: string; title: string; videoUrl: string; durationMinutes: number | null; sortOrder: number }[];
};
export type Question = {
  id: string;
  prompt: string;
  categoryId: string;
  options: { letter: string; text: string }[];
  answer: string;
  explanation: string[];
  difficulty: string;
  source: string;
  published: boolean;
};
export type Dashboard = {
  summary: { students: number; enabledStudents: number; materials: number; courses: number; questions: number };
  students: Student[];
  materials: Material[];
  courses: Course[];
  categories: { id: string; name: string }[];
  questions: Question[];
};

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `请求失败 (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}
export const post = (path: string, body: unknown) => api<void>(path, { method: "POST", body: JSON.stringify(body) });
export const patch = (path: string, body: unknown) => api<void>(path, { method: "PATCH", body: JSON.stringify(body) });
export const put = (path: string, body: unknown) => api<void>(path, { method: "PUT", body: JSON.stringify(body) });
