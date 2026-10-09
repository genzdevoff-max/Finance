# Finance Tracker

A simple, mobile-first personal finance, credit, and collection management application. Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Drizzle ORM**, and **TiDB Cloud MySQL**.

Designed to track financial accounts, multiple separate credit/loan records per person, installment repayments, and running balances without manual math or accounting complexity.

---

## 📱 Key Features

- **Mobile-First App Experience**: Optimized for mobile screens, installs cleanly on Android & iOS as a standalone PWA with an app icon.
- **Single-User, Zero-Friction**: No login or authentication walls for v1. Open the app and record collections immediately.
- **High-Speed Collection Flow**:
  - Open app &rarr; Tap "+ Collect" &rarr; Select Borrower &rarr; Select Loan &rarr; Enter Amount &rarr; Confirm &rarr; Done.
  - Live preview of remaining balance before recording payment.
  - Pre-selected loan & borrower shortcuts when navigating from borrower or loan detail pages.
- **Multiple Loans Per Person**: Never merges separate loans. Each loan maintains its own principal, installment history, and status.
- **Flexible Collection Schedule**: Choose daily, weekly, or monthly installment frequency per loan and adjust it later from loan details.
- **Strict Financial Integrity**:
  - Monetary values stored and computed as integer **Paise** (1 Rupee = 100 paise) to eliminate JavaScript floating-point rounding errors.
  - All calculations are derived strictly from valid collection records.
  - Rejects negative amounts, zero amounts, and collections exceeding remaining loan balances.
  - Loans are automatically marked `COMPLETED` when remaining balance reaches ₹0.
  - Deleting or editing a payment automatically recalibrates loan balances and statuses.
- **Instant Dashboard Insights**:
  - Total Outstanding across all active loans.
  - Daily, weekly (Monday-to-date), and monthly-to-date collection totals and records.
  - Active Borrowers and Active Loans counts.
  - Today's collection activity stream with timestamps.
  - Ranked list of borrowers with pending balances.
- **Full History & Filtering**:
  - Filter payments by Today, Yesterday, This Week, This Month, All Time, or Custom Date Range.
  - Filter by individual borrower.
  - Edit or delete payment entries with automatic balance recalculation.
- **Excel Export**: Download a person’s loan summary and full collection history as an `.xlsx` workbook.
- **History Reports**: Download all history, an individual customer’s history, or a date-filtered collection report as a three-sheet Excel workbook.

The history workbook reports actual saved collection records as successful payments and omits internal loan and collection IDs. Payment mode is shown as “Not recorded” because the current collection schema does not store payment mode. No installment due dates are configured, so next due dates show “Not scheduled” and overdue installment statuses are not inferred. The Installment Schedule sheet reports loan-level collected and outstanding balances instead of inventing due rows.
- **Indian Rupee Formatting**:
  - Formatted using `Intl.NumberFormat('en-IN')` (e.g. `₹500`, `₹1,000`, `₹25,500`, `₹1,25,000`).

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 15.5.x](https://nextjs.org/) (App Router, Server Actions, React Server Components)
- **Runtime & Language**: Node.js 20 LTS, React 19, Strict TypeScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with custom mobile UI components
- **Database**: TiDB Cloud (MySQL-compatible)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/) with `mysql2`
- **Forms & Validation**: [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/)
- **Date Utilities**: [date-fns](https://date-fns.org/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **PWA**: Web App Manifest (`manifest.webmanifest`), Service Worker (`public/sw.js`), Apple Touch icons

---

## 📋 Requirements

- **Node.js**: `v20.x` LTS (Specified in `.nvmrc`)
- **Package Manager**: `npm`
- **Database**: TiDB Cloud or another MySQL-compatible database

---

## ⚙️ Environment Variables

Create a `.env.local` file in the root directory:

```env
# TiDB Cloud MySQL connection string
DATABASE_URL=mysql://<USERNAME>:<PASSWORD>@<HOST>:4000/lonetracker?ssl=true
```

An example template is available in `.env.example`.

---

## 🗄️ Database Setup (TiDB Cloud)

Set `DATABASE_URL` in `.env.local` to your TiDB Cloud connection string. The Finance app
uses the `people`, `loans`, and `collections` tables in the selected database.

### 2. Apply Database Schema

For a new database, generate the tables from the Drizzle schema:

```bash
npm run db:push
```

Or apply the versioned migrations:

```bash
npm run db:migrate
```

When upgrading an existing database to include per-loan daily, weekly, or monthly
installment frequency, run once:

```bash
npm run db:migrate:frequency
```

Existing loans retain daily frequency as their default.

### 3. Seed Realistic Sample Data

To populate the database with realistic Indian loan records (borrowers with multiple loans, active and completed loans, and historical payment timestamps):

```bash
npm run db:seed
```

---

## 🚀 Local Development

1. Clone or open the repository:
   ```bash
   cd Finance
   ```
2. Verify Node.js version:
   ```bash
   node -v # Should be v20.x
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up `.env.local` with your `DATABASE_URL`.
5. Run migrations:
   ```bash
   npm run db:push
   ```
6. Start the development server:
   ```bash
   npm run dev
   ```
7. Open [http://localhost:3000](http://localhost:3000) on your desktop or open via your local Wi-Fi IP address on your mobile phone browser.

---

## 📦 Production Build & Verification

To verify that the application compiles without TypeScript or build issues:

```bash
npm run build
npm run start
```

---

## ☁️ Vercel Deployment

1. Push your repository to **GitHub**:
   ```bash
   git add .
   git commit -m "feat: complete mobile-first personal loan collection tracker"
   git push origin main
   ```
2. Go to [Vercel](https://vercel.com/) and click **Add New Project**.
3. Import your GitHub repository.
4. In **Environment Variables**, add:
   - `DATABASE_URL`: Your Supabase transaction pooler connection string (`pgbouncer=true`).
5. Click **Deploy**.
6. Once deployed, open the Vercel URL on your mobile browser.

---

## 📱 PWA Installation ("Add to Home Screen")

### On Android (Chrome / Edge / Samsung Internet):
1. Open the deployed website in Chrome.
2. Tap the three-dot menu (**⋮**) in the top right.
3. Tap **Add to Home screen** (or **Install App**).
4. An icon will appear on your home screen. Tapping it opens the app without browser chrome.

### On iOS (Safari):
1. Open the deployed website in Safari.
2. Tap the **Share** button (box with an upward arrow) in the bottom toolbar.
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**. The app icon will appear alongside your native apps.

---

## 🔒 Security & Scope Limitations

- **Single-User Scope**: This application is intentionally single-user with no authentication for Version 1. It is meant to be used on the owner's personal device.
- **Deployment Recommendation**: For internet deployments, consider adding Vercel Deployment Protection (Password Protection) or Cloudflare Access until user authentication is introduced.
- **Database Safety**: Drizzle queries are parameterized, preventing SQL injection vulnerabilities. All financial mutations execute in controlled server actions with mathematical bounds checking.

---

## 🧭 Future-Ready Architecture

The code separates database queries (`lib/db/`), validation (`lib/validations/`), services (`lib/services/`), Server Actions (`app/actions/`), and UI components (`components/`). This makes it straightforward to add future capabilities without refactoring core logic:
- User authentication & multi-tenant tenancy
- Cloud backup & CSV / Excel export
- WhatsApp payment receipts / reminders
- PDF statement generation
