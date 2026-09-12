import type { Job } from "./types";

export const jobs: Job[] = [
  { id: "1", company: "字节跳动", role: "前端开发工程师（实习）", city: "北京", type: "实习", degree: "本科及以上", deadline: "09-30", posted: "09-08", status: "未投递", daysLeft: 19, referral: true, starred: true },
  { id: "2", company: "美团", role: "数据分析实习生", city: "北京", type: "实习", degree: "本科及以上", deadline: "09-18", posted: "09-05", status: "面试中", daysLeft: 7, referral: false, starred: true },
  { id: "3", company: "网易", role: "游戏客户端开发实习", city: "广州", type: "实习", degree: "本科及以上", deadline: "09-22", posted: "09-04", status: "未投递", daysLeft: 11, referral: false, starred: false },
  { id: "4", company: "商汤科技", role: "多模态算法实习", city: "上海", type: "实习", degree: "硕士及以上", deadline: "09-26", posted: "09-03", status: "面试中", daysLeft: 15, referral: true, starred: false },
  { id: "5", company: "阿里巴巴", role: "后端开发工程师（Java）", city: "杭州", type: "校招", degree: "硕士及以上", deadline: "10-08", posted: "09-07", status: "已投递", daysLeft: 27, referral: false, starred: true },
  { id: "6", company: "拼多多", role: "后端开发工程师（Go）", city: "上海", type: "校招", degree: "本科及以上", deadline: "10-05", posted: "09-08", status: "未投递", daysLeft: 24, referral: false, starred: true },
  { id: "7", company: "百度", role: "机器学习工程师", city: "北京", type: "校招", degree: "硕士及以上", deadline: "10-12", posted: "09-06", status: "未投递", daysLeft: 31, referral: true, starred: false },
  { id: "8", company: "腾讯", role: "客户端开发（2027 校招）", city: "深圳", type: "校招", degree: "本科及以上", deadline: "10-15", posted: "09-09", status: "已投递", daysLeft: 34, referral: false, starred: true },
  { id: "9", company: "蔚来", role: "智能座舱软件工程师", city: "合肥", type: "校招", degree: "本科及以上", deadline: "10-18", posted: "09-09", status: "未投递", daysLeft: 37, referral: false, starred: false },
  { id: "10", company: "小米", role: "算法工程师（CV）", city: "北京", type: "校招", degree: "硕士及以上", deadline: "10-20", posted: "09-10", status: "未投递", daysLeft: 39, referral: true, starred: true },
  { id: "11", company: "华为", role: "嵌入式软件工程师", city: "上海", type: "校招", degree: "本科及以上", deadline: "10-31", posted: "09-09", status: "未投递", daysLeft: 50, referral: false, starred: false },
  { id: "12", company: "京东", role: "产品运营实习生", city: "北京", type: "实习", degree: "本科及以上", deadline: "09-15", posted: "09-02", status: "已截止", daysLeft: -1, referral: false, starred: false },
];

export const cities = ["全部", "北京", "上海", "深圳", "杭州", "广州"] as const;
