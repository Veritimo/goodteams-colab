/**
 * SOQL Client Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SalesforceConnector, SalesforceConnectorError } from "../salesforce-connector.js";
import {
  SoqlClient,
  createSoqlClient,
  escapeSoqlString,
  buildInClause,
  buildDateLiteral,
  buildDateTimeLiteral,
  QUERY_BATCH_SIZE,
  MAX_QUERY_RECORDS,
} from "../soql-client.js";

// Mock the connector
vi.mock("../salesforce-connector.js", async () => {
  const actual = await vi.importActual<typeof import("../salesforce-connector.js")>(
    "../salesforce-connector.js",
  );
  return {
    ...actual,
    SalesforceConnector: vi.fn(),
  };
});

describe("SoqlClient", () => {
  let mockConnection: {
    query: ReturnType<typeof vi.fn>;
    queryAll: ReturnType<typeof vi.fn>;
    queryMore: ReturnType<typeof vi.fn>;
    request: ReturnType<typeof vi.fn>;
    version: string;
  };
  let mockConnector: { getConnection: ReturnType<typeof vi.fn> };
  let client: SoqlClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConnection = {
      query: vi.fn(),
      queryAll: vi.fn(),
      queryMore: vi.fn(),
      request: vi.fn(),
      version: "59.0",
    };

    mockConnector = {
      getConnection: vi.fn().mockResolvedValue(mockConnection),
    };

    client = new SoqlClient(mockConnector as unknown as SalesforceConnector);
  });

  describe("executeQuery", () => {
    it("should execute simple query", async () => {
      mockConnection.query.mockResolvedValue({
        totalSize: 2,
        done: true,
        records: [
          { Id: "001", Name: "Account 1" },
          { Id: "002", Name: "Account 2" },
        ],
      });

      const result = await client.executeQuery("SELECT Id, Name FROM Account");

      expect(result.totalSize).toBe(2);
      expect(result.done).toBe(true);
      expect(result.records).toHaveLength(2);
      expect(mockConnection.query).toHaveBeenCalledWith("SELECT Id, Name FROM Account");
    });

    it("should return nextRecordsUrl when not done", async () => {
      mockConnection.query.mockResolvedValue({
        totalSize: 5000,
        done: false,
        records: Array(2000).fill({ Id: "001", Name: "Account" }),
        nextRecordsUrl: "/services/data/v59.0/query/01gxx00000001-2000",
      });

      const result = await client.executeQuery("SELECT Id, Name FROM Account");

      expect(result.done).toBe(false);
      expect(result.nextRecordsUrl).toBeDefined();
    });

    it("should throw error for invalid SOQL (no SELECT)", async () => {
      await expect(client.executeQuery("FROM Account")).rejects.toThrow(SalesforceConnectorError);
    });

    it("should throw error for invalid SOQL (no FROM)", async () => {
      await expect(client.executeQuery("SELECT Id")).rejects.toThrow(SalesforceConnectorError);
    });

    it("should throw error for empty query", async () => {
      await expect(client.executeQuery("")).rejects.toThrow(SalesforceConnectorError);
    });

    it("should throw error for dangerous patterns", async () => {
      await expect(
        client.executeQuery("SELECT Id FROM Account; DROP TABLE Account"),
      ).rejects.toThrow(SalesforceConnectorError);
    });

    it("should handle query errors", async () => {
      mockConnection.query.mockRejectedValue({
        errorCode: "INVALID_FIELD",
        message: "Field InvalidField does not exist",
      });

      await expect(client.executeQuery("SELECT InvalidField FROM Account")).rejects.toThrow(
        SalesforceConnectorError,
      );
    });
  });

  describe("executeQueryAll", () => {
    it("should fetch all records when done in first batch", async () => {
      mockConnection.query.mockResolvedValue({
        totalSize: 100,
        done: true,
        records: Array(100).fill({ Id: "001" }),
      });

      const result = await client.executeQueryAll("SELECT Id FROM Account");

      expect(result.records).toHaveLength(100);
      expect(result.done).toBe(true);
    });

    it("should auto-paginate for large results", async () => {
      // First batch
      mockConnection.query.mockResolvedValueOnce({
        totalSize: 4000,
        done: false,
        records: Array(2000).fill({ Id: "001" }),
        nextRecordsUrl: "/services/data/v59.0/query/01gxx-2000",
      });

      // Second batch
      mockConnection.queryMore.mockResolvedValueOnce({
        totalSize: 4000,
        done: true,
        records: Array(2000).fill({ Id: "002" }),
      });

      const result = await client.executeQueryAll("SELECT Id FROM Account");

      expect(result.records).toHaveLength(4000);
      expect(mockConnection.queryMore).toHaveBeenCalled();
    });

    it("should respect maxRecords limit", async () => {
      mockConnection.query.mockResolvedValue({
        totalSize: 100000,
        done: false,
        records: Array(2000).fill({ Id: "001" }),
        nextRecordsUrl: "/services/data/v59.0/query/01gxx-2000",
      });

      const result = await client.executeQueryAll("SELECT Id FROM Account", {
        maxRecords: 1000,
      });

      expect(result.records.length).toBeLessThanOrEqual(2000);
    });
  });

  describe("executeQueryWithDeleted", () => {
    it("should use queryAll for deleted records", async () => {
      mockConnection.queryAll.mockResolvedValue({
        totalSize: 5,
        done: true,
        records: [{ Id: "001", IsDeleted: true }],
      });

      await client.executeQueryWithDeleted("SELECT Id FROM Account");

      expect(mockConnection.queryAll).toHaveBeenCalled();
    });
  });

  describe("executeCountQuery", () => {
    it("should execute count query", async () => {
      mockConnection.query.mockResolvedValue({
        totalSize: 1500,
        done: true,
        records: [],
      });

      const count = await client.executeCountQuery(
        "SELECT COUNT(Id) FROM Account WHERE Industry = 'Technology'",
      );

      expect(count).toBe(1500);
    });

    it("should transform regular query to count query", async () => {
      mockConnection.query.mockResolvedValue({
        totalSize: 500,
        done: true,
        records: [],
      });

      const count = await client.executeCountQuery("SELECT Id, Name FROM Account");

      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining("COUNT(Id)"));
    });
  });

  describe("streamQuery", () => {
    it("should stream records through callback", async () => {
      mockConnection.query.mockResolvedValue({
        totalSize: 3,
        done: true,
        records: [{ Id: "001" }, { Id: "002" }, { Id: "003" }],
      });

      const processedRecords: unknown[] = [];
      const result = await client.streamQuery("SELECT Id FROM Account", (record) => {
        processedRecords.push(record);
      });

      expect(result.totalProcessed).toBe(3);
      expect(processedRecords).toHaveLength(3);
    });

    it("should respect maxRecords in streaming", async () => {
      mockConnection.query.mockResolvedValue({
        totalSize: 100,
        done: true,
        records: Array(100).fill({ Id: "001" }),
      });

      const result = await client.streamQuery("SELECT Id FROM Account", () => {}, {
        maxRecords: 50,
      });

      expect(result.totalProcessed).toBe(50);
    });
  });

  describe("explainQuery", () => {
    it("should return query plan", async () => {
      mockConnection.request.mockResolvedValue({
        plans: [
          {
            cardinality: 1000,
            fields: ["Id", "Name"],
            leadingOperationType: "TableScan",
            relativeCost: 1.5,
            sobjectCardinality: 10000,
            sobjectType: "Account",
            notes: [],
          },
        ],
      });

      const plan = await client.explainQuery("SELECT Id FROM Account");

      expect(plan.cardinality).toBe(1000);
      expect(plan.sobjectType).toBe("Account");
    });
  });
});

describe("Utility Functions", () => {
  describe("escapeSoqlString", () => {
    it("should escape single quotes", () => {
      expect(escapeSoqlString("O'Brien")).toBe("O\\'Brien");
    });

    it("should escape backslashes", () => {
      expect(escapeSoqlString("path\\to\\file")).toBe("path\\\\to\\\\file");
    });

    it("should handle strings without special chars", () => {
      expect(escapeSoqlString("Normal String")).toBe("Normal String");
    });

    it("should handle strings with both quotes and backslashes", () => {
      // This tests that backslashes are escaped FIRST, then quotes
      // Otherwise `\'` becomes `\\'` which is wrong
      expect(escapeSoqlString("O'Brien\\path")).toBe("O\\'Brien\\\\path");
    });
  });

  describe("buildInClause", () => {
    it("should build IN clause for multiple values", () => {
      const clause = buildInClause("Industry", ["Tech", "Finance"]);
      expect(clause).toBe("Industry IN ('Tech', 'Finance')");
    });

    it("should escape values with quotes", () => {
      const clause = buildInClause("Name", ["O'Brien"]);
      expect(clause).toBe("Name IN ('O\\'Brien')");
    });

    it("should return FALSE for empty array", () => {
      expect(buildInClause("Field", [])).toBe("FALSE");
    });
  });

  describe("buildDateLiteral", () => {
    it("should format date correctly", () => {
      const date = new Date("2024-03-15T10:30:00Z");
      expect(buildDateLiteral(date)).toBe("2024-03-15");
    });
  });

  describe("buildDateTimeLiteral", () => {
    it("should format datetime in ISO format", () => {
      const date = new Date("2024-03-15T10:30:00.000Z");
      expect(buildDateTimeLiteral(date)).toBe("2024-03-15T10:30:00.000Z");
    });
  });
});

describe("Constants", () => {
  it("should export QUERY_BATCH_SIZE as 2000", () => {
    expect(QUERY_BATCH_SIZE).toBe(2000);
  });

  it("should export MAX_QUERY_RECORDS as 50000", () => {
    expect(MAX_QUERY_RECORDS).toBe(50000);
  });
});

describe("createSoqlClient", () => {
  it("should create SoqlClient from connector", () => {
    const mockConnector = {} as SalesforceConnector;
    const client = createSoqlClient(mockConnector);
    expect(client).toBeInstanceOf(SoqlClient);
  });
});
