import { Request, Response } from "express";
import TransactionModel from "../models/transaction";
import {
  startTransactionGenerator,
  stopTransactionGenerator,
} from "../cron/transactionGenerator";
import { parse } from "json2csv";
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
      searchTerm,
      page = 1,
      limit = 10,
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

export const generateTransactionReport = async (
  req: Request,
  res: Response
) => {
  try {
    const { startDate, endDate } = req.query;

    const query: any = {};

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate as string).getTime();
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate as string).getTime();
      }
    }

    const transactions = await TransactionModel.find(query);

    const totalAmount = transactions.reduce((sum, transaction) => {
      return sum + transaction.originAmountDetails.transactionAmount;
    }, 0);

    const report = {
      totalTransactions: transactions.length,
      totalAmount,
      transactions,
    };

    res.status(200).json(report);
  } catch (error) {
    console.error("Failed to generate transaction report", error);
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

export const getGraphData = async (req: Request, res: Response) => {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 5);

    const transactions = await TransactionModel.find({
      timestamp: { $gte: startDate.getTime(), $lte: endDate.getTime() },
    });

    let minAmount = Infinity;
    let maxAmount = -Infinity;

    const graphData = await Promise.all(
      transactions.map(async (transaction) => {
        const amountInUSD = await convertToUSD(
          transaction.originAmountDetails.transactionAmount,
          transaction.originAmountDetails.transactionCurrency
        );

        if (amountInUSD < minAmount) minAmount = amountInUSD;
        if (amountInUSD > maxAmount) maxAmount = amountInUSD;

        return {
          timestamp: transaction.timestamp,
          amount: amountInUSD,
        };
      })
    );

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
    startDate.setDate(endDate.getDate() - 5);

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

export const downloadCSV = async (req: Request, res: Response) => {
  try {
    const filters = req.query;
    const transactions = await TransactionModel.find(filters).exec();
    let totalAmountInUSD = 0;
    let successfulCount = 0;
    let declinedCount = 0;
    const typeCounts: { [key in transactionType]?: number } = {};
    const stateCounts: { [key in transactionState]?: number } = {};

    const csvData = await Promise.all(
      transactions.map(async (transaction) => {
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

        typeCounts[transaction.type] = (typeCounts[transaction.type] || 0) + 1;
        stateCounts[transaction.transactionState] =
          (stateCounts[transaction.transactionState] || 0) + 1;

        return {
          transactionId: transaction.transactionId,
          timestamp: transaction.timestamp,
          description: transaction.description,
          amount: transaction.originAmountDetails.transactionAmount,
          currency: transaction.originAmountDetails.transactionCurrency,
          type: transaction.type || transactionType.OTHER,
          state: transaction.transactionState || transactionState.CREATED,
          tags: transaction.tags.map((tag) => tag.key).join(", "),
          originUserId: transaction.originUserId,
          destinationUserId: transaction.destinationUserId,
          promotionCodeUsed: transaction.promotionCodeUsed,
          reference: transaction.reference,
          originDeviceData_batteryLevel:
            transaction.originDeviceData.batteryLevel,
          originDeviceData_deviceLatitude:
            transaction.originDeviceData.deviceLatitude,
          originDeviceData_deviceLongitude:
            transaction.originDeviceData.deviceLongitude,
          originDeviceData_ipAddress: transaction.originDeviceData.ipAddress,
          originDeviceData_deviceIdentifier:
            transaction.originDeviceData.deviceIdentifier,
          originDeviceData_vpnUsed: transaction.originDeviceData.vpnUsed,
          originDeviceData_operatingSystem:
            transaction.originDeviceData.operatingSystem,
          originDeviceData_deviceMaker:
            transaction.originDeviceData.deviceMaker,
          originDeviceData_deviceModel:
            transaction.originDeviceData.deviceModel,
          originDeviceData_deviceYear: transaction.originDeviceData.deviceYear,
          originDeviceData_appVersion: transaction.originDeviceData.appVersion,
          destinationDeviceData_batteryLevel:
            transaction.destinationDeviceData.batteryLevel,
          destinationDeviceData_deviceLatitude:
            transaction.destinationDeviceData.deviceLatitude,
          destinationDeviceData_deviceLongitude:
            transaction.destinationDeviceData.deviceLongitude,
          destinationDeviceData_ipAddress:
            transaction.destinationDeviceData.ipAddress,
          destinationDeviceData_deviceIdentifier:
            transaction.destinationDeviceData.deviceIdentifier,
          destinationDeviceData_vpnUsed:
            transaction.destinationDeviceData.vpnUsed,
          destinationDeviceData_operatingSystem:
            transaction.destinationDeviceData.operatingSystem,
          destinationDeviceData_deviceMaker:
            transaction.destinationDeviceData.deviceMaker,
          destinationDeviceData_deviceModel:
            transaction.destinationDeviceData.deviceModel,
          destinationDeviceData_deviceYear:
            transaction.destinationDeviceData.deviceYear,
          destinationDeviceData_appVersion:
            transaction.destinationDeviceData.appVersion,
          originAmountDetails_transactionAmount:
            transaction.originAmountDetails.transactionAmount,
          originAmountDetails_transactionCurrency:
            transaction.originAmountDetails.transactionCurrency,
          originAmountDetails_country: transaction.originAmountDetails.country,
          destinationAmountDetails_transactionAmount:
            transaction.destinationAmountDetails.transactionAmount,
          destinationAmountDetails_transactionCurrency:
            transaction.destinationAmountDetails.transactionCurrency,
          destinationAmountDetails_country:
            transaction.destinationAmountDetails.country,
        };
      })
    );

    csvData.push({
      transactionId: "Statistics",
      timestamp: Date.now(),
      description: "",
      amount: totalAmountInUSD,
      currency: Currency.USD,
      type: transactionType.OTHER,
      state: transactionState.SUCCESSFUL,
      tags: `Successful: ${successfulCount}, Declined: ${declinedCount}`,
      originUserId: "",
      destinationUserId: "",
      promotionCodeUsed: false,
      reference: "",
      originDeviceData_batteryLevel: 0,
      originDeviceData_deviceLatitude: 0,
      originDeviceData_deviceLongitude: 0,
      originDeviceData_ipAddress: "",
      originDeviceData_deviceIdentifier: "",
      originDeviceData_vpnUsed: false,
      originDeviceData_operatingSystem: "",
      originDeviceData_deviceMaker: "",
      originDeviceData_deviceModel: "",
      originDeviceData_deviceYear: "",
      originDeviceData_appVersion: "",
      destinationDeviceData_batteryLevel: 0,
      destinationDeviceData_deviceLatitude: 0,
      destinationDeviceData_deviceLongitude: 0,
      destinationDeviceData_ipAddress: "",
      destinationDeviceData_deviceIdentifier: "",
      destinationDeviceData_vpnUsed: false,
      destinationDeviceData_operatingSystem: "",
      destinationDeviceData_deviceMaker: "",
      destinationDeviceData_deviceModel: "",
      destinationDeviceData_deviceYear: "",
      destinationDeviceData_appVersion: "",
      originAmountDetails_transactionAmount: 0,
      originAmountDetails_transactionCurrency: Currency.USD,
      originAmountDetails_country: Country.US,
      destinationAmountDetails_transactionAmount: 0,
      destinationAmountDetails_transactionCurrency: Currency.USD,
      destinationAmountDetails_country: Country.US,
    });

    const csv = parse(csvData);
    res.header("Content-Type", "text/csv");
    res.attachment("transactions.csv");
    res.send(csv);
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
