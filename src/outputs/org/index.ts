import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { Database } from "duckdb-async";
import mustache from "mustache";
mustache.escape = (text) => text;

import { KeyVal, OutputHandler } from "../../utils/types.js";
import { pathAccessible } from "../../utils/fs.js";

////
/// Types
//

interface DailyNoteStrategyData {
  date?: string;
  template?: string;
  section?: string;
  add_title?: boolean;
  year_folders?: boolean;
}

////
/// Helpers
//

const PDPL_TAG = ":pdpl:";

const getTemplateFields = (template: string): string[] => {
  const templateFields = [];
  for (const token of mustache.parse(template) as string[][]) {
    if (["#", "name"].includes(token[0])) {
      templateFields.push(token[1]);
    }
  }
  return templateFields;
};

/**
 * Remove the pdpl-managed section (the heading tagged :pdpl: and all lines
 * until the next heading of the same or higher level, or end-of-file).
 */
const stripPdplSection = (content: string): string => {
  const lines = content.split("\n");
  const result: string[] = [];
  let inPdplSection = false;
  let pdplHeadingDepth = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^(\*+)\s/);
    if (headingMatch) {
      const depth = headingMatch[1].length;
      if (line.includes(PDPL_TAG)) {
        inPdplSection = true;
        pdplHeadingDepth = depth;
        continue;
      }
      if (inPdplSection && depth <= pdplHeadingDepth) {
        inPdplSection = false;
      }
    }
    if (!inPdplSection) {
      result.push(line);
    }
  }

  // Trim trailing blank lines that were left by removing the section
  while (result.length > 0 && result[result.length - 1].trim() === "") {
    result.pop();
  }

  return result.join("\n");
};

////
/// Export
//

const handler: OutputHandler = {
  isReady: () => {
    const orgPath = process.env["ORG_DAILY_NOTES_PATH"] || "";
    return !!(orgPath && pathAccessible(orgPath));
  },
  handlers: [
    {
      name: () => "daily_notes_append",
      isReady: (fields: object, strategyData?: DailyNoteStrategyData) => {
        const errors: string[] = [];

        if (!strategyData || typeof strategyData !== "object") {
          errors.push("Missing output data fields: date, template");
          return errors;
        }

        if (!strategyData.date) {
          errors.push("Missing date field");
        }

        if (strategyData.date && !Object.keys(fields).includes(strategyData.date)) {
          errors.push(`Date field ${strategyData.date} does not exist in input data.`);
        }

        if (!strategyData.template) {
          errors.push("Missing template");
        }

        return errors;
      },
      handle: async (db: Database, fields: KeyVal, data?: DailyNoteStrategyData) => {
        const orgDailyNotesPath = process.env["ORG_DAILY_NOTES_PATH"] || "";
        const {
          date: dateField,
          template = "",
          section = "pdpl",
          add_title: addTitle = true,
          year_folders: yearFolders = false,
        } = data as DailyNoteStrategyData;

        const templateFields = getTemplateFields(template);
        const errorPrefix = "org.daily_notes_append handler: ";

        const fieldSources: string[] = [];
        for (const templateField of templateFields) {
          fieldSources.push(fields[templateField]);
        }

        if ([...new Set(Object.values(fieldSources))].length > 1) {
          throw new Error(
            `${errorPrefix}Multiple tables found for template fields: ${fieldSources.join(", ")}`
          );
        }

        const dateSource = fields[dateField as string];
        const dataSource = fieldSources[0] || dateSource;

        const results = await db.all(`
          SELECT ${dateField} ${templateFields.length ? `, ${templateFields.join(", ")}` : ""}
          FROM '${dataSource}'
          WHERE ${dateField} IS NOT NULL
        `);

        const dailyFiles: { [key: string]: string[] } = {};
        for (const result of results) {
          const thisDate = result[dateField as string] as string;
          if (!thisDate) {
            continue;
          }

          const templateObject: { [key: string]: string | string[] } = {};
          templateFields.forEach((field) => {
            templateObject[field] = Array.isArray(result[field])
              ? [...new Set((result[field] as []).flat(Infinity))]
              : (result[field] as string);
          });

          const thisYear = thisDate.split("-")[0];

          let noteDirPath: string;
          if (yearFolders) {
            noteDirPath = path.join(orgDailyNotesPath, thisYear);
          } else {
            noteDirPath = orgDailyNotesPath;
          }

          mkdirSync(noteDirPath, { recursive: true });
          const notePath = path.join(noteDirPath, `${thisDate}.org`);

          if (!dailyFiles[notePath]) {
            dailyFiles[notePath] = [];
          }

          dailyFiles[notePath].push(mustache.render(template, templateObject));
        }

        for (const notePath in dailyFiles) {
          const appendLines = [...new Set(dailyFiles[notePath])];

          let existingContent = "";
          if (existsSync(notePath)) {
            existingContent = readFileSync(notePath, { encoding: "utf8" });
          }

          const baseContent = stripPdplSection(existingContent);

          // Add #+TITLE: only for new files when addTitle is enabled
          let preamble = "";
          if (!existingContent && addTitle) {
            const fileDate = path.basename(notePath, ".org");
            preamble = `#+TITLE: ${fileDate}\n`;
          }

          const sectionHeading = `** ${section} ${PDPL_TAG}`;
          const sectionLines = appendLines.map((line) => `- ${line}`).join("\n");
          const newSection = `${sectionHeading}\n${sectionLines}`;

          const separator = baseContent && !baseContent.endsWith("\n") ? "\n\n" : "\n";
          const newContent =
            preamble +
            (baseContent ? baseContent + separator : "") +
            newSection +
            "\n";

          writeFileSync(notePath, newContent);
        }
      },
    },
  ],
};

export default handler;
