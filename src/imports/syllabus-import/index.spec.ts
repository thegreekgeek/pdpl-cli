import { ImportFileHandler, ImportHandler } from "../../utils/types.js";
import { HydratedAssignment, SyllabusDocument } from "./types.js";

const { default: importHandler } = (await import(`./index.js`)) as {
  default: ImportHandler;
};

////
/// Fixtures
//

const mockSyllabus: SyllabusDocument = {
  "@context": "https://schema.org",
  "@type": "CourseInstance",
  courseCode: "MATH 1113-81",
  name: "Pre-Calculus",
  courseMode: "online",
  educationalCredentialAwarded: "3 Credits",
  instructor: {
    "@type": "Person",
    name: "Dr. Paul Seifert",
    email: "paul.seifert@mnwest.edu",
  },
  eventSchedule: [
    {
      "@type": "Schedule",
      byDay: "Tuesday",
      startTime: "23:59",
      description: "Weekly Homework and Test Deadline",
    },
  ],
  curriculum: {
    w01: {
      "@type": "CreativeWork",
      name: "Chapter 1",
      startDate: "2026-01-12",
      educationalUse: [
        {
          "@type": "CreativeWork",
          name: "Sections 1.1 - 1.4",
          author: "Rockswold",
        },
      ],
      workExample: [
        { "@type": "ExercisePlan", name: "Section 1.1 Homework", endTime: "2026-01-20T23:59" },
        { "@type": "ExercisePlan", name: "Section 1.2 Homework", endTime: "2026-01-20T23:59" },
        { "@type": "ExercisePlan", name: "Section 1.3 Homework", endTime: "2026-01-20T23:59" },
        { "@type": "ExercisePlan", name: "Section 1.4 Homework", endTime: "2026-01-20T23:59" },
      ],
    },
    w02: {
      "@type": "CreativeWork",
      name: "Chapter 2",
      startDate: "2026-01-21",
      workExample: [
        { "@type": "ExercisePlan", name: "Section 2.1 Homework", endTime: "2026-01-27T23:59" },
        { "@type": "ExercisePlan", name: "Section 2.2 Homework", endTime: "2026-01-27T23:59" },
        { "@type": "Assessment", name: "Chapter 1-2 Test", endTime: "2026-01-27T23:59" },
      ],
    },
    w03: {
      "@type": "CreativeWork",
      name: "Chapter 3 (no work examples)",
      startDate: "2026-01-28",
    },
  },
};

////
/// Tests
//

describe("Module: Syllabus import handler", () => {
  describe("Import File: syllabus-assignments", () => {
    let fileHandler: ImportFileHandler;
    beforeEach(() => {
      fileHandler = importHandler.importFiles
        .filter((handler) => handler.getDirName() === "syllabus-assignments")
        .at(0)!;
    });

    it("saves to the correct directory", () => {
      expect(fileHandler.getDirName()).toEqual("syllabus-assignments");
    });

    it("uses yaml parsing strategy", () => {
      expect(fileHandler.parsingStrategy()).toEqual("yaml");
    });

    describe("transformParsedData", () => {
      let assignments: HydratedAssignment[];
      beforeEach(() => {
        assignments = fileHandler.transformParsedData!([mockSyllabus]) as HydratedAssignment[];
      });

      it("produces one entity per workExample item, skipping weeks with no workExample", () => {
        // w01 has 4, w02 has 3, w03 has none → total 7
        expect(assignments).toHaveLength(7);
      });

      it("enriches each assignment with top-level course metadata", () => {
        const first = assignments[0];
        expect(first.courseCode).toEqual("MATH 1113-81");
        expect(first.courseName).toEqual("Pre-Calculus");
        expect(first.courseMode).toEqual("online");
        expect(first.instructorName).toEqual("Dr. Paul Seifert");
        expect(first.instructorEmail).toEqual("paul.seifert@mnwest.edu");
      });

      it("enriches each assignment with week-level metadata", () => {
        const first = assignments[0];
        expect(first.weekKey).toEqual("w01");
        expect(first.weekName).toEqual("Chapter 1");
        expect(first.weekStartDate).toEqual("2026-01-12");
      });

      it("enriches each assignment with workExample item data", () => {
        const first = assignments[0];
        expect(first.assignmentType).toEqual("ExercisePlan");
        expect(first.assignmentName).toEqual("Section 1.1 Homework");
        expect(first.endTime).toEqual("2026-01-20T23:59");
      });

      it("derives the day field from the endTime", () => {
        expect(assignments[0].day).toEqual("2026-01-20");
      });

      it("correctly maps non-ExercisePlan assignment types", () => {
        const test = assignments.find((a) => a.assignmentName === "Chapter 1-2 Test")!;
        expect(test.assignmentType).toEqual("Assessment");
        expect(test.weekKey).toEqual("w02");
      });

      it("handles weeks without workExample (no entities emitted)", () => {
        const w03Assignments = assignments.filter((a) => a.weekKey === "w03");
        expect(w03Assignments).toHaveLength(0);
      });

      it("handles weeks without educationalUse gracefully", () => {
        const w02Assignments = assignments.filter((a) => a.weekKey === "w02");
        expect(w02Assignments).toHaveLength(3);
      });
    });

    describe("parseDayFromEntity", () => {
      it("extracts the YYYY-MM-DD date from an endTime with a time component", () => {
        const entity: HydratedAssignment = {
          courseCode: "MATH 1113-81",
          courseName: "Pre-Calculus",
          courseMode: "online",
          instructorName: "Dr. Paul Seifert",
          instructorEmail: "paul.seifert@mnwest.edu",
          weekKey: "w01",
          weekName: "Chapter 1",
          weekStartDate: "2026-01-12",
          assignmentType: "ExercisePlan",
          assignmentName: "Section 1.1 Homework",
          endTime: "2026-01-20T23:59",
          day: "2026-01-20",
        };
        expect(fileHandler.parseDayFromEntity!(entity)).toEqual("2026-01-20");
      });
    });
  });
});
