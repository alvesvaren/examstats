# U345

Exam results for every Chalmers course: pass rate, grades and every exam date on record.

The data comes from the public [stats.ftek.se API](https://github.com/Fysikteknologsektionen/chalmers-course-stats/blob/main/API.md). Every Vercel build fetches it and writes static JSON next to the site. A nightly GitHub Action triggers a rebuild through a Vercel deploy hook. There is no server.

## Run locally

```sh
pnpm install
pnpm snapshot
pnpm dev
```

`pnpm snapshot` takes under a minute and writes about 20 MB to `public/data`.
