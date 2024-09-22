import { Router } from "express";
import {
  createTransaction,
  generateTransactionReport,
  getAllTags,
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
  .get("/:id", getTransaction)
  .get("/", searchTransactions)
  .post("/generator", transactionGeneratorCron);

export default router;
