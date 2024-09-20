import mongoose, { Schema } from "mongoose";
import { Currency, Country, transactionState, type, Transaction } from "../types/transaction";

const AmountDetailsSchema: Schema = new Schema({
  transactionAmount: { type: Number, required: true },
  transactionCurrency: { type: String, enum: Object.values(Currency), required: true },
  country: { type: String, enum: Object.values(Country), required: true },
});

const DeviceDataSchema: Schema = new Schema({
  batteryLevel: { type: Number, required: true },
  deviceLatitude: { type: Number, required: true },
  deviceLongitude: { type: Number, required: true },
  ipAddress: { type: String, required: true },
  deviceIdentifier: { type: String, required: true },
  vpnUsed: { type: Boolean, required: true },
  operatingSystem: { type: String, required: true },
  deviceMaker: { type: String, required: true },
  deviceModel: { type: String, required: true },
  deviceYear: { type: String, required: true },
  appVersion: { type: String, required: true },
});

const TagSchema: Schema = new Schema({
  key: { type: String, required: true },
  value: { type: String, required: true },
});

const TransactionSchema: Schema = new Schema({
  type: {
    type: String,
    enum: Object.values(type),
    required: true,
  },
  transactionId: { type: String, required: true },
  timestamp: { type: Number, required: true },
  originUserId: { type: String, required: true },
  destinationUserId: { type: String, required: true },
  transactionState: {
    type: String,
    enum: Object.values(transactionState),
    required: true,
  },
  originAmountDetails: { type: AmountDetailsSchema, required: true },
  destinationAmountDetails: { type: AmountDetailsSchema, required: true },
  promotionCodeUsed: { type: Boolean, required: true },
  reference: { type: String, required: true },
  originDeviceData: { type: DeviceDataSchema, required: true },
  destinationDeviceData: { type: DeviceDataSchema, required: true },
  tags: { type: [TagSchema], required: true },
  description: { type: String, required: true }
});

const TransactionModel = mongoose.model<Transaction>(
  "Transaction",
  TransactionSchema
);

export default TransactionModel;
