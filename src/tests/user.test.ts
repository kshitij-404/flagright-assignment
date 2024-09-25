import request from "supertest";
import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import userRoutes from "../routes/user";
import { connectDB, disconnectDB } from "../config/database";
import { validateAuth } from "../middlewares/auth";

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());
app.use("/user", validateAuth, userRoutes);

jest.mock("passport", () => {
  return {
    authenticate: jest.fn(
      (strategy, options) =>
        (
          req: express.Request,
          res: express.Response,
          next: express.NextFunction
        ) => {
          if (strategy === "jwt") {
            if (req.headers.authorization === "Bearer validToken") {
              req.user = {
                _id: "testUserId",
                passportId: "testPassportId",
                firstName: "Test",
                lastName: "User",
                displayName: "Test User",
                email: "testuser@example.com",
                avatar: "http://example.com/avatar.jpg",
              };
              return next();
            } else {
              return res.status(401).json({ error: "Unauthorized" });
            }
          }
          return next();
        }
    ),
  };
});

beforeAll(async () => {
  await connectDB();
}, 30000);

afterAll(async () => {
  await disconnectDB();
}, 30000);

describe("GET /user", () => {
  it("should return user data when authenticated", async () => {
    const response = await request(app)
      .get("/user")
      .set("Authorization", "Bearer validToken");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("_id", "testUserId");
    expect(response.body).toHaveProperty("passportId", "testPassportId");
    expect(response.body).toHaveProperty("firstName", "Test");
    expect(response.body).toHaveProperty("lastName", "User");
    expect(response.body).toHaveProperty("displayName", "Test User");
    expect(response.body).toHaveProperty("email", "testuser@example.com");
    expect(response.body).toHaveProperty(
      "avatar",
      "http://example.com/avatar.jpg"
    );
  });

  it("should return 401 when not authenticated", async () => {
    const response = await request(app)
      .get("/user")
      .set("Authorization", "Bearer invalidToken");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("error", "Unauthorized");
  });
});
