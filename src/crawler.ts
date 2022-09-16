import fs from "node:fs";
import path from "node:path";
import fetch from "node-fetch";
import ora from "ora";
import { JSDOM } from "jsdom";
import { Article } from "./types";
import { RateLimiter } from "./rate-limiter";

process.env.TZ = "Asia/Taipei";

let done = 0;
const limiter = new RateLimiter({ limit: 20, interval: 1000, concurrent: 10 });
const spinner = ora("Starting ...").start();

main();

async function main() {
    const START_TIME = Date.now();

    const base_url = "https://ithelp.ithome.com.tw/2022ironman/";
    const types = ["contest", "self"];

    const results = await Promise.all(types.map((type) => crawler(base_url + type)));
    const data = results.reduce((a, b) => a.concat(b), []);
    data.sort((a, b) => b.view - a.view || b.date[1] - a.date[1] || b.date[2] - a.date[2]);

    save_data(data);

    const END_TIME = Date.now();
    spinner.succeed(`Crawled ${data.length} Articles in ${((END_TIME - START_TIME) / 1000).toFixed(2)}s`);
}

async function crawler(head_url: string) {
    const results = new Map();

    const first_page = await task(head_url);
    first_page.result.forEach((val, key) => results.set(key, val));

    let total = first_page.count;
    const tasks: Promise<void>[] = [Promise.resolve(), Promise.resolve()];

    while (tasks.length < total) {
        for (let i = tasks.length; i <= total; i++) {
            tasks.push(
                task(head_url + "?page=" + i).then((page) => {
                    page.result.forEach((val, key) => results.set(key, val));
                    done += page.result.size;
                    spinner.text = `Crawled Articles: ${done}`;
                    if (page.count > total) {
                        total = page.count;
                    }
                })
            );
        }

        let waiter = Promise.all(tasks);
        while ((await waiter).length !== tasks.length) {
            waiter = Promise.all(tasks);
        }
    }

    return [...results.values()];
}

async function task(url: string) {
    await limiter.lock();
    try {
        const result = new Map<string, ReturnType<typeof parse_article>>();
        const html = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Crawler" } }).then((res) => res.text());

        const dom = new JSDOM(html);
        const document = dom.window.document;
        const end_link = document.querySelector(".pagination .pagination-inner:nth-last-child(2) a:not([class]):nth-last-child(1)");

        const count = parseInt(end_link?.textContent || "0");

        const articles = document.querySelectorAll(".articles-box");
        for (const article of articles) {
            const parsed = parse_article(article);
            if (parsed) {
                result.set(parsed.link, parsed);
            }
        }

        limiter.unlock();
        return { result, count };
    } catch (err) {
        limiter.unlock();
        throw err;
    }
}

function parse_article(article: Element): Article | undefined {
    try {
        const type = article.querySelector(".articles-tag")?.textContent?.trim() || "";
        const series = article.querySelector(".articles-topic > a")?.textContent?.trim() || "";
        const title = article.querySelector(".articles-title > a")?.textContent?.trim() || "";
        const link = article.querySelector<HTMLAnchorElement>(".articles-title > a")?.href || "";
        const author = article.querySelector(".ir-list__name")?.textContent?.trim() || "";
        const team = article.querySelector("a[href^='https://ithelp.ithome.com.tw/2022ironman/signup/team/']")?.textContent?.trim() || null;
        const date =
            article
                .querySelector(".date")
                ?.textContent?.trim()
                .match(/(\d{4})-(\d{2})-(\d{2})/)
                ?.slice(1, 4)
                .map(Number) || [];
        const view = parseInt(article.querySelector(".views")?.textContent?.trim() || "0");

        return { type, series, title, link, author, date, view, team };
    } catch (err) {
        console.error("Article Parse Error", err.message);
    }
}

function save_data(data: Article[]) {
    const d = new Date();
    const filename = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}.json`;
    const file_path = path.join(__dirname, "../data", filename);

    let file = {};
    if (fs.existsSync(file_path)) {
        file = JSON.parse(fs.readFileSync(file_path, "utf-8"));
    }

    const hour = d.getHours().toString().padStart(2, "0");
    file[hour] = data;

    if (!fs.existsSync(path.join(__dirname, "../data"))) {
        fs.mkdirSync(path.join(__dirname, "../data"), { recursive: true });
    }
    fs.writeFileSync(file_path, JSON.stringify(file));
}
