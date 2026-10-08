# TrueLove App: App Store Payment Policy, Fee Structure & Launch Guide

**Document Purpose:** Executive Client Guide on Payment Processing, Store Fees, Creator Payouts & Launch Compliance  
**Applicable Platforms:** Google Play Store (Android) & Apple App Store (iOS)  
**Target Market:** India (INR ₹) & Global  
**Date:** October 2026  

---

## 1. Executive Summary

Mobile platforms enforce strict guidelines regarding how in-app digital items (such as virtual coins, gifts, and VIP subscriptions) are purchased. To ensure **guaranteed store approval and zero risk of account suspension**, the application uses a dual payment architecture:

1. **Incoming User Payments (In-App Purchases / IAP)**: Handled directly by **Google Play Billing** (Android) and **Apple App Store** (iOS).
   - Covers: Truelove Coins, Plus Subscriptions, Gold VIP Subscriptions, Profile Boosts, and Call Minute Passes.
   - Fee: **15%** for eligible small businesses and new developer accounts (reduced from 30%).
2. **Outgoing Creator Withdrawals (Payouts)**: Handled via **Cashfree Payments / Direct UPI IMPS**.
   - Covers: Cash withdrawals when verified users/creators redeem earnings received from virtual gifts.
   - Store stores do not participate in or restrict creator payouts.

---

## 2. Google Play Store Fee Structure

### The 15% Google Play Service Fee Tier
Google charges developers a fee on digital goods sold inside Android apps. Under Google's **15% Service Fee Tier**:
* Every developer account qualifies for a **15% fee on the first $1,000,000 USD (~₹8.3 Crores INR)** of gross revenue earned each calendar year.
* Enrolling is a **1-click free registration** inside the Google Play Console.
* Only after gross earnings cross ₹8.3 Crores within a single year does the fee adjust to 30% for earnings exceeding that threshold.
* **Auto-renewing subscriptions** (Monthly and Quarterly VIP plans) are charged at **15% from Day 1**.

### What Does the 15% Fee Include?
Unlike traditional web payment gateways where the merchant pays 2% but must build fraud detection, manage disputed chargebacks, handle foreign exchange, and implement manual refund workflows, Google's 15% fee includes:
* **All Indian Payment Methods**: Google Pay, UPI, RuPay / Visa / Mastercard credit & debit cards, Netbanking, and Carrier Billing.
* **Zero Extra Gateway Fees**: You do not pay any separate gateway charges to Razorpay, Cashfree, or card networks for in-app transactions.
* **Automated Fraud & Chargeback Protection**: Google absorbs and resolves stolen card claims and bank disputes.
* **Subscription Engine**: Google manages recurring billing cycles, renewal attempts, payment retries for failed cards, and cancellation processing.
* **Direct Bank Settlements**: Google deposits net earnings directly into your registered Indian bank account on the 15th of every month.

---

## 3. Apple App Store Fee Structure (iOS Launch)

When expanding to the Apple App Store, Apple operates the **App Store Small Business Program**:
* Reduces Apple's standard 30% commission down to **15%** for all developers earning under $1,000,000 USD per year.
* The fee and settlement mechanism on iOS mirror Google Play, maintaining uniform 85% revenue retention across both platforms.

---

## 4. Revenue Realization Table (India - INR ₹)

The table below illustrates what you actually receive in your bank account for each plan in the app:

| Product / Plan | Retail Price (User Pays) | Google Store Fee (15%) | TDS (1% u/s 194O)* | Net Settlement to Your Bank | Your Margin |
|---|---|---|---|---|---|
| **Starter Pack (100 Coins)** | ₹99.00 | ₹14.85 | ₹0.99 | **₹83.16** | 84.0% |
| **Popular Bundle (250 Coins)** | ₹199.00 | ₹29.85 | ₹1.99 | **₹167.16** | 84.0% |
| **Best Value Bundle (700 Coins)** | ₹499.00 | ₹74.85 | ₹4.99 | **₹419.16** | 84.0% |
| **Truelove Plus (1 Month)** | ₹299.00 | ₹44.85 | ₹2.99 | **₹251.16** | 84.0% |
| **Truelove Plus (3 Months)** | ₹699.00 | ₹104.85 | ₹6.99 | **₹587.16** | 84.0% |
| **Truelove Gold VIP (1 Month)** | ₹499.00 | ₹74.85 | ₹4.99 | **₹419.16** | 84.0% |
| **Truelove Gold VIP (3 Months)** | ₹1,199.00 | ₹179.85 | ₹11.99 | **₹1,007.16** | 84.0% |

*\*Tax Note: The 1% Tax Deducted at Source (TDS) under Section 194O of the Indian Income Tax Act is deposited by Google directly to your PAN card. You can claim this 1% back or adjust it against your tax liability during your annual income tax filing.*

---

## 5. Creator Earnings & Payouts (Cash Withdrawals)

When creators receive gifts from other users, they accumulate a redeemable balance in their **Creator Wallet**.

### How Payouts Are Processed
1. **Google/Apple Rules**: Google and Apple policies apply strictly to *incoming purchases of digital goods*. They do not handle or restrict outgoing cash payouts to content creators or influencers.
2. **Launch Phase (Manual Payouts - Recommended)**:
   - When a creator taps *"Request Withdrawal"* in the app, their request (Amount, UPI ID, PAN Card) is securely recorded in the backend admin panel.
   - The administrator verifies the request and transfers the funds directly using UPI (Google Pay, PhonePe, or Netbanking).
   - The admin updates the transaction status to *"Completed"*, which updates the user's in-app passbook.
   - **Advantage**: Requires zero third-party payout API approvals on Day 1.
3. **Scaling Phase (Automated Payouts via Cashfree)**:
   - As transaction volume grows, **Cashfree Payouts** can be enabled to disburse money via IMPS/UPI API in under 2 seconds.

---

## 6. Business Registration for Solo Founders

You do **not** need to incorporate an expensive Private Limited company or LLP to launch.

### Recommended Path: Sole Proprietorship via Udyam (MSME)
* **Cost**: **100% Free** (Official Government Portal).
* **Setup Time**: 15 minutes online at `udyamregistration.gov.in`.
* **Requirements**: Founder's Aadhaar and PAN Card.
* **Trade Name**: Register under your preferred name (e.g., *Godiva Technologies* or *TrueLove Digital*).
* **Benefits**:
  1. Instantly provides an official Government Registration Certificate with a QR code.
  2. Enables opening a **Business Current Account** with any bank (HDFC, ICICI, SBI, Kotak).
  3. Qualifies your business for fast-track verification on Google Play Console and payment aggregators.

---

## 7. Mandatory Google Play Policy: The 20-Tester Rule ⚠️

For all **new Personal Google Play Developer accounts** created after November 2023, Google enforces a mandatory verification requirement:

* **What is required**: Before production release to the public Play Store, your app must be tested by at least **20 opted-in testers for 14 continuous days** in a closed test track.
* **How it works**:
  1. We upload the release build to the Google Play Console Closed Testing track.
  2. You invite 20 friends, team members, or community testers via email or link.
  3. Testers install the app and keep it on their devices for 14 days.
  4. Google reviews the testing data and unlocks the public production release button.
* *(Note: If you register Google Play as an **Organization** instead of Personal, this rule does not apply. However, an organization account requires an official D-U-N-S number, which takes 2–4 weeks to obtain).*

---

## 8. Profit Optimization: The Hybrid Web Top-Up Strategy

Leading social and dating applications (including Tinder, Bumble, Shaadi, and Spotify) maximize profit margins using a **Hybrid Strategy**:

```
┌────────────────────────────────────────────────────────┐
│                   IN-APP CHECKOUT                      │
│  • Google Play Billing (Android)                       │
│  • Fee: 15%                                            │
│  • Margin: ~84%                                        │
│  • 100% Google Play Policy Compliant                   │
└────────────────────────────────────────────────────────┘
                            ▲
                            │ Both channels sync to the
                            │ same user Truelove Coin balance
                            ▼
┌────────────────────────────────────────────────────────┐
│               OFFICIAL WEBSITE RECHARGE                │
│  • URL: trueloveapp.in/recharge                        │
│  • Cashfree / Razorpay Gateway                         │
│  • Fee: ~2%                                            │
│  • Margin: ~98%                                        │
│  • Offer user incentive: "Get 15% extra coins on Web"  │
└────────────────────────────────────────────────────────┘
```

1. **Inside the App**: Offer standard coin packs and VIP plans via Google Play Billing at the normal price.
2. **On the Web**: Provide a web recharge portal using Cashfree or Razorpay where users log in and purchase coins. Because the gateway fee is only ~2%, you can offer users bonus coins (e.g., 10% extra) while still retaining **98% of gross revenue**.

---

## 9. Launch Action Checklist

- [ ] **Step 1**: Register a free **Sole Proprietorship MSME Certificate** at `udyamregistration.gov.in` (15 mins).
- [ ] **Step 2**: Create a **Google Play Developer Account** at `play.google.com/console/signup` ($25 one-time fee).
- [ ] **Step 3**: Set up your **Google Payments Merchant Profile** inside the Play Console to link your bank account for monthly payouts.
- [ ] **Step 4**: Create a Closed Testing Track on Google Play and recruit 20 testers for the 14-day testing period.
- [ ] **Step 5**: Integrate production in-app purchasing SDK (`react-native-purchases` / RevenueCat) to connect the app with the Google Play billing catalog.
