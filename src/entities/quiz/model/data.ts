import type { CompanySet, DayCheckin, QuizCategory, QuizQuestionData, WrongItem } from "./types";

export const todaysQuestion: QuizQuestionData = {
  date: "09 / 11",
  category: "言语理解 · 单选",
  difficulty: "难度 中等",
  source: "行测真题",
  indexLabel: "试题 1 / 20",
  prompt:
    "一百多年来，现代语言科学经历了三个重要时期，历史比较语言学、结构主义语言学和转换生成语言学分别是这三个时期的代表。对这段话最准确的复述是：",
  options: [
    { letter: "A", text: "现代语言学发展了一百多年" },
    { letter: "B", text: "现代语言学经历了历史比较语言学、结构主义语言学和转换生成语言学三大时期" },
    { letter: "C", text: "历史比较语言学、结构主义语言学和转换生成语言学是现代语言学" },
    { letter: "D", text: "历史比较语言学、结构主义语言学和转换生成语言学都经历了一百多年的发展" },
  ],
  answer: "B",
  explanation: [
    "材料的主干是「现代语言科学经历了三个重要时期」，后半句只是为三个时期各举一个代表。B 完整保留了「经历三个时期」这一主干与三者的对应关系，是最准确的复述。",
    "A 只取了时间信息，丢掉主干；C 把「代表」偷换为「就是现代语言学」，扩大范围；D 把「一百多年」错分给三个时期各自，属于偷换对象。",
  ],
  accuracyRate: 62,
};

export const streakDays = 12;
export const weekCheckins: DayCheckin[] = [
  { label: "一", done: true },
  { label: "二", done: true },
  { label: "三", done: true },
  { label: "四", done: true },
  { label: "五", done: false },
  { label: "六", done: false },
  { label: "日", done: false },
];
export const weekSolved = 14;
export const weekTarget = 20;
export const totalSolved = 263;

export const categories: QuizCategory[] = [
  { label: "言语理解与表达", count: 412, highlighted: true },
  { label: "计算机基础单选", count: 286 },
  { label: "算法概念选择题", count: 174 },
  { label: "行为面情景选择", count: 94 },
  { label: "公司真题合集", count: 1208 },
];

export const wrongList: WrongItem[] = [
  { title: "下列对文段主旨概括最准确的是", due: "今天" },
  { title: "TCP 三次握手中错误的一项是", due: "今天" },
  { title: "关于快排平均复杂度的说法", due: "明天" },
  { title: "组内分工冲突时最恰当的做法", due: "3 天后" },
];

export const companySets: CompanySet[] = [
  { kicker: "互联网 · 后端", company: "阿里巴巴", focus: "JVM、MySQL 索引、分布式事务、场景设计题", count: 186 },
  { kicker: "互联网 · 客户端", company: "腾讯", focus: "C++ 内存模型、网络协议、操作系统调度", count: 154 },
  { kicker: "互联网 · 全栈", company: "字节跳动", focus: "算法中等偏难、浏览器渲染、系统设计", count: 231 },
  { kicker: "硬件 · 嵌入式", company: "华为", focus: "C 语言指针、RTOS、数字电路与通信基础", count: 128 },
];
