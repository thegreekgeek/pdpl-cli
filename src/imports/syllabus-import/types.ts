////
/// Schema.org-mapped types for the structured syllabus YAML document
//

export interface InstructorPerson {
  "@type": "Person";
  name: string;
  email: string;
}

export interface EventSchedule {
  "@type": "Schedule";
  byDay: string;
  startTime: string;
  description: string;
}

export interface EducationalUseItem {
  "@type": "CreativeWork";
  name: string;
  author?: string;
}

export interface WorkExampleItem {
  "@type": "ExercisePlan" | "Assessment" | "Comment";
  name: string;
  endTime: string;
}

export interface CurriculumWeek {
  "@type": "CreativeWork";
  name: string;
  startDate: string;
  educationalUse?: EducationalUseItem[];
  workExample?: WorkExampleItem[];
}

export interface SyllabusDocument {
  "@context": string;
  "@type": "CourseInstance";
  courseCode: string;
  name: string;
  instructor: InstructorPerson;
  courseMode: string;
  educationalCredentialAwarded: string;
  eventSchedule?: EventSchedule[];
  curriculum: Record<string, CurriculumWeek>;
}

////
/// Flattened output entity
//

export interface HydratedAssignment {
  courseCode: string;
  courseName: string;
  courseMode: string;
  instructorName: string;
  instructorEmail: string;
  weekKey: string;
  weekName: string;
  weekStartDate: string;
  assignmentType: string;
  assignmentName: string;
  endTime: string;
  day: string;
}
