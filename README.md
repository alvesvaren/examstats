# U345

Exam results and course ratings for every Chalmers course: pass rate, grades, every exam date on record, what students thought of the course, and a course planner where you fill a year of a programme with courses and see those numbers for each.

Exam results come from the public [stats.ftek.se API](https://github.com/Fysikteknologsektionen/chalmers-course-stats/blob/main/API.md). Course ratings come from [Chalmers course surveys](https://www.chalmers.se/en/education/your-studies/plan-and-conduct-your-studies/course-evaluation/), over the last five academic years. Study periods, rules and choices come from the [programme plans on chalmers.se](https://www.chalmers.se/en/education/your-studies/find-course-and-programme-syllabi/programme-overview/). The site is static, apart from one Vercel Function that draws the link preview image of each course.

GitHub Actions fetch the sources and commit them to `data/`:

- `data/results.json`: a nightly Action runs `pnpm fetch-results` and commits when results change, a few times per study period.
- `data/evaluations.json`: a monthly Action runs `pnpm evaluations`. The survey site is slow to crawl and changes rarely.
- `data/programme-plans.json`: a weekly Action runs `pnpm programme-plans` and commits when a plan changes. It holds every academic year since 2021/2022. The current one switches in July.
- `data/names.json`: the same Action writes the English and Swedish names of every course and programme on chalmers.se since 2021/2022.

Every push deploys to Vercel. The build turns `data/` into static JSON next to the site and reads no network, so it works while a source is down. When a fetch fails, the committed data stays as it was.

## Run locally

```sh
pnpm install
pnpm snapshot
pnpm dev
```

`pnpm snapshot` takes a few seconds and writes about 20 MB to `public/data`.
