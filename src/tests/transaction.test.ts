import request from "supertest";
import express from "express";
import bodyParser from "body-parser";
import transactionRoute from "../routes/transaction";
import { connectDB, disconnectDB } from "../config/database";
import TransactionModel from "../models/transaction";
import { convertToUSD } from "../utils/convertToUsd";
import {
  startTransactionGenerator,
  stopTransactionGenerator,
} from "../cron/transactionGenerator";
import passport from "passport";

const app = express();
app.use(bodyParser.json());
app.use("/transaction", transactionRoute);

jest.mock("../utils/convertToUsd");

jest.mock("../cron/transactionGenerator", () => ({
  startTransactionGenerator: jest.fn(),
  stopTransactionGenerator: jest.fn(),
}));

jest.mock("passport", () => {
  const originalModule = jest.requireActual("passport");
  return {
    ...originalModule,
    authenticate: jest.fn((strategy, options) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (strategy === "jwt") {
        req.user = { id: "testUserId" }; 
        return next();
      }
      if (strategy === "google") {
        req.user = { id: "testUserId" }; 
        return next();
      }
      return next();
    }),
  };
});

beforeAll(async () => {
  await connectDB();
  // Seed the database with some transactions
  await TransactionModel.create([
    {
      type: "DEPOSIT",
      transactionId: "txn12345",
      timestamp: Date.now() - 1000 * 60 * 60 * 12, // 12 hours ago
      originUserId: "user1",
      destinationUserId: "user2",
      transactionState: "SUCCESSFUL",
      originAmountDetails: {
        transactionAmount: 100,
        transactionCurrency: "USD",
        country: "US",
      },
      destinationAmountDetails: {
        transactionAmount: 100,
        transactionCurrency: "USD",
        country: "US",
      },
      promotionCodeUsed: false,
      reference: "Test transaction",
      originDeviceData: {
        batteryLevel: 100,
        deviceLatitude: 37.7749,
        deviceLongitude: -122.4194,
        ipAddress: "127.0.0.1",
        deviceIdentifier: "device1",
        vpnUsed: false,
        operatingSystem: "iOS",
        deviceMaker: "Apple",
        deviceModel: "iPhone 12",
        deviceYear: "2020",
        appVersion: "1.0.0",
      },
      destinationDeviceData: {
        batteryLevel: 100,
        deviceLatitude: 37.7749,
        deviceLongitude: -122.4194,
        ipAddress: "127.0.0.1",
        deviceIdentifier: "device2",
        vpnUsed: false,
        operatingSystem: "iOS",
        deviceMaker: "Apple",
        deviceModel: "iPhone 12",
        deviceYear: "2020",
        appVersion: "1.0.0",
      },
      tags: [{ key: "test", value: "true" }],
      description: "Test transaction",
    },
    {
      type: "WITHDRAWAL",
      transactionId: "txn12346",
      timestamp: Date.now() - 1000 * 60 * 60 * 6, // 6 hours ago
      originUserId: "user3",
      destinationUserId: "user4",
      transactionState: "DECLINED",
      originAmountDetails: {
        transactionAmount: 200,
        transactionCurrency: "USD",
        country: "US",
      },
      destinationAmountDetails: {
        transactionAmount: 200,
        transactionCurrency: "USD",
        country: "US",
      },
      promotionCodeUsed: false,
      reference: "Another test transaction",
      originDeviceData: {
        batteryLevel: 100,
        deviceLatitude: 37.7749,
        deviceLongitude: -122.4194,
        ipAddress: "127.0.0.1",
        deviceIdentifier: "device3",
        vpnUsed: false,
        operatingSystem: "iOS",
        deviceMaker: "Apple",
        deviceModel: "iPhone 12",
        deviceYear: "2020",
        appVersion: "1.0.0",
      },
      destinationDeviceData: {
        batteryLevel: 100,
        deviceLatitude: 37.7749,
        deviceLongitude: -122.4194,
        ipAddress: "127.0.0.1",
        deviceIdentifier: "device4",
        vpnUsed: false,
        operatingSystem: "iOS",
        deviceMaker: "Apple",
        deviceModel: "iPhone 12",
        deviceYear: "2020",
        appVersion: "1.0.0",
      },
      tags: [{ key: "sample", value: "true" }],
      description: "Another test transaction",
    },
  ]);
}, 30000); // Increase timeout to 30 seconds

afterAll(async () => {
  await TransactionModel.deleteMany({});
  await disconnectDB();
}, 30000); // Increase timeout to 30 seconds

describe("POST /transaction/", () => {
  it("should create a new transaction", async () => {
    const newTransaction = {
      type: "DEPOSIT",
      transactionId: "txn12347",
      timestamp: Date.now(),
      originUserId: "user5",
      destinationUserId: "user6",
      transactionState: "CREATED",
      originAmountDetails: {
        transactionAmount: 150,
        transactionCurrency: "USD",
        country: "US",
      },
      destinationAmountDetails: {
        transactionAmount: 150,
        transactionCurrency: "USD",
        country: "US",
      },
      promotionCodeUsed: false,
      reference: "Test transaction 2",
      originDeviceData: {
        batteryLevel: 100,
        deviceLatitude: 37.7749,
        deviceLongitude: -122.4194,
        ipAddress: "127.0.0.1",
        deviceIdentifier: "device5",
        vpnUsed: false,
        operatingSystem: "iOS",
        deviceMaker: "Apple",
        deviceModel: "iPhone 12",
        deviceYear: "2020",
        appVersion: "1.0.0",
      },
      destinationDeviceData: {
        batteryLevel: 100,
        deviceLatitude: 37.7749,
        deviceLongitude: -122.4194,
        ipAddress: "127.0.0.1",
        deviceIdentifier: "device6",
        vpnUsed: false,
        operatingSystem: "iOS",
        deviceMaker: "Apple",
        deviceModel: "iPhone 12",
        deviceYear: "2020",
        appVersion: "1.0.0",
      },
      tags: [{ key: "test2", value: "true" }],
      description: "Test transaction 2",
    };

    const response = await request(app)
      .post("/transaction/")
      .send(newTransaction);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("transactionId");
    expect(response.body.transactionId).toBe(newTransaction.transactionId);
  });
});

describe("GET /transaction/tags", () => {
  it("should return all tags", async () => {
    const response = await request(app).get("/transaction/tags");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.arrayContaining(["test", "sample"]));
  });
});

describe("GET /transaction/amount-range", () => {
  it("should return the max and min transaction amounts", async () => {
    const response = await request(app).get("/transaction/amount-range");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("maxAmount", 200);
    expect(response.body).toHaveProperty("minAmount", 100);
  });
});

describe("GET /transaction/user-id-list", () => {
  it("should return all unique user IDs", async () => {
    const response = await request(app).get("/transaction/user-id-list");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining(["user1", "user2", "user3", "user4"])
    );
  });
});

describe("GET /transaction/graph-data", () => {
  it("should return graph data for the last 24 hours", async () => {
    (convertToUSD as jest.Mock).mockImplementation((amount, currency) => {
      return Promise.resolve(amount); // Mock conversion to USD as 1:1 for simplicity
    });

    const response = await request(app).get("/transaction/graph-data");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("graphData");
    expect(response.body).toHaveProperty("minAmount");
    expect(response.body).toHaveProperty("maxAmount");

    const { graphData, minAmount, maxAmount } = response.body;

    expect(Array.isArray(graphData)).toBe(true);
    expect(typeof minAmount).toBe("number");
    expect(typeof maxAmount).toBe("number");

    // Check that graphData contains objects with timestamp and amount properties
    graphData.forEach((dataPoint: any) => {
      expect(dataPoint).toHaveProperty("timestamp");
      expect(dataPoint).toHaveProperty("amount");
    });
  });
});

describe("GET /transaction/aggregate-data", () => {
  it("should return aggregated data for the last 24 hours", async () => {
    (convertToUSD as jest.Mock).mockImplementation((amount, currency) => {
      return Promise.resolve(amount); // Mock conversion to USD as 1:1 for simplicity
    });

    const response = await request(app).get("/transaction/aggregate-data");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("totalAmountInUSD");
    expect(response.body).toHaveProperty("successfulCount");
    expect(response.body).toHaveProperty("declinedCount");

    const { totalAmountInUSD, successfulCount, declinedCount } = response.body;

    expect(typeof totalAmountInUSD).toBe("number");
    expect(typeof successfulCount).toBe("number");
    expect(typeof declinedCount).toBe("number");

    // Check that the values are as expected
    expect(totalAmountInUSD).toBeGreaterThan(0);
    expect(successfulCount).toBeGreaterThan(0);
    expect(declinedCount).toBeGreaterThan(0);
  });
});

describe("GET /transaction/:id", () => {
  it("should return the transaction with the given ID", async () => {
    const response = await request(app).get("/transaction/txn12345");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("transactionId", "txn12345");
    expect(response.body).toHaveProperty("type", "DEPOSIT");
    expect(response.body).toHaveProperty("originUserId", "user1");
    expect(response.body).toHaveProperty("destinationUserId", "user2");
  });

  it("should return 404 if the transaction is not found", async () => {
    const response = await request(app).get("/transaction/nonexistent");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("error", "Transaction not found");
  });
});

describe("GET /transaction", () => {
  it("should return transactions based on query parameters", async () => {
    const response = await request(app)
      .get("/transaction")
      .query({
        amountGte: 50,
        amountLte: 150,
        startDate: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        endDate: new Date().toISOString(),
        description: "Test",
        type: "DEPOSIT",
        state: "SUCCESSFUL",
        tags: "test",
        currency: "USD",
        originUserId: "user1",
        destinationUserId: "user2",
        searchTerm: "txn12345",
        page: 1,
        limit: 10,
        sortBy: "timestamp",
        sortOrder: "asc",
      });

    if (response.status !== 200) {
      console.error("Response body:", response.body);
    }

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("metadata");
    expect(response.body.metadata).toHaveProperty("totalTransactions");
    expect(response.body.metadata).toHaveProperty("totalPages");
    expect(response.body.metadata).toHaveProperty("currentPage", 1);
    expect(response.body.metadata).toHaveProperty("pageSize", 10);
    expect(response.body).toHaveProperty("transactions");
    expect(response.body.transactions.length).toBeGreaterThan(0);
    expect(response.body.transactions[0]).toHaveProperty(
      "transactionId",
      "txn12345"
    );
  });

  it("should return an empty array if no transactions match the query", async () => {
    const response = await request(app)
      .get("/transaction")
      .query({
        amountGte: 1000,
        amountLte: 2000,
        startDate: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        endDate: new Date().toISOString(),
        description: "Nonexistent",
        type: "NONEXISTENT",
        state: "NONEXISTENT",
        tags: "nonexistent",
        currency: "NONEXISTENT",
        originUserId: "nonexistent",
        destinationUserId: "nonexistent",
        searchTerm: "nonexistent",
        page: 1,
        limit: 10,
        sortBy: "timestamp",
        sortOrder: "asc",
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("metadata");
    expect(response.body.metadata).toHaveProperty("totalTransactions", 0);
    expect(response.body.metadata).toHaveProperty("totalPages", 0);
    expect(response.body.metadata).toHaveProperty("currentPage", 1);
    expect(response.body.metadata).toHaveProperty("pageSize", 10);
    expect(response.body).toHaveProperty("transactions");
    expect(response.body.transactions.length).toBe(0);
  });
});

describe("POST /transaction/generator", () => {
  it("should start the transaction generator", async () => {
    const response = await request(app)
      .post("/transaction/generator")
      .send({ action: "start" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty(
      "message",
      "Transaction generator started"
    );
    expect(startTransactionGenerator).toHaveBeenCalled();
  });

  it("should stop the transaction generator", async () => {
    const response = await request(app)
      .post("/transaction/generator")
      .send({ action: "stop" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty(
      "message",
      "Transaction generator stopped"
    );
    expect(stopTransactionGenerator).toHaveBeenCalled();
  });

  it("should return 400 for an invalid action", async () => {
    const response = await request(app)
      .post("/transaction/generator")
      .send({ action: "invalid" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error", "Invalid action");
  });
});
