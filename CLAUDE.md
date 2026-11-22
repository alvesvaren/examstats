# U345

Exam results and course survey ratings for every Chalmers course, and a course planner over this year's programme plans, built from stats.ftek.se, Chalmers' course survey site and the programme plans on chalmers.se.

## Follow the alve-skills plugin

`.claude/settings.json` enables the `alve-skills` plugin. Apply `typescript-best-practices` to all `.ts` and `.tsx` code, `react-best-practices` to UI code, and `testing-best-practices` to tests. Run `/alve-skills:writing` for docs, commits and PR text.

## Commands

- `pnpm snapshot` builds `public/data` from the committed files in `data/`, offline. Run it once before `pnpm dev`.
- `pnpm fetch-results` fetches stats.ftek.se into `data/results.json`. A nightly Action runs it and commits the file when it changes.
- `pnpm evaluations` crawls the course surveys into `data/evaluations.json`. It takes about 25 minutes: reports render one at a time, and charts download in parallel. A monthly Action runs it and commits the file.
- `pnpm programme-plans` fetches every programme plan of each academic year since 2021/2022, and the degree requirements, accredited master's programmes and master's prerequisites in each programme syllabus, and the examiners and seats of the current year's course rounds, from the JSON API behind chalmers.se into `data/programme-plans.json`, in about a minute. It also writes `data/names.json`, with the English and Swedish names of every course and programme since 2021/2022 and the newest academic year chalmers.se offers each course in. A weekly Action runs it and commits the files when they change.
- `pnpm eligibility` reads Chalmers' newest eligibility guide into `data/eligibility.json`. The guide is "Val av masterprogram för Chalmersstudenter – Behörighetsguide", a PDF on Chalmers' admission regulations page. It translates each master's programme's entry requirements into Chalmers course codes for the students of each programme, and the planner checks plans against it. The parser reads only the guide's fixed phrasings, and a parsed rule of courses must render back to the exact words it came from. The planner shows any other block in the guide's words without a check, and the script lists it as "Not checked". A weekly Action runs the script and commits the file when it changes. Chalmers publishes the next year's guide each October. When it does, read the "Not checked" list and teach the parser each new phrasing, rather than accept a block the parser cannot read. To fix a typo in the guide, such as a code that never existed, add a correction to `data/eligibility-corrections.json`: the line of one programme's requirements as the guide words it, the line it means, and why. The planner says when it reads a corrected line. A correction applies only while the guide words the line as the correction quotes it, and the script lists a correction it no longer applies as "Correction not applied". No code parses the prerequisites in each master's programme's syllabus, since they are written for every applicant and the guide translates them for Chalmers students.
- `data/upcoming-masters.json` is a temporary file with the master's programmes of 2027/2028, which Chalmers has announced but not yet planned in its API. It lists the master's programmes each programme accredits, from Chalmers' accreditation matrix, and the names of the courses on each master's programme's course list PDF. It was made once from those files, and no command updates it. `pnpm snapshot` plans each listed course in the study periods that this year's course of the same name runs in. A listed course whose name no course has this year is pending. It gets a made-up code that starts with `new-`, and no study periods or credits. Once `data/programme-plans.json` has the plans of 2027/2028, `pnpm snapshot` ignores the file, and you can delete it.
- `pnpm dev`, `pnpm build`, `pnpm typecheck`
- `pnpm lint` runs oxlint with type-aware rules. ESLint's TypeScript support needs the TypeScript API, which TypeScript 7 does not ship.
- `pnpm format` runs Prettier, which also sorts Tailwind classes. `pnpm format:check` only checks.
- CI runs `format:check`, `typecheck`, `lint` and `test` on every push to main and every pull request.
- `pnpm test` runs Vitest.

## Layout

- `src/domain` holds pure logic and the Zod schemas for `data/` and the snapshot. The scripts import it too, so imports there use relative paths with `.ts` extensions and no `@/` alias.
- `src/lib/page-meta.ts` holds page titles and link preview descriptions. The router sets the titles, and `scripts/page-meta-plugin.ts` writes them into `dist/index.html` and one `dist/course/<code>.html` per course at build time, since link previews run no JavaScript. The build reads `public/data`, so run `pnpm snapshot` first. The plugin imports `page-meta.ts`, so it uses relative imports too.
- `api/og.tsx` is a Vercel Function that draws a course's link preview image with Satori and resvg. It reads `public/data` and its fonts from disk, so `includeFiles` in `vercel.json` must list every file it reads, and also Satori's `hb.wasm`, which file tracing misses. Vercel's file tracing follows imports of `.ts` files but not of `.tsx` files, so the image's components live in `api/og.tsx`, and everything it imports from `src` uses relative imports.
- The README's architecture section has the module map and where each kind of change goes.
- Each script that a `pnpm` command runs calls `main` only under `import.meta.main`, so tests can import its pure transforms. Tests feed them recorded responses from `scripts/fixtures`.
- `buildSnapshot` in `scripts/build-snapshot.ts` joins the files of `data/` into the contents of `public/data` and does no I/O. `scripts/snapshot.ts` only reads the files, calls it and writes the result.
- `scripts/fetch-results.ts` is the only code that knows the stats.ftek.se API. `scripts/evaluations.ts` and `scripts/evaluation-pages.ts` are the only code that knows the course survey site. `scripts/programme-plans.ts` is the only code that knows the chalmers.se API, and `scripts/eligibility.ts` the only code that knows the eligibility guide.
- `src/features/course-list`, `src/features/course` and `src/features/planner` are the three pages. `src/components/ui` is generated by shadcn. Change it with the shadcn CLI.
- Shareable UI state lives in the URL search params, validated in `src/router.tsx`. The planner's search schema lives in `src/domain/planner-state.ts`, beside the device memory.
- The planner resolves the URL and the device memory together in `resolvePlanner`, and changes both in `plannerStep`. Only `src/features/planner/use-planner.ts` calls `navigate` or touches the device memory. The planner components only render and dispatch actions.

## Data rules

- The whole site shows in the language picked in the header, English or Swedish. It starts as the device's language and the browser remembers it. Every UI word lives in `src/lib/i18n/en.ts`, and `src/lib/i18n/sv.ts` has the same shape, so the type checker finds a missing translation. Components get the words, and the language's number and date formats, from `useMessages()`. Link previews know no language, so the build and `api/og.tsx` write English.
- Course and programme names come from `data/names.json`. Search matches names in both languages. A name Chalmers has in only one language shows in that one. Courses and programmes that chalmers.se no longer lists keep the name from stats.ftek.se, which is usually Swedish.
- Show grades in the order of `GRADES` in `src/domain/grades.ts`: U first, then 3, 4 and 5. Vertical displays put U at the bottom and 5 at the top.
- Grade colours are the `--grade-*` tokens in `src/index.css`. Grade 3 is the lightest and 5 the darkest in both themes.
- Metric definitions and the journeys behind the layout are in `docs/user-journeys.md`.
