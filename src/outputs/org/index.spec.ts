import type { Mock } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { Database } from "duckdb-async";
import handler from "./index.js";

////
/// Mocks
//

vi.mock("fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("fs")>()),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock("../../utils/fs.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/fs.js")>()),
  pathAccessible: vi.fn(),
}));

////
/// Helpers
//

const makeDb = (rows: object[]) =>
  ({
    all: vi.fn().mockResolvedValue(rows),
  }) as unknown as Database;

const getStrategy = () =>
  handler.handlers.find((h) => h.name() === "daily_notes_append")!;

////
/// Tests
//

describe("org output handler", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { pathAccessible } = await import("../../utils/fs.js");
    (pathAccessible as Mock).mockReturnValue(true);
  });

  describe("isReady()", () => {
    it("returns false when ORG_DAILY_NOTES_PATH is not set", () => {
      vi.stubEnv("ORG_DAILY_NOTES_PATH", "");
      expect(handler.isReady()).toBe(false);
    });

    it("returns false when path is not accessible", async () => {
      vi.stubEnv("ORG_DAILY_NOTES_PATH", "/some/path");
      const { pathAccessible } = await import("../../utils/fs.js");
      (pathAccessible as Mock).mockReturnValue(false);
      expect(handler.isReady()).toBe(false);
    });

    it("returns true when ORG_DAILY_NOTES_PATH is set and accessible", () => {
      vi.stubEnv("ORG_DAILY_NOTES_PATH", "/org/notes");
      expect(handler.isReady()).toBe(true);
    });
  });

  describe("daily_notes_append strategy", () => {
    beforeEach(() => {
      vi.stubEnv("ORG_DAILY_NOTES_PATH", "/org/notes");
    });

    describe("isReady()", () => {
      it("returns errors when strategyData is missing", () => {
        const errors = getStrategy().isReady({});
        expect(errors).toContain("Missing output data fields: date, template");
      });

      it("returns error when date field is missing", () => {
        const errors = getStrategy().isReady({}, { template: "- {{name}}" } as any);
        expect(errors).toContain("Missing date field");
      });

      it("returns error when template is missing", () => {
        const errors = getStrategy().isReady(
          { event_date: "source.table" },
          { date: "event_date" } as any
        );
        expect(errors).toContain("Missing template");
      });

      it("returns error when date field does not exist in input fields", () => {
        const errors = getStrategy().isReady(
          { other_field: "source.table" },
          { date: "event_date", template: "- {{other_field}}" } as any
        );
        expect(errors).toContain("Date field event_date does not exist in input data.");
      });

      it("returns no errors when date and template are valid", () => {
        const errors = getStrategy().isReady(
          { event_date: "source.table", name: "source.table" },
          { date: "event_date", template: "- {{name}}" } as any
        );
        expect(errors).toHaveLength(0);
      });
    });

    describe("handle()", () => {
      const fields: Record<string, string> = {
        event_date: "source.table",
        name: "source.table",
      };

      it("creates a new file with correct org syntax (add_title default true)", async () => {
        (existsSync as Mock).mockReturnValue(false);
        const db = makeDb([{ event_date: "2024-03-15", name: "Stand-up" }]);

        await getStrategy().handle(db, fields, {
          date: "event_date",
          template: "{{name}}",
          section: "Calendar",
          add_title: true,
          year_folders: false,
        } as any);

        const [filePath, content] = (writeFileSync as Mock).mock.calls[0] as [
          string,
          string,
        ];

        expect(filePath).toContain("2024-03-15.org");
        expect(content).toContain("#+TITLE: 2024-03-15");
        expect(content).toContain("** Calendar :pdpl:");
        expect(content).toContain("- Stand-up");
      });

      it("omits #+TITLE when add_title is false", async () => {
        (existsSync as Mock).mockReturnValue(false);
        const db = makeDb([{ event_date: "2024-03-16", name: "Retro" }]);

        await getStrategy().handle(db, fields, {
          date: "event_date",
          template: "{{name}}",
          add_title: false,
          year_folders: false,
        } as any);

        const [, content] = (writeFileSync as Mock).mock.calls[0] as [string, string];
        expect(content).not.toContain("#+TITLE:");
      });

      it("appends to an existing file and replaces the :pdpl: section", async () => {
        const existingContent =
          "#+TITLE: 2024-03-15\n\n* Morning notes\n\nSome text.\n\n** pdpl :pdpl:\n- Old entry\n";

        (existsSync as Mock).mockReturnValue(true);
        (readFileSync as Mock).mockReturnValue(existingContent);
        const db = makeDb([{ event_date: "2024-03-15", name: "New entry" }]);

        await getStrategy().handle(db, fields, {
          date: "event_date",
          template: "{{name}}",
          year_folders: false,
        } as any);

        const [, content] = (writeFileSync as Mock).mock.calls[0] as [string, string];

        expect(content).toContain("- New entry");
        expect(content).not.toContain("- Old entry");
        expect(content).toContain("* Morning notes");
      });

      it("creates year subdirectories when year_folders is true", async () => {
        (existsSync as Mock).mockReturnValue(false);
        const db = makeDb([{ event_date: "2024-06-01", name: "Event" }]);

        await getStrategy().handle(db, fields, {
          date: "event_date",
          template: "{{name}}",
          year_folders: true,
        } as any);

        const mkdirCall = (mkdirSync as Mock).mock.calls[0] as [string, object];
        expect(mkdirCall[0]).toContain("2024");

        const [filePath] = (writeFileSync as Mock).mock.calls[0] as [string, string];
        expect(filePath).toContain(["2024", "2024-06-01.org"].join("/"));
      });

      it("does not create year subdirectories when year_folders is false", async () => {
        (existsSync as Mock).mockReturnValue(false);
        const db = makeDb([{ event_date: "2024-06-01", name: "Event" }]);

        await getStrategy().handle(db, fields, {
          date: "event_date",
          template: "{{name}}",
          year_folders: false,
        } as any);

        const mkdirCall = (mkdirSync as Mock).mock.calls[0] as [string, object];
        expect(mkdirCall[0]).not.toContain("2024");
      });

      it("deduplicates identical rendered lines", async () => {
        (existsSync as Mock).mockReturnValue(false);
        const db = makeDb([
          { event_date: "2024-03-15", name: "Stand-up" },
          { event_date: "2024-03-15", name: "Stand-up" },
        ]);

        await getStrategy().handle(db, fields, {
          date: "event_date",
          template: "{{name}}",
          year_folders: false,
        } as any);

        const [, content] = (writeFileSync as Mock).mock.calls[0] as [string, string];
        const occurrences = (content.match(/Stand-up/g) || []).length;
        expect(occurrences).toBe(1);
      });
    });
  });
});
