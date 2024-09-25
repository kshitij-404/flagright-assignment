import { Request, Response } from "express";
import puppeteer from "puppeteer";
import TransactionModel from "../models/transaction";
import {
  startTransactionGenerator,
  stopTransactionGenerator,
} from "../cron/transactionGenerator";
import { Parser } from "json2csv";
import { convertToUSD } from "../utils/convertToUsd";
import {
  Currency,
  type as transactionType,
  transactionState,
  Country,
} from "../types/transaction";

export const createTransaction = async (req: Request, res: Response) => {
  try {
    const transactionData = req.body;
    const newTransaction = new TransactionModel(transactionData);
    const savedTransaction = await newTransaction.save();

    res.status(201).json({ transactionId: savedTransaction.transactionId });
  } catch (error) {
    console.error("Failed to create transaction", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getTransaction = async (req: Request, res: Response) => {
  try {
    const transactionId = req.params.id;
    const transaction = await TransactionModel.findOne({ transactionId });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.status(200).json(transaction);
  } catch (error) {
    console.error("Failed to get transaction", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const searchTransactions = async (req: Request, res: Response) => {
  try {
    const {
      amountGte,
      amountLte,
      startDate,
      endDate,
      description,
      type,
      state,
      tags,
      currency,
      originUserId,
      destinationUserId,
      searchTerm,
      page = 1,
      limit = 10,
      sortBy = "timestamp",
      sortOrder = "dsc",
    } = req.query;

    const query: any = {};

    if (amountGte || amountLte) {
      query["originAmountDetails.transactionAmount"] = {};
      if (amountGte) {
        query["originAmountDetails.transactionAmount"].$gte = parseFloat(
          amountGte as string
        );
      }
      if (amountLte) {
        query["originAmountDetails.transactionAmount"].$lte = parseFloat(
          amountLte as string
        );
      }
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate as string).getTime();
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate as string).getTime();
      }
    }

    if (description) {
      query.description = { $regex: description, $options: "i" };
    }

    if (type) {
      query.type = { $in: (type as string).split(",") };
    }

    if (state) {
      query.transactionState = { $in: (state as string).split(",") };
    }

    if (tags) {
      query.tags = {
        $elemMatch: { key: { $in: (tags as string).split(",") } },
      };
    }

    if (currency) {
      query["originAmountDetails.transactionCurrency"] = {
        $in: (currency as string).split(","),
      };
    }

    if (originUserId) {
      query.originUserId = { $in: (originUserId as string).split(",") };
    }

    if (destinationUserId) {
      query.destinationUserId = {
        $in: (destinationUserId as string).split(","),
      };
    }

    if (searchTerm) {
      const searchRegex = new RegExp(searchTerm as string, "i");
      query.$or = [
        { type: searchRegex },
        { transactionId: searchRegex },
        { originUserId: searchRegex },
        { destinationUserId: searchRegex },
        { transactionState: searchRegex },
        { tags: { $elemMatch: { key: searchRegex } } },
      ];
    }

    console.log("Constructed Query:", JSON.stringify(query, null, 2));

    const pageNumber = parseInt(page as string, 10);
    const pageSize = parseInt(limit as string, 10);

    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    const totalTransactions = await TransactionModel.countDocuments(query);
    const totalPages = Math.ceil(totalTransactions / pageSize);

    const transactions = await TransactionModel.find(query)
      .sort(sortOptions)
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize);

    res.status(200).json({
      metadata: {
        totalTransactions,
        totalPages,
        currentPage: pageNumber,
        pageSize,
      },
      transactions,
    });
  } catch (error) {
    console.error("Failed to search transactions", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getAllTags = async (req: Request, res: Response) => {
  try {
    const tags = await TransactionModel.distinct("tags.key");
    res.status(200).json(tags);
  } catch (error) {
    console.error("Failed to get tags", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getTransactionAmountRange = async (
  req: Request,
  res: Response
) => {
  try {
    const result = await TransactionModel.aggregate([
      {
        $group: {
          _id: null,
          maxAmount: { $max: "$originAmountDetails.transactionAmount" },
          minAmount: { $min: "$originAmountDetails.transactionAmount" },
        },
      },
    ]);

    if (result.length === 0) {
      return res.status(404).json({ error: "No transactions found" });
    }

    const { maxAmount, minAmount } = result[0];
    res.status(200).json({ maxAmount, minAmount });
  } catch (error) {
    console.error("Failed to get transaction amount range", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getAllUserIds = async (req: Request, res: Response) => {
  try {
    const originUserIds = await TransactionModel.distinct(
      "originUserId"
    ).exec();
    const destinationUserIds = await TransactionModel.distinct(
      "destinationUserId"
    ).exec();

    const allUserIds = Array.from(
      new Set([...originUserIds, ...destinationUserIds])
    );

    res.status(200).json(allUserIds);
  } catch (error) {
    console.error("Failed to get user IDs", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getGraphData = async (req: Request, res: Response) => {
  try {
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 1);

    const transactions = await TransactionModel.find({
      timestamp: { $gte: startDate.getTime(), $lte: endDate.getTime() },
    });

    let minAmount = Infinity;
    let maxAmount = -Infinity;

    const aggregatedData = new Map();

    // Generate all 15-minute intervals for the last 1 day
    for (
      let t = startDate.getTime();
      t <= endDate.getTime();
      t += 15 * 60 * 1000
    ) {
      aggregatedData.set(t, 0);
    }

    await Promise.all(
      transactions.map(async (transaction) => {
        const amountInUSD = await convertToUSD(
          transaction.originAmountDetails.transactionAmount,
          transaction.originAmountDetails.transactionCurrency
        );

        const roundedTimestamp =
          Math.floor(transaction.timestamp / (15 * 60 * 1000)) * (15 * 60 * 1000);

        aggregatedData.set(
          roundedTimestamp,
          (aggregatedData.get(roundedTimestamp) || 0) + amountInUSD
        );
      })
    );

    const graphData = Array.from(aggregatedData, ([timestamp, amount]) => {
      if (amount < minAmount) minAmount = amount;
      if (amount > maxAmount) maxAmount = amount;
      return { timestamp, amount };
    });

    // Adjust min and max amounts if all amounts are 0
    if (minAmount === Infinity) minAmount = 0;
    if (maxAmount === -Infinity) maxAmount = 0;

    res.status(200).json({
      graphData,
      minAmount,
      maxAmount,
    });
  } catch (error) {
    console.error("Failed to get graph data", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getAggregatedData = async (req: Request, res: Response) => {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 1);

    const transactions = await TransactionModel.find({
      timestamp: { $gte: startDate.getTime(), $lte: endDate.getTime() },
    });

    let totalAmountInUSD = 0;
    let successfulCount = 0;
    let declinedCount = 0;

    for (const transaction of transactions) {
      const amountInUSD = await convertToUSD(
        transaction.originAmountDetails.transactionAmount,
        transaction.originAmountDetails.transactionCurrency
      );
      totalAmountInUSD += amountInUSD;

      if (transaction.transactionState === "SUCCESSFUL") {
        successfulCount++;
      } else if (transaction.transactionState === "DECLINED") {
        declinedCount++;
      }
    }

    res.status(200).json({
      totalAmountInUSD,
      successfulCount,
      declinedCount,
    });
  } catch (error) {
    console.error("Failed to get aggregated data", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const generateTransactionReport = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      amountGte,
      amountLte,
      startDate,
      endDate,
      description,
      type,
      state,
      tags,
      currency,
      originUserId,
      destinationUserId,
      searchTerm,
      sortBy = "timestamp",
      sortOrder = "asc",
    } = req.query;

    const query: any = {};

    if (amountGte || amountLte) {
      query["originAmountDetails.transactionAmount"] = {};
      if (amountGte) {
        query["originAmountDetails.transactionAmount"].$gte = parseFloat(
          amountGte as string
        );
      }
      if (amountLte) {
        query["originAmountDetails.transactionAmount"].$lte = parseFloat(
          amountLte as string
        );
      }
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate as string).getTime();
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate as string).getTime();
      }
    }

    if (description) {
      query.description = { $regex: description, $options: "i" };
    }

    if (type) {
      query.type = { $in: (type as string).split(",") };
    }

    if (state) {
      query.transactionState = { $in: (state as string).split(",") };
    }

    if (tags) {
      query.tags = {
        $elemMatch: { key: { $in: (tags as string).split(",") } },
      };
    }

    if (currency) {
      query["originAmountDetails.transactionCurrency"] = {
        $in: (currency as string).split(","),
      };
    }

    if (originUserId) {
      query.originUserid = { $in: (originUserId as string).split(",") };
    }

    if (destinationUserId) {
      query.destinationUserId = {
        $in: (destinationUserId as string).split(","),
      };
    }

    if (searchTerm) {
      const searchRegex = new RegExp(searchTerm as string, "i");
      query.$or = [
        { type: searchRegex },
        { transactionId: searchRegex },
        { originUserId: searchRegex },
        { destinationUserId: searchRegex },
        { transactionState: searchRegex },
        { tags: { $elemMatch: { key: searchRegex } } },
      ];
    }

    const transactions = await TransactionModel.find(query)
      .sort({ [sortBy as string]: sortOrder === "asc" ? 1 : -1 })
      .exec();

    // Fetch Graph Data
    const graphEndDate = new Date();
    const graphStartDate = new Date();
    graphStartDate.setDate(graphEndDate.getDate() - 1);

    const graphTransactions = await TransactionModel.find({
      timestamp: {
        $gte: graphStartDate.getTime(),
        $lte: graphEndDate.getTime(),
      },
    });

    let minAmount = Infinity;
    let maxAmount = -Infinity;

    const graphAggregatedData = new Map();

    await Promise.all(
      transactions.map(async (transaction) => {
        const amountInUSD = await convertToUSD(
          transaction.originAmountDetails.transactionAmount,
          transaction.originAmountDetails.transactionCurrency
        );

        const roundedTimestamp =
          Math.floor(transaction.timestamp / (15 * 60 * 1000)) * (15 * 60 * 1000);

        if (graphAggregatedData.has(roundedTimestamp)) {
          graphAggregatedData.set(
            roundedTimestamp,
            graphAggregatedData.get(roundedTimestamp) + amountInUSD
          );
        } else {
          graphAggregatedData.set(roundedTimestamp, amountInUSD);
        }
      })
    );

    const graphData = Array.from(graphAggregatedData, ([timestamp, amount]) => {
      if (amount < minAmount) minAmount = amount;
      if (amount > maxAmount) maxAmount = amount;
      return { timestamp, amount };
    });

    // Fetch Aggregated Data
    let totalAmountInUSD = 0;
    let successfulCount = 0;
    let declinedCount = 0;

    for (const transaction of graphTransactions) {
      const amountInUSD = await convertToUSD(
        transaction.originAmountDetails.transactionAmount,
        transaction.originAmountDetails.transactionCurrency
      );
      totalAmountInUSD += amountInUSD;

      if (transaction.transactionState === transactionState.SUCCESSFUL) {
        successfulCount++;
      } else if (transaction.transactionState === transactionState.DECLINED) {
        declinedCount++;
      }
    }

    const aggregatedData = {
      totalAmountInUSD,
      successfulCount,
      declinedCount,
    };

    // Create HTML content
    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .title { text-align: center; font-size: 24px; margin-bottom: 20px; }
            .section { margin-bottom: 20px; }
            .table { width: 100%; border-collapse: collapse; }
            .table th, .table td { border: 1px solid #ddd; padding: 8px; }
            .table th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <div class="title">Transaction Report</div>
          <div class="section">
            <h2>Graph Data</h2>
            <img src="data:image/png;base64,${graphData}" alt="Graph Data" />
          </div>
          <div class="section">
            <h2>Aggregated Data</h2>
            <ul>
              ${Object.entries(aggregatedData)
                .map(([key, value]) => `<li>${key}: ${value}</li>`)
                .join("")}
            </ul>
          </div>
          <div class="section">
            <h2>Transactions</h2>
            <table class="table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Timestamp</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Currency</th>
                  <th>Type</th>
                  <th>State</th>
                  <th>Tags</th>
                  <th>Origin User ID</th>
                  <th>Destination User ID</th>
                  <th>Promotion Code Used</th>
                  <th>Reference</th>
                  <th>Origin Device Data</th>
                  <th>Destination Device Data</th>
                </tr>
              </thead>
              <tbody>
                ${transactions
                  .map(
                    (transaction) => `
                  <tr>
                    <td>${transaction.transactionId}</td>
                    <td>${transaction.timestamp}</td>
                    <td>${transaction.description}</td>
                    <td>${
                      transaction.originAmountDetails.transactionAmount
                    }</td>
                    <td>${
                      transaction.originAmountDetails.transactionCurrency
                    }</td>
                    <td>${transaction.type}</td>
                    <td>${transaction.transactionState}</td>
                    <td>${transaction.tags
                      .map((tag) => `${tag.key}: ${tag.value}`)
                      .join(", ")}</td>
                    <td>${transaction.originUserId}</td>
                    <td>${transaction.destinationUserId}</td>
                    <td>${transaction.promotionCodeUsed}</td>
                    <td>${transaction.reference}</td>
                    <td>${JSON.stringify(transaction.originDeviceData)}</td>
                    <td>${JSON.stringify(
                      transaction.destinationDeviceData
                    )}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `;

    // Launch Puppeteer and generate PDF
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    const pdfBuffer = await page.pdf({ format: "A4" });
    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=transaction_report.pdf"
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Failed to generate PDF report", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
};

export const downloadCSV = async (req: Request, res: Response) => {
  try {
    const {
      amountGte,
      amountLte,
      startDate,
      endDate,
      description,
      type,
      state,
      tags,
      currency,
      originUserId,
      destinationUserId,
      searchTerm,
      sortBy = "timestamp",
      sortOrder = "asc",
    } = req.query;

    const query: any = {};

    if (amountGte || amountLte) {
      query["originAmountDetails.transactionAmount"] = {};
      if (amountGte) {
        query["originAmountDetails.transactionAmount"].$gte = parseFloat(
          amountGte as string
        );
      }
      if (amountLte) {
        query["originAmountDetails.transactionAmount"].$lte = parseFloat(
          amountLte as string
        );
      }
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate as string).getTime();
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate as string).getTime();
      }
    }

    if (description) {
      query.description = { $regex: description, $options: "i" };
    }

    if (type) {
      query.type = { $in: (type as string).split(",") };
    }

    if (state) {
      query.transactionState = { $in: (state as string).split(",") };
    }

    if (tags) {
      query.tags = {
        $elemMatch: { key: { $in: (tags as string).split(",") } },
      };
    }

    if (currency) {
      query["originAmountDetails.transactionCurrency"] = {
        $in: (currency as string).split(","),
      };
    }

    if (originUserId) {
      query.originUserid = { $in: (originUserId as string).split(",") };
    }

    if (destinationUserId) {
      query.destinationUserId = {
        $in: (destinationUserId as string).split(","),
      };
    }

    if (searchTerm) {
      const searchRegex = new RegExp(searchTerm as string, "i");
      query.$or = [
        { type: searchRegex },
        { transactionId: searchRegex },
        { originUserId: searchRegex },
        { destinationUserId: searchRegex },
        { transactionState: searchRegex },
        { tags: { $elemMatch: { key: searchRegex } } },
      ];
    }

    const transactions = await TransactionModel.find(query)
      .sort({ [sortBy as string]: sortOrder === "asc" ? 1 : -1 })
      .exec();

    const csvData = transactions.map((transaction) => ({
      transactionId: transaction.transactionId,
      timestamp: transaction.timestamp,
      description: transaction.description,
      originAmount: transaction.originAmountDetails.transactionAmount,
      originCurrency: transaction.originAmountDetails.transactionCurrency,
      originCountry: transaction.originAmountDetails.country,
      destinationAmount: transaction.destinationAmountDetails.transactionAmount,
      destinationCurrency:
        transaction.destinationAmountDetails.transactionCurrency,
      destinationCountry: transaction.destinationAmountDetails.country,
      type: transaction.type,
      state: transaction.transactionState,
      tags: transaction.tags
        .map((tag) => `${tag.key}: ${tag.value}`)
        .join(", "),
      originUserId: transaction.originUserId,
      destinationUserId: transaction.destinationUserId,
      promotionCodeUsed: transaction.promotionCodeUsed,
      reference: transaction.reference,
      originDeviceBatteryLevel: transaction.originDeviceData.batteryLevel,
      originDeviceLatitude: transaction.originDeviceData.deviceLatitude,
      originDeviceLongitude: transaction.originDeviceData.deviceLongitude,
      originDeviceIpAddress: transaction.originDeviceData.ipAddress,
      originDeviceIdentifier: transaction.originDeviceData.deviceIdentifier,
      originDeviceVpnUsed: transaction.originDeviceData.vpnUsed,
      originDeviceOperatingSystem: transaction.originDeviceData.operatingSystem,
      originDeviceMaker: transaction.originDeviceData.deviceMaker,
      originDeviceModel: transaction.originDeviceData.deviceModel,
      originDeviceYear: transaction.originDeviceData.deviceYear,
      originDeviceAppVersion: transaction.originDeviceData.appVersion,
      destinationDeviceBatteryLevel:
        transaction.destinationDeviceData.batteryLevel,
      destinationDeviceLatitude:
        transaction.destinationDeviceData.deviceLatitude,
      destinationDeviceLongitude:
        transaction.destinationDeviceData.deviceLongitude,
      destinationDeviceIpAddress: transaction.destinationDeviceData.ipAddress,
      destinationDeviceIdentifier:
        transaction.destinationDeviceData.deviceIdentifier,
      destinationDeviceVpnUsed: transaction.destinationDeviceData.vpnUsed,
      destinationDeviceOperatingSystem:
        transaction.destinationDeviceData.operatingSystem,
      destinationDeviceMaker: transaction.destinationDeviceData.deviceMaker,
      destinationDeviceModel: transaction.destinationDeviceData.deviceModel,
      destinationDeviceYear: transaction.destinationDeviceData.deviceYear,
      destinationDeviceAppVersion: transaction.destinationDeviceData.appVersion,
    }));

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(csvData);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=transactions.csv"
    );
    res.status(200).end(csv);
  } catch (error) {
    console.error("Failed to generate CSV", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const transactionGeneratorCron = async (req: Request, res: Response) => {
  try {
    const { action } = req.body;

    if (action === "start") {
      startTransactionGenerator();
      res.status(200).json({ message: "Transaction generator started" });
    } else if (action === "stop") {
      stopTransactionGenerator();
      res.status(200).json({ message: "Transaction generator stopped" });
    } else {
      res.status(400).json({ error: "Invalid action" });
    }
  } catch (error) {
    console.error("Failed to start transaction generator", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
