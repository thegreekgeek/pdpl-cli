import { ImportHandler } from "../../utils/types.js";
import { HydratedAssignment, SyllabusDocument } from "./types.js";

////
/// Helpers
//

const parseDayFromEndTime = (endTime: string): string => endTime.split("T")[0];

////
/// Exports
//

const importFiles = [
  {
    getDirName: () => "syllabus-assignments",
    parsingStrategy: (): "yaml" => "yaml",
    transformParsedData: (data: object | []): HydratedAssignment[] => {
      const [doc] = data as [SyllabusDocument];
      const assignments: HydratedAssignment[] = [];

      const {
        courseCode,
        name: courseName,
        courseMode,
        instructor,
        curriculum,
      } = doc;

      for (const [weekKey, week] of Object.entries(curriculum)) {
        const { name: weekName, startDate: weekStartDate, workExample = [] } = week;

        for (const item of workExample) {
          assignments.push({
            courseCode,
            courseName,
            courseMode,
            instructorName: instructor.name,
            instructorEmail: instructor.email,
            weekKey,
            weekName,
            weekStartDate,
            assignmentType: item["@type"],
            assignmentName: item.name,
            endTime: item.endTime,
            day: parseDayFromEndTime(item.endTime),
          });
        }
      }

      return assignments;
    },
    parseDayFromEntity: (entity: object): string => {
      return (entity as HydratedAssignment).day;
    },
  },
];

const importHandler: ImportHandler = {
  importFiles,
};

export default importHandler;
