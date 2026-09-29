# User journeys

## Journeys

| # | User | Story | Entry | Ends on |
| --- | --- | --- | --- | --- |
| 1 | Student picking electives | Compare the courses I am considering, so I avoid one where half fail or students are unhappy. | Programme or course names | List, sorted, then one or two courses |
| 2 | Student before an exam | See how recent exams went, so I know what to expect. | Course code | Course, latest exams |
| 3 | Student planning a retake | See when retakes happen and how they go. | Course code | Course, small exams in the timeline |
| 4 | New student | See which courses in my programme are hard. | Programme name or code | List scoped to the programme, sorted by pass rate |
| 5 | Student representative | Spot courses in my programme where results dropped. | Programme | List scoped to the programme, sorted by trend |
| 6 | Curious visitor | Find the hardest and easiest courses at Chalmers. | Nothing | List, sorted by pass rate, large courses only |

## What they share

- Every journey starts with a course code, a course name, a programme, or nothing. One search box that matches courses and programmes covers all of them.
- Every journey compares the same four numbers: pass rate, size, average grade, and trend. The list row and the course header show exactly these.
- Journeys 2, 3 and 5 need individual exam dates. The timeline on the course page covers them.
- A programme is a scope on the list, not a separate page.

## Structure

- **List**: search, programme scope, and every course in one sortable list. Active courses come first. Ended courses sit in a collapsed group at the end.
- **Course**: the four numbers, the timeline at full width, then grades, other parts, the course survey, and other instances of the course.

## Definitions

- Pass rate: passed attempts divided by all attempts on the main exam, over the last three academic years with results.
- Size: attempts per year on the main exam, over the same three years.
- Ended: no new results for 18 months.
- Main exam: the exam part with the most attempts. Courses without an exam use their largest part.
- Rating: the mean answer to "What is your overall impression of the course?" in Chalmers course surveys, 1 to 5, over every answer in the last five academic years. Courses with fewer than five answers have no rating. The survey reports only show how many gave each answer as a bar chart, so `pnpm evaluations` reads the bar lengths and checks them against the reported mean.
- Spread: grade and rating marks show the mean as a dot, the median as a tick, and one standard deviation either side of the mean as a band. Quartiles would collapse onto whole grades on a three or five step scale.
- Workload: the course survey question on workload, where 1 is too low, 3 balanced and 5 too high. It stays out of the rating.
