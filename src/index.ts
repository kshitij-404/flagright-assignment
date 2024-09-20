import express from "express";
import { connectDB } from "./config/database";
import bodyParser from "body-parser";
import cors from "cors";
import helloRoute from "./routes/sample";
import transactionRoute from "./routes/transaction";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

connectDB();

app.use('/', helloRoute);
app.use('/transaction', transactionRoute);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
