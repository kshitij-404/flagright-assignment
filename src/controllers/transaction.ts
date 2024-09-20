import { Request, Response } from "express";
import TransactionModel from "../models/transaction";
import {
  startTransactionGenerator,
  stopTransactionGenerator,
} from "../cron/transactionGenerator";

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
      amount,
      startDate,
      endDate,
      description,
      type,
      state,
      page = 1,
      limit = 10,
    } = req.query;

    const query: any = {};

    if (amount) {
      query["originAmountDetails.transactionAmount"] = amount;
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
      query.type = type;
    }

    if (state) {
      query.transactionState = state;
    }

    const pageNumber = parseInt(page as string, 10);
    const pageSize = parseInt(limit as string, 10);

    const totalTransactions = await TransactionModel.countDocuments(query);
    const totalPages = Math.ceil(totalTransactions / pageSize);

    const transactions = await TransactionModel.find(query)
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
