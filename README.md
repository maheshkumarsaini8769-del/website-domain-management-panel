# Website & Domain Management Panel

A responsive, secure web application for tracking websites, domain expiries, client payments, admin access records, and sale status.

---

## 🚀 Quick Access

- **Web Application URL:** [http://localhost:3000](http://localhost:3000)
- **Default Admin Username:** `maheshsaini`
- **Default Admin Password:** `mahesh99830`

> ⚠️ **Important Security Note:** When logging in with the default credentials, a security notice will remind you to change the default password. You can change your password at any time by clicking the **Security** button in the header.

---

## ✨ Features

### 1. Secure Authentication & Security
- Hashed passwords using `bcryptjs` (salt rounds: 10). Passwords are never stored in plain text.
- Protected API routes and pages with secure JWT session authentication.
- Warning banner prompts to change default password on first login.
- Change password from inside the panel with real-time validation.
- Secure logout.

### 2. Domain & Expiry Tracking
- **Website Name & Clickable URL:** Directly opens external sites in a new tab (`target="_blank"`).
- **Auto-Calculated Expiry Date:** Automatically computed from **Domain Purchase Date + Duration in Years** (can also be manually customized).
- **Accurate Days Remaining:** Live countdown of days remaining until expiration.
- **Dynamic Status Badges:**
  - **Active** (> 30 days remaining)
  - **Expiring Soon** (≤ 30 days remaining)
  - **Expired** (< 0 days)
- Quick 1-click filter for domains expiring within 30 days.

### 3. Payment Records & Financials (INR ₹)
- Formatted in Indian Rupee format (`₹1,50,000`).
- **Total Price / Amount Charged**
- **Payment Received**
- **Auto-Calculated Pending Amount** (`Total Price − Payment Received`).
- Payment Date & Payment Method / Notes (UPI, NEFT, Cash, Cheque, etc.).
- Real-time dashboard totals for Received, Pending, and Cleared payments.

### 4. Sale & Admin Access Management
- **Sale Status:** Not for Sale, For Sale, Sold.
- Conditional inputs for Selling Price and Sold Date.
- **Admin Access Given (Yes / No):**
  - Tracks whether admin credentials were handed over to the client.
  - Stores Admin Name / Details and Date Given.
  - Filterable in table, quick pills, and dashboard.

### 5. Dashboard Overview (11 KPI Metrics)
Live real-time statistics updating automatically:
1. Total websites stored
2. Total websites for sale
3. Total sold websites
4. Total payment received (`₹`)
5. Total pending payment (`₹`)
6. My cleared/received payment total (`₹`)
7. Total domains expiring within 30 days
8. Total expired domains
9. Total active domains
10. Total clients given admin access
11. Total clients not given admin access

*Clicking any KPI card immediately filters the table view accordingly.*

### 6. Search, Filter & Sort
- **Universal Search Bar:** Case-insensitive search across website name, URL, client name, built date, purchase date, payment date, payment amount, sale status, admin status, expiry status, and notes.
- **Quick Filter Pills:** All, Expiring ≤ 30 Days, Expired, Active, For Sale, Sold, Admin Given: Yes, Admin Given: No.
- **Advanced Filters:** Date type (Built/Purchase/Expiry/Payment), Date range (From - To), and Payment amount range.
- **Sorting:** Clickable column headers to sort by Name, Built Date, Expiry Date, Days Remaining, Payment Received, or Pending Amount (Ascending / Descending).
- **Dual View Modes:** Clean Desktop Data Table & Mobile Responsive Cards Grid.
- **Export to CSV:** Download full database records to CSV spreadsheet.

### 7. Database Persistence
- Powered by SQLite (`better-sqlite3`) in `data/websites.db`.
- WAL (Write-Ahead Logging) enabled for speed and data integrity.
- Data stays saved across reboots, refreshes, and logouts.
- Zero fake/demo records initialized by default.

---

## 🛠️ Commands

To start the server manually:
```bash
npm start
```

To run in development mode with auto-reload:
```bash
npm run dev
```
