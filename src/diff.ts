import fs from "node:fs";
import path from "node:path";
import { Article } from "./types";

const date_1 = process.argv[2];
const date_2 = process.argv[3];

if (!date_1 || !date_2) {
    console.error("Please provide two dates in YYYY-MM-DD format");
    process.exit(1);
}

const data_1 = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", date_1 + ".json"), "utf-8")) as Record<string, Article[]>;
const data_2 = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", date_2 + ".json"), "utf-8")) as Record<string, Article[]>;

const diffs: Article[] = [];

const day_1 = Object.values(data_1)[0];
const day_2 = Object.values(data_2)[0];

const day_1_map = new Map<string, Article>();
const day_2_map = new Map<string, Article>();

for (const article of day_1) {
    day_1_map.set(article.link, article);
}

for (const article of day_2) {
    day_2_map.set(article.link, article);
}

for (const article of day_2) {
    if (day_1_map.has(article.link)) {
        const diff_view = article.view - (day_1_map.get(article.link)?.view || 0);
        diffs.push({ ...article, view: diff_view });
    } else {
        diffs.push(article);
    }
}

diffs.sort((a, b) => b.view - a.view);

let output = `## 每日鐵人賽熱門 Top 10 (${date_2})\n\n以 ${date_1.split("-").join("/") + " " + Object.keys(data_1)[0] + ":00"} ~ ${
    date_2.split("-").join("/") + " " + Object.keys(data_2)[0] + ":00"
} 文章觀看數增加值排名\n\n> 誤差： 1 小時\n\n`;

for (let i = 0; i < 10; i++) {
    const article = diffs[i];
    output += `${i + 1}. \`+${article.view}\` [${article.title}](${article.link})\n`;
    output += `    * 作者： ${article.author}\n`;
    output += `    * 系列：${article.series}\n`;
}

console.log(output);
