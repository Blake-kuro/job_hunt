import { useEffect, useState } from "react";

/**
 * 搜索框防抖：返回本地 draft 与 setter。
 * - `committed`（外部真值，通常来自 URL search）变化时同步 draft；
 * - draft 停止变化 ms 后 trim 并 commit；与 committed 相同时不 commit。
 */
export function useDebouncedSearch(
  committed: string,
  commit: (next: string) => void,
  ms = 300,
): [draft: string, setDraft: (value: string) => void] {
  const [draft, setDraft] = useState(committed);
  const [prev, setPrev] = useState(committed);
  if (committed !== prev) {
    setPrev(committed);
    setDraft(committed);
  }
  useEffect(() => {
    const normalized = draft.trim();
    if (normalized === committed) return;
    const t = setTimeout(() => commit(normalized), ms);
    return () => clearTimeout(t);
  }, [draft, committed, commit, ms]);
  return [draft, setDraft];
}
