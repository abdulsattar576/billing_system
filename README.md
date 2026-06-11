# Cable Management System

A desktop-based application built with **Next.js + Electron** to help local cable operators manage customer records, billing, receipts, and reporting efficiently — with full **offline support using CouchDB + PouchDB**.

---

## 📌 Project Overview

This system is designed for local cable / TV network providers to manage:

* Customer records
* Connection areas
* Monthly billing & receipts
* Cash received tracking
* Debit / Credit management
* Reports & summaries
* Real-time dashboard overview

The application works both online and offline using **PouchDB (client)** and **CouchDB (server sync)**.

It is packaged as a **desktop application using Electron.js** after production build.

---

## 🚀 Tech Stack

* Next.js (Frontend + App Router)
* Electron.js (Desktop wrapper)
* Node.js
* PouchDB (Offline database)
* CouchDB (Remote sync database)
* TypeScript (optional depending on setup)

---

## ⚙️ Prerequisites

Before running this project, install the following:

### 1. Node.js

Download LTS version:
https://nodejs.org/

Check installation:

```bash id="nodecheck"
node -v
npm -v
```

---

### 2. CouchDB (Required for sync)

Install CouchDB:
https://couchdb.apache.org/

Default setup:

* URL: http://127.0.0.1:5984
* Admin panel: http://127.0.0.1:5984/_utils

Create database:

```bash id="couchdbsetup"
cable_management
```

---

## 📥 Installation

Clone the repository:

```bash id="clone"
git clone https://github.com/your-username/cable-management-system.git
cd cable-management-system
```

Install dependencies:

```bash id="install"
npm install
```

---

## ▶️ Development Server

Run the Next.js app:

```bash id="dev"
npm run dev
```

Open:
http://localhost:3000

---

## 🖥️ Desktop App (Electron)

To build the desktop application:

```bash id="build"
npm run build
```

After build, Electron will package the app into a desktop executable.

To run Electron app:

```bash id="electron"
npm run electron
```

---

## 📡 Offline & Sync System

This project uses:

### PouchDB (Client Side)

* Stores data locally in browser/desktop
* Works offline without internet

### CouchDB (Server Side)

* Syncs data when internet is available
* Keeps data consistent across devices

---

## 🔐 Authentication System

The system includes:

* User login/logout
* Protected routes
* Role-based access (Admin / Operator)
* Session persistence

---

## 📊 Key Features

### 👥 Customer Management

* Add / edit / delete customers
* Track active/inactive connections

### 📍 Area Management

* Define service areas
* Assign customers to specific regions

### 💰 Billing System

* Monthly invoice generation
* Payment tracking
* Receipt generation

### 📉 Debit / Credit System

* Track outstanding payments
* Maintain financial records

### 🧾 Reports

* Daily / monthly income reports
* Customer payment history
* Area-wise analytics

### 📌 Dashboard

* Total customers
* Active connections
* Revenue summary
* Pending payments overview

---

## 🏗️ Build for Production

```bash id="prod"
npm run build
```

This will:

* Build Next.js project
* Prepare Electron wrapper
* Generate desktop application package

---

## 📁 Project Structure

```
/app
/components
/lib
/db (PouchDB setup)
/electron
/pages (if used)
/public
```

---

## 🚀 Deployment

* Web version: Deploy using Vercel
* Desktop version: Electron build executable

---

## 📚 Learn More

* https://nextjs.org/docs
* https://www.electronjs.org/docs
* https://pouchdb.com/
* https://couchdb.apache.org/

---

## 📄 License

This project is for educational and commercial local-business use.
