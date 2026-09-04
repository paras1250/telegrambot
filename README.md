# Telegram Auto-Join System - Free Cloud Deployment Guide

This application is ready to be hosted **100% for FREE** online using **Render** and a free **Neon PostgreSQL** database.

---

## Step 1: Create a Free Cloud Database (Neon.tech)

1. Go to [Neon.tech](https://neon.tech) and sign up for a **Free Account**.
2. Click **Create Project** (e.g. name it `telegram-autojoin-db`).
3. Once created, copy your **PostgreSQL Connection String**. It looks like:
   `postgresql://username:password@ep-something.aws.neon.tech/neondb?sslmode=require`

---

## Step 2: Deploy to Render.com (100% Free)

1. Push this project folder (`telegram-auto-join`) to your **GitHub** repository.
2. Sign up / Log in to [Render.com](https://render.com).
3. Click **New +** -> **Web Service**.
4. Connect your GitHub repository.
5. Set the settings:
   - **Name**: `telegram-auto-join`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`

6. Scroll down to **Environment Variables** and add:
   - `BOT_TOKEN`: `8993187646:AAFrKqtVmKI6H_yjFs9BVV3dfhrWqwtZxuM`
   - `CHANNEL_ID`: `-1004360087475`
   - `DATABASE_URL`: *(Paste your Neon.tech Connection String from Step 1)*
   - `WEBHOOK_URL`: `https://your-render-app-name.onrender.com` *(Replace with your actual Render URL after creation)*

7. Click **Create Web Service**.

---

## Local Development

To run locally on your own computer:
```bash
node server.js
```
It will automatically connect to local SQLite (`database.sqlite`) and run in Polling mode without needing `DATABASE_URL` or `WEBHOOK_URL`!
