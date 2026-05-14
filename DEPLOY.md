# CurtainAI — Vercel 部署指南

## 部署步驟

### 方法一：直接上傳（最簡單）

1. 前往 https://vercel.com 並登入（可用 GitHub 帳號）
2. 點擊「Add New → Project」
3. 選擇「Upload」分頁
4. 將整個 curtainai_vercel 資料夾拖入上傳
5. 點擊「Deploy」
6. 等待約 30 秒，取得網址（如 curtainai.vercel.app）

### 方法二：GitHub 部署（推薦，可持續更新）

1. 在 GitHub 建立新 Repo，上傳此資料夾的檔案
2. 前往 https://vercel.com，連結 GitHub Repo
3. 自動部署，每次 push 都會更新

## 部署後設定

取得 Vercel 網址後（如 https://curtainai.vercel.app），
綠界付款回跳將自動運作，無需任何手動操作。

## 正式上線

將 index.html 內的綠界設定改為正式帳號：
- epMid: '3284269'
- epKey: 'gBCJdoaEH2KoKy9I'  
- epIV:  'nh560aL1nsQxNb8i'
- epUrl: 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5'

