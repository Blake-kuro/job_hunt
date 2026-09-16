const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");
const path = require("node:path");

function page(name, request) {
  let instance;
  const navigation = [];
  const file = path.join(__dirname, `../miniprogram/pages/${name}/${name}.ts`);
  const source = fs
    .readFileSync(file, "utf8")
    .replace(/^import \{ request \} from "..\/..\/utils\/request";/m, 'const { request } = require("request");');
  const js = stripTypeScriptTypes(source);
  vm.runInNewContext(js, {
    exports: {},
    require: () => ({ request }),
    Page: (p) => {
      instance = p;
    },
    wx: { navigateTo: (p) => navigation.push(p.url), switchTab: (p) => navigation.push(p.url) },
  });
  instance.setData = (data) => Object.assign(instance.data, data);
  return { instance, navigation };
}
const plain = (v) => JSON.parse(JSON.stringify(v));
const question = (type = "MULTI") => ({
  category: { id: "cat", company: "公司", name: "分类", total: 2 },
  index: 1,
  answered: 0,
  exhausted: null,
  question: {
    id: "q1",
    type,
    options: [
      { letter: "A", text: "甲" },
      { letter: "B", text: "乙" },
      { letter: "C", text: "丙" },
    ],
  },
});
const pick = (p, letter) => p.pick({ currentTarget: { dataset: { letter } } });

test("分类取题、数组提交多选、解析显示及下一题状态清理", async () => {
  const calls = [];
  const { instance: p } = page("quiz", async (...args) => {
    calls.push(args);
    return args[1] === "POST" ? { correct: true, answer: ["A", "C"], explanation: ["解析"] } : question();
  });
  p.data.categoryId = "cat /1";
  await p.load();
  assert.equal(calls[0][0], "/quiz/categories/cat%20%2F1/next");
  pick(p, "C");
  pick(p, "A");
  pick(p, "B");
  pick(p, "B");
  await p.submit();
  assert.deepEqual(plain(calls[1]), ["/quiz/attempts", "POST", { questionId: "q1", picked: ["A", "C"] }]);
  assert.equal(p.data.answerText, "A、C");
  assert.equal(p.data.options.filter((o) => o.right).length, 2);
  pick(p, "B");
  await p.submit();
  assert.equal(calls.length, 2);
  await p.load();
  assert.equal(p.data.result, null);
  assert.deepEqual(plain(p.data.picked), []);
});
test("单选和判断只保留一个答案，提交中锁定选项和重复请求", async () => {
  for (const type of ["SINGLE", "JUDGE"]) {
    let resolve;
    let posts = 0;
    const { instance: p } = page("quiz", async (_, method) =>
      method === "POST"
        ? (posts++,
          new Promise((r) => {
            resolve = r;
          }))
        : question(type),
    );
    p.data.categoryId = "cat";
    await p.load();
    pick(p, "A");
    pick(p, "B");
    assert.deepEqual(plain(p.data.picked), ["B"]);
    const pending = p.submit();
    pick(p, "C");
    await p.submit();
    assert.equal(posts, 1);
    assert.deepEqual(plain(p.data.picked), ["B"]);
    resolve({ correct: false, answer: ["A"], explanation: [] });
    await pending;
    assert.equal(p.data.options.find((o) => o.letter === "B").wrong, true);
  }
});
test("取题失败允许重试，配额和答完状态保留服务端返回", async () => {
  let fail = true;
  const { instance: p } = page("quiz", async () => {
    if (fail) throw Error("网络失败");
    return { question: null, exhausted: "QUOTA" };
  });
  p.data.categoryId = "cat";
  await p.load();
  assert.equal(p.data.error, "网络失败");
  fail = false;
  await p.load();
  assert.equal(p.data.error, "");
  assert.equal(p.data.today.exhausted, "QUOTA");
  await p.submit();
  assert.equal(p.data.submitting, false);
});
test("首页先建立会话，再读题库，按选中分类跳转", async () => {
  const calls = [];
  const { instance: p, navigation } = page("index", async (url) => {
    calls.push(url);
    return {};
  });
  await p.load();
  assert.deepEqual(calls, ["/quiz/dashboard", "/quiz/banks"]);
  p.start({ currentTarget: { dataset: { categoryId: "cat/2" } } });
  assert.deepEqual(navigation, ["/pages/quiz/quiz?categoryId=cat%2F2"]);
});
