import { AxiosResponse } from "axios";
import { EpChronological, EpSnapshot, ApiHandler } from "../../utils/types.js";

describe("Module: SimpleFIN API handler", () => {
  let simplefinHandler: ApiHandler;
  let parseDayFromTransactionDef: (
    transaction: { posted: number; transacted_at?: number }
  ) => string;

  beforeAll(async () => {
    process.env["SIMPLEFIN_ACCESS_URL"] =
      "https://user123:pass456@bridge.simplefin.org/simplefin";
    const simplefinModule = (await import("./index.js")) as {
      default: ApiHandler;
      parseDayFromTransaction: (
        transaction: { posted: number; transacted_at?: number }
      ) => string;
    };
    simplefinHandler = simplefinModule.default;
    parseDayFromTransactionDef = simplefinModule.parseDayFromTransaction;
  });

  describe("Accounts endpoint", () => {
    let epHandler: EpSnapshot;

    beforeEach(() => {
      epHandler = simplefinHandler.endpointsPrimary.filter((handler) => {
        return handler.getDirName() === "accounts";
      })[0] as EpSnapshot;
    });

    it("uses the correct endpoint", () => {
      expect(epHandler.getEndpoint()).toEqual("accounts");
    });

    it("gets the correct params", () => {
      expect(epHandler.getParams!()).toEqual({ "balances-only": 1, version: 2 });
    });

    it("transforms a response to an accounts array", () => {
      const mockResponse = {
        data: {
          errlist: [],
          connections: [],
          accounts: [
            {
              id: "2930002",
              name: "Savings",
              conn_id: "CON-123",
              currency: "USD",
              balance: "100.23",
              "balance-date": 978366153,
              transactions: [],
            },
          ],
        },
      } as AxiosResponse;

      expect(epHandler.transformResponseData!(mockResponse)).toEqual([
        {
          id: "2930002",
          name: "Savings",
          conn_id: "CON-123",
          currency: "USD",
          balance: "100.23",
          "balance-date": 978366153,
          transactions: [],
        },
      ]);
    });

    it("returns an empty array when accounts are missing", () => {
      const mockResponse = {
        data: { errlist: [], connections: [], accounts: [] },
      } as AxiosResponse;
      expect(epHandler.transformResponseData!(mockResponse)).toEqual([]);
    });

    it("logs errors from errlist if present", () => {
      const consoleWarnMock = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockResponse = {
        data: {
          errlist: [
            { code: "con.auth", msg: "Authentication required" },
            { code: "gen.err", msg: "<strong>Bad error</strong>" }
          ],
          connections: [],
          accounts: [],
        },
      } as unknown as AxiosResponse;
      epHandler.transformResponseData!(mockResponse);
      expect(consoleWarnMock).toHaveBeenCalledWith(
        expect.stringContaining("⚠️ SimpleFIN returned error: [con.auth] Authentication required")
      );
      expect(consoleWarnMock).toHaveBeenCalledWith(
        expect.stringContaining("⚠️ SimpleFIN returned error: [gen.err] &lt;strong&gt;Bad error&lt;/strong&gt;")
      );
      consoleWarnMock.mockRestore();
    });
  });

  describe("Transactions endpoint", () => {
    let epHandler: EpChronological;

    beforeEach(() => {
      epHandler = simplefinHandler.endpointsPrimary.filter((handler) => {
        return handler.getDirName() === "accounts--transactions";
      })[0] as EpChronological;
    });

    it("uses the correct endpoint", () => {
      expect(epHandler.getEndpoint()).toEqual("accounts");
    });

    it("gets default params with a start-date within the last week", () => {
      const params = epHandler.getParams!() as {
        "start-date": number;
        "end-date": number;
        version: number;
        pending: number;
      };
      expect(params.version).toEqual(2);
      expect(params.pending).toEqual(1);
      expect(params["end-date"]).toBeGreaterThan(params["start-date"]);
      const sevenDays = 7 * 24 * 60 * 60;
      expect(params["end-date"] - params["start-date"]).toBeLessThanOrEqual(
        sevenDays + 5
      );
    });

    it("gets the default historic params (no existing params)", () => {
      const params = epHandler.getHistoricParams() as {
        "start-date": number;
        "end-date": number;
        version: number;
        pending: number;
      };
      expect(params.version).toEqual(2);
      expect(params.pending).toEqual(1);
      const ninetyDays = 90 * 24 * 60 * 60;
      expect(params["end-date"] - params["start-date"]).toBeCloseTo(ninetyDays, -2);
    });

    it("steps back 90 days when given existing historic params", () => {
      const existingParams = {
        "start-date": 1700000000,
        "end-date": 1707776000,
        version: 2,
        pending: 1,
      };
      const nextParams = epHandler.getHistoricParams(existingParams) as {
        "start-date": number;
        "end-date": number;
      };
      expect(nextParams["end-date"]).toEqual(1700000000);
      const ninetyDays = 90 * 24 * 60 * 60;
      expect(nextParams["start-date"]).toEqual(1700000000 - ninetyDays);
    });

    it("flattens transactions from all accounts and annotates account_id", () => {
      const mockResponse = {
        data: {
          errlist: [],
          connections: [],
          accounts: [
            {
              id: "ACC-1",
              name: "Checking",
              conn_id: "CON-123",
              currency: "USD",
              balance: "200.00",
              "balance-date": 978366153,
              transactions: [
                {
                  id: "TX-1",
                  posted: 978360000,
                  amount: "-10.00",
                  description: "Coffee",
                },
              ],
            },
            {
              id: "ACC-2",
              name: "Savings",
              conn_id: "CON-123",
              currency: "USD",
              balance: "1000.00",
              "balance-date": 978366153,
              transactions: [
                {
                  id: "TX-2",
                  posted: 978361000,
                  amount: "50.00",
                  description: "Deposit",
                },
              ],
            },
          ],
        },
      } as AxiosResponse;

      expect(epHandler.transformResponseData!(mockResponse)).toEqual([
        {
          id: "TX-1",
          posted: 978360000,
          amount: "-10.00",
          description: "Coffee",
          account_id: "ACC-1",
        },
        {
          id: "TX-2",
          posted: 978361000,
          amount: "50.00",
          description: "Deposit",
          account_id: "ACC-2",
        },
      ]);
    });

    it("appends to existing transaction data", () => {
      const existing = [
        {
          id: "TX-0",
          posted: 978359000,
          amount: "-5.00",
          description: "Prior",
          account_id: "ACC-1",
        },
      ];
      const mockResponse = {
        data: {
          errlist: [],
          connections: [],
          accounts: [
            {
              id: "ACC-1",
              name: "Checking",
              conn_id: "CON-123",
              currency: "USD",
              balance: "200.00",
              "balance-date": 978366153,
              transactions: [
                {
                  id: "TX-1",
                  posted: 978360000,
                  amount: "-10.00",
                  description: "Coffee",
                },
              ],
            },
          ],
        },
      } as AxiosResponse;

      const result = epHandler.transformResponseData!(mockResponse, existing) as object[];
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: "TX-0" });
      expect(result[1]).toMatchObject({ id: "TX-1" });
    });
  });

  describe("parseDayFromTransaction", () => {
    it("returns the correct date from a posted timestamp", () => {
      // 978366153 = 2001-01-01 18:02:33 UTC
      expect(parseDayFromTransactionDef({ posted: 978366153 })).toEqual("2001-01-01");
    });

    it("falls back to transacted_at when posted is 0 (pending)", () => {
      // 793090572 = 1995-02-18 ~06:55 UTC
      expect(
        parseDayFromTransactionDef({ posted: 0, transacted_at: 793090572 })
      ).toEqual("1995-02-18");
    });

    it("returns epoch date when both timestamps are 0", () => {
      expect(parseDayFromTransactionDef({ posted: 0 })).toEqual("1970-01-01");
    });
  });

  describe("Error and Edge Case handling", () => {
    it("handles 403 API errors", () => {
      const consoleLogMock = vi.spyOn(console, 'log').mockImplementation(() => {});
      const epHandler = simplefinHandler.endpointsPrimary[0];
      const mockError = { response: { status: 403 } };
      epHandler.handleApiError!(mockError as any);
      expect(consoleLogMock).toHaveBeenCalledWith(
        expect.stringContaining("❌ SimpleFIN returned 403: access has been revoked")
      );
      consoleLogMock.mockRestore();
    });

    it("handles 402 API errors", () => {
      const consoleLogMock = vi.spyOn(console, 'log').mockImplementation(() => {});
      const epHandler = simplefinHandler.endpointsPrimary[0];
      const mockError = { response: { status: 402 } };
      epHandler.handleApiError!(mockError as any);
      expect(consoleLogMock).toHaveBeenCalledWith(
        expect.stringContaining("❌ SimpleFIN returned 402: Payment required.")
      );
      consoleLogMock.mockRestore();
    });

    it("fails cleanly if HTTP is used instead of HTTPS", async () => {
      // getApiBaseUrl uses SIMPLEFIN_ACCESS_URL from module scope, which is set at load.
      // So, to test it, we have to stub out or call parseAccessUrl directly if we can't alter process.env post-import
      // Since it's imported, we can mock process.env on a re-import or test a different way.
      // Because SIMPLEFIN_ACCESS_URL was captured at load in index.ts, changing process.env here won't affect it.
      // Let's test the `getApiAuthHeaders` or `getApiBaseUrl` by resetting the module cache and loading it.
      vi.resetModules();
      process.env["SIMPLEFIN_ACCESS_URL"] = "http://user123:pass456@bridge.simplefin.org/simplefin";
      const simplefinModuleWithHttp = (await import("./index.js")).default;

      const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        simplefinModuleWithHttp.getApiBaseUrl();
      }).toThrowError("SimpleFIN Access URL must use HTTPS.");

      expect(consoleErrorMock).toHaveBeenCalledWith(
        expect.stringContaining("❌ SimpleFIN error: Access URL must use HTTPS.")
      );

      consoleErrorMock.mockRestore();
      // Reset after test
      process.env["SIMPLEFIN_ACCESS_URL"] = "https://user123:pass456@bridge.simplefin.org/simplefin";
      vi.resetModules();
    });
  });
});
