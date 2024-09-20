import { Router } from "express";
import {
  createTransaction,
  generateTransactionReport,
  getTransaction,
  searchTransactions,
  transactionGeneratorCron,
} from "../controllers/transaction";

const router = Router();

router
  .post("/", createTransaction)
  .get("/report", generateTransactionReport)
  .get("/:id", getTransaction)
  .get("/", searchTransactions)
  .post("/generator", transactionGeneratorCron);

export default router;
