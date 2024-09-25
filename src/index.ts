import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import passport from "passport";
import { connectDB } from "./config/database";
import {
  useGoogleCallback,
  useGooglStrategy,
  useJwtStrategy,
  validateAuth,
} from "./middlewares/auth";
import helloRoute from "./routes/sample";
import transactionRoutes from "./routes/transaction";
import userRoutes from "./routes/user";
import { handleGoogleCallback, initiateGoogleLogin } from "./utils/auth";

const app = express();
const port = process.env.PORT || 3000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

passport.use(useJwtStrategy);
passport.use(useGooglStrategy);

app.get("/auth/google", initiateGoogleLogin);
app.get("/auth/google/callback", useGoogleCallback, handleGoogleCallback);

connectDB();

app.use("/", helloRoute);
app.use("/user", validateAuth, userRoutes);
app.use("/transaction", validateAuth, transactionRoutes);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
