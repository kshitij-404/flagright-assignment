import { Router } from "express";
import {
  createTransaction,
  downloadCSV,
  generateTransactionReport,
  getAggregatedData,
  getAllTags,
  getGraphData,
  getTransaction,
  getTransactionAmountRange,
  searchTransactions,
  transactionGeneratorCron,
} from "../controllers/transaction";

const router = Router();

router
  .post("/", createTransaction)
  .get("/tags", getAllTags)
  .get("/amount-range", getTransactionAmountRange)
  .get("/report", generateTransactionReport)
  .get("/graph-data", getGraphData)
  .get("/aggregate-data", getAggregatedData)
  .get("/download-csv", downloadCSV)
  .get("/:id", getTransaction)
  .get("/", searchTransactions)
  .post("/generator", transactionGeneratorCron);

export default router;
