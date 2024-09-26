
# Flagright Assignment - Backend

This repository contains the backend code of the Flagright Hiring Assignment. 

Deployed link: https://flagright-fe.vercel.app/ 

Server URL (for testing APIs): https://flagrightbe-gmgagzcuf8cdbpdy.centralindia-01.azurewebsites.net 

Video Demonstration Link: https://youtu.be/oGZboEHf7NA

Frontend Repository Link: https://github.com/kshitij-404/flagright-fe

## Tech Stack

**Client:** React, Mantine, TypeScript, Bun

**Server:** Bun, Express, MongoDB, TypeScript


## Run Locally

Clone the project

```bash
  git clone https://github.com/kshitij-404/flagright-assignment.git
```

Go to the project directory

```bash
  cd flagright-assignment
```

Install dependencies

```bash
  bun install
```

Create .env file in root directory

```bash
  touch .env
```

Use .env.example to populate the env file

```bash
PORT=3000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/<database-name>
GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/auth/google/callback
FRONTEND_URL=http://localhost:5173
JWT_SECRET=<your-jwt-secret>
AZURE_STORAGE_CONNECTION_STRING=<your-azure-storage-connection-string>
AZURE_MAIL_CONNECTION_STRING=endpoint=https://<your-endpoint>.communication.azure.com
AZURE_SENDER_MAIL=<your-sender-mail>
```

Similarly create .env.test file and use .env.example to populate the data with what you would like to use while running tests

```bash
  touch .env.test
```

Start the server

```bash
  bun run dev
```

### Using Docker

Clone the project

```bash
  git clone https://github.com/kshitij-404/flagright-assignment.git
```

Go to the project directory

```bash
  cd flagright-assignment
```

Create .env file in root directory

```bash
  touch .env
```

Use .env.example to populate the env file

```bash
PORT=3000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/<database-name>
GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/auth/google/callback
FRONTEND_URL=http://localhost:5173
JWT_SECRET=<your-jwt-secret>
AZURE_STORAGE_CONNECTION_STRING=<your-azure-storage-connection-string>
AZURE_MAIL_CONNECTION_STRING=endpoint=https://<your-endpoint>.communication.azure.com
AZURE_SENDER_MAIL=<your-sender-mail>
```

Similarly create .env.test file and use .env.example to populate the data with what you would like to use while running tests

```bash
  touch .env.test
```

Build Docker Image

```bash
  docker build -t flagright-backend .
```

Run Docker Image (Replace 3000 with your port if you changed it)
```bash
  docker run -p 3000:3000 flagright-backend
```



## Running Tests

To run tests, run the following command

```bash
  bun run jest
```
### Testing APIs on Postman
### Base URL
`http://localhost:3000` (assuming the server is running locally on port 3000)

`https://flagrightbe-gmgagzcuf8cdbpdy.centralindia-01.azurewebsites.net` (if you using the deployed server link)

### Authentication
Most endpoints require authentication. Use the following header:
```
Authorization: Bearer <your_jwt_token>
```
To obtain a JWT token, use the Google OAuth flow (not directly accessible via Postman).

### Endpoints

#### 1. Google OAuth Initiation
- **Endpoint:** `/auth/google`
- **Method:** GET
- **Description:** Initiates Google OAuth flow. (Not directly testable in Postman)

#### 2. Google OAuth Callback
- **Endpoint:** `/auth/google/callback`
- **Method:** GET
- **Description:** Handles Google OAuth callback. (Not directly testable in Postman)

#### 3. Get User Data
- **Endpoint:** `/user`
- **Method:** GET
- **Auth Required:** Yes

#### 4. Create Transaction
- **Endpoint:** `/transaction`
- **Method:** POST
- **Auth Required:** Yes
- **Headers:** 
  ```
  Content-Type: application/json
  ```
- **Body:**
  ```json
  {
    "type": "DEPOSIT",
    "transactionId": "txn_123456",
    "timestamp": 1639035013000,
    "originUserId": "user123",
    "destinationUserId": "user456",
    "transactionState": "CREATED",
    "originAmountDetails": {
      "transactionAmount": 100,
      "transactionCurrency": "USD",
      "country": "US"
    },
    "destinationAmountDetails": {
      "transactionAmount": 100,
      "transactionCurrency": "USD",
      "country": "US"
    },
    "promotionCodeUsed": false,
    "reference": "Payment for services",
    "originDeviceData": {
      "batteryLevel": 0.8,
      "deviceLatitude": 40.7128,
      "deviceLongitude": -74.0060,
      "ipAddress": "192.168.1.1",
      "deviceIdentifier": "iPhone12",
      "vpnUsed": false,
      "operatingSystem": "iOS",
      "deviceMaker": "Apple",
      "deviceModel": "iPhone 12",
      "deviceYear": "2020",
      "appVersion": "1.0.0"
    },
    "destinationDeviceData": {
      "batteryLevel": 0.6,
      "deviceLatitude": 34.0522,
      "deviceLongitude": -118.2437,
      "ipAddress": "192.168.1.2",
      "deviceIdentifier": "SamsungS21",
      "vpnUsed": false,
      "operatingSystem": "Android",
      "deviceMaker": "Samsung",
      "deviceModel": "Galaxy S21",
      "deviceYear": "2021",
      "appVersion": "1.0.0"
    },
    "tags": [
      { "key": "purpose", "value": "true" }
    ],
    "description": "Payment for consulting services"
  }
  ```

#### 5. Get All Tags
- **Endpoint:** `/transaction/tags`
- **Method:** GET
- **Auth Required:** Yes

#### 6. Get Transaction Amount Range
- **Endpoint:** `/transaction/amount-range`
- **Method:** GET
- **Auth Required:** Yes

#### 7. Get All User IDs
- **Endpoint:** `/transaction/user-id-list`
- **Method:** GET
- **Auth Required:** Yes

#### 8. Generate Transaction Report
- **Endpoint:** `/transaction/report`
- **Method:** GET
- **Auth Required:** Yes
- **Query Parameters:** (all optional)
  ```
  amountGte: number
  amountLte: number
  startDate: ISO date string
  endDate: ISO date string
  description: string
  type: string (comma separated for multiple values)
  state: string (comma separated for multiple values)
  tags: string (comma separated for multiple values)
  currency: string (comma separated for multiple values)
  originUserId: string (comma separated for multiple values)
  destinationUserId: string (comma separated for multiple values)
  searchTerm: string
  sortBy: string
  sortOrder: asc/desc
  ```

#### 9. Get Graph Data
- **Endpoint:** `/transaction/graph-data`
- **Method:** GET
- **Auth Required:** Yes

#### 10. Get Aggregated Data
- **Endpoint:** `/transaction/aggregate-data`
- **Method:** GET
- **Auth Required:** Yes
- **Headers:** 

#### 11. Download CSV
- **Endpoint:** `/transaction/download-csv`
- **Method:** GET
- **Auth Required:** Yes
- **Query Parameters:** (all optional)
  ```
  amountGte: number
  amountLte: number
  startDate: ISO date string
  endDate: ISO date string
  description: string
  type: string (comma separated for multiple values)
  state: string (comma separated for multiple values)
  tags: string (comma separated for multiple values)
  currency: string (comma separated for multiple values)
  originUserId: string (comma separated for multiple values)
  destinationUserId: string (comma separated for multiple values)
  searchTerm: string
  sortBy: string
  sortOrder: asc/desc
  ```

#### 12. Get Single Transaction
- **Endpoint:** `/transaction/:id`
- **Method:** GET
- **Auth Required:** Yes
- **URL Parameters:**
  ```
  id: Transaction ID
  ```

#### 13. Search Transactions
- **Endpoint:** `/transaction`
- **Method:** GET
- **Auth Required:** Yes
- **Query Parameters:** (all optional)
  ```
  amountGte: number
  amountLte: number
  startDate: ISO date string
  endDate: ISO date string
  description: string
  type: string (comma separated for multiple values)
  state: string (comma separated for multiple values)
  tags: string (comma separated for multiple values)
  currency: string (comma separated for multiple values)
  originUserId: string (comma separated for multiple values)
  destinationUserId: string (comma separated for multiple values)
  searchTerm: string
  page: number
  limit: number
  sortBy: string
  sortOrder: asc/desc
  ```

#### 14. Transaction Generator Cron
- **Endpoint:** `/transaction/generator`
- **Method:** POST
- **Auth Required:** Yes
- **Headers:** 
  ```
  Content-Type: application/json
  ```
- **Body:**
  ```json
  {
    "action": "start" // or "stop"
  }
  ```
