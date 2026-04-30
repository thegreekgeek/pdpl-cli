# Syllabus Import

This import handler reads a schema.org-structured YAML syllabus file and hydrates it into flat assignment entities that can be piped through PDPL recipes.

## Expected YAML structure

The syllabus file must be a single YAML document whose root is a `CourseInstance`. The full schema mirrors [schema.org](https://schema.org) vocabulary:

```yaml
"@context": "https://schema.org"
"@type": "CourseInstance"
courseCode: "MATH 1113-81"
name: "Pre-Calculus"
instructor:
  "@type": "Person"
  name: "Dr. Paul Seifert"
  email: "paul.seifert@mnwest.edu"
courseMode: "online"
educationalCredentialAwarded: "3 Credits"

# Optional: recurring weekly deadline schedule
eventSchedule:
  - "@type": "Schedule"
    byDay: "Tuesday"
    startTime: "23:59"
    description: "Weekly Homework and Test Deadline"

# Curriculum broken down into weekly sections (keys w01, w02, …)
curriculum:
  w01:
    "@type": "CreativeWork"
    name: "Chapter 1"
    startDate: "2026-01-12"
    educationalUse:                      # optional reading list
      - "@type": "CreativeWork"
        name: "Sections 1.1 - 1.4"
        author: "Rockswold"
    workExample:                         # assignments / assessments
      - { "@type": "ExercisePlan", name: "Section 1.1 Homework", endTime: "2026-01-20T23:59" }
      - { "@type": "Assessment",   name: "Chapter 1 Test",       endTime: "2026-01-20T23:59" }
```

### Supported `workExample` types

| `@type` | Meaning |
|---|---|
| `ExercisePlan` | A homework or practice assignment |
| `Assessment` | A graded test or quiz |
| `Comment` | A discussion post or participation activity |

## Running the import

```sh
pdpl import syllabus-import /path/to/syllabus.yaml
```

The `PATH_NAME` argument must point to the **directory** containing the YAML file. The file is read directly from that path when no `getImportPath` override is needed (i.e. pass the directory that contains a single syllabus file).

## Output

Each `workExample` item in the curriculum becomes a single flattened JSON entity written to:

```
<jsonOutputDir>/syllabus-import/syllabus-assignments/YYYY-MM-DD.json
```

Files are grouped by the assignment's `endTime` date. Each entity contains:

| Field | Description |
|---|---|
| `courseCode` | e.g. `"MATH 1113-81"` |
| `courseName` | e.g. `"Pre-Calculus"` |
| `courseMode` | e.g. `"online"` |
| `instructorName` | Instructor's full name |
| `instructorEmail` | Instructor's email address |
| `weekKey` | Curriculum key, e.g. `"w01"` |
| `weekName` | Week section heading |
| `weekStartDate` | ISO date the week begins |
| `assignmentType` | `ExercisePlan`, `Assessment`, or `Comment` |
| `assignmentName` | Display name of the assignment |
| `endTime` | ISO 8601 deadline (`YYYY-MM-DDTHH:mm`) |
| `day` | Date portion of `endTime` (`YYYY-MM-DD`) |

## Sample recipe

See [`recipes/syllabus-obsidian.yml`](../../recipes/syllabus-obsidian.yml) for an example that pipes assignment deadlines into Obsidian daily notes.
