# <img src="./klaimKavach/public/logo.jpg" alt="KlaimKavach Logo" width="40" height="40"> KlaimKavach – Smart Income Protection for Gig Workers

> **Real-time AI-powered parametric insurance that protects gig workers from income loss — instantly, intelligently, and fairly.**

---

## 📌 About the Project

**KlaimKavach** is an AI-powered parametric insurance platform designed to protect gig workers (delivery partners) from income loss caused by external disruptions such as weather, pollution, traffic, and social events.

Unlike traditional insurance systems, KlaimKavach provides **instant, automated payouts** based on real-time conditions, while ensuring **fraud resistance** through advanced anti-spoofing mechanisms.

---

## 💡 Inspiration

- Gig workers lose **20–30% of their income** due to uncontrollable external factors
- No system currently protects their daily/weekly earnings
- Fraudsters exploit such systems using GPS spoofing

We wanted to build a platform that is:

- ⚡ **Instant** — zero-touch claim processing
- 🤖 **Intelligent** — AI-driven decisions
- 🔐 **Fraud-resistant** — multi-signal anti-spoofing
- ⚖️ **Fair** — honest workers are always protected

---

## ⚙️ What It Does

KlaimKavach provides a real-time income protection system built on **three intelligent layers**:

### ⚡ 1. Smart Income Protection
- Weekly subscription model (**₹49–₹99/week**)
- Covers income loss due to:
  - 🌧️ Heavy rain
  - 🌫️ High pollution (AQI)
  - 🚧 Traffic disruptions
- When a disruption occurs → **automatic payout** (no claim required)

### 🤖 2. AI Decision Engine
- Calculates **Risk Score** → dynamic pricing
- Detects real-time disruptions
- Estimates income loss
- Triggers automated payouts

### 🛡️ 3. Anti-Fraud Intelligence Layer *(Key Differentiator)*
- Multi-signal verification (beyond just GPS)
- **Trust Score Engine** (0–100)
- Group fraud detection for coordinated attacks

---

## 🏗️ System Architecture

KlaimKavach is built as a **real-time, event-driven** system.

### 📊 Detailed Architecture Flowchart

<img src="./klaimKavach/public/images/KlaimKavach_architecture.png" alt="KlaimKavach Architecture">

> *End-to-end flow: from subscription to payout — including AI trigger detection, fraud validation, and trust-based decision routing.*

### 🔄 System Flow

```python
START
User → Subscribe Weekly Plan

WHILE (system active):
    data = fetch(Weather, AQI, Traffic)

    IF trigger_detected(data):

        risk, loss = AI_Engine(data, user_profile)
        trust_score = Fraud_Engine(
            GPS,
            IP,
            Sensors,
            user_history
        )

        IF trust_score ≥ HIGH_TRUST_THRESHOLD:
            payout(user, loss)        # instant 💸

        ELSE IF LOW_TRUST_THRESHOLD ≤ trust_score < HIGH_TRUST_THRESHOLD:
            verify(user)              # photo / delay

        ELSE:
            flag(user)                # possible fraud 🚨

    ELSE:
        continue_monitoring()
END
```

### ⚡ Parametric Triggers

KlaimKavach uses predefined thresholds for automatic, zero-touch payouts:

| Trigger | Threshold | Action |
|--------|-----------|--------|
| Rainfall | > 40mm | Payout |
| Air Quality Index | > 300 | Payout |
| Traffic Index | > Threshold | Payout |

---

## 🤖 AI Components

| Component | Role |
|-----------|------|
| Risk Prediction Model | Determines pricing based on user & location data |
| Disruption Detection Engine | Detects real-time environmental events |
| Fraud Detection Model | Identifies anomalous claim patterns |
| Trust Score Engine | Adaptive decision-making per user |

---

## 🛡️ Adversarial Defense & Anti-Spoofing Strategy

### 🚨 The Problem
Users may fake GPS locations to trigger false payouts.

### 🧠 How KlaimKavach Differentiates Real vs. Fake

- Movement pattern analysis
- Weather vs. location mismatch detection
- Sensor-based validation (accelerometer, speed)
- Unrealistic travel detection

### 📊 Multi-Source Data Validation

| Signal | Source |
|--------|--------|
| 📍 Location | GPS data |
| 🌐 Network | IP / network metadata |
| 📱 Device | Accelerometer & sensors |
| 🌦️ Environment | Weather APIs |
| 📊 Behavior | Historical user patterns |
| 👥 Social | Group fraud pattern detection |

### 🧠 Trust Score Engine

Each user receives a dynamic Trust Score (0–100):

| Trust Level | System Action |
|-------------|---------------|
| 🟢 High | Instant payout ⚡ |
| 🟡 Medium | Light verification |
| 🔴 Low | Strict checks 🚨 |

### ⚖️ Fair UX Guarantee

- ❌ No instant rejections
- Suspicious claims are **flagged, not denied**
- Additional verification options:
  - 📸 Photo proof
  - ⏳ Short delay
- **Honest users are always protected**

---

## 💰 Pricing Model

Weekly plans priced at **₹49–₹99**, based on:
- Risk score
- Location zone
- Historical disruption data

| Zone | Weekly Price |
|------|-------------|
| 🔴 High-risk | ₹99/week |
| 🟡 Medium-risk | ₹69/week |
| 🟢 Low-risk | ₹49/week |

---

## ⚙️ Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| 💻 Frontend | React.js | User interface for delivery partners |
| 🧠 Backend | Node.js (Express.js) | API handling, system orchestration |
| 🧠 AI Decision Engine | Rule-based intelligent scoring (Node.js) | Real-time risk scoring using environmental signals |
| 🛡️ Anti-Fraud Intelligence | Heuristic + multi-signal verification | Trust score, anomaly detection, group fraud detection |
| 🌧️ Weather API | OpenWeatherMap API | Detect rainfall, temperature disruptions |
| 🌫️ AQI API | OpenAQ / OpenWeather Air API | Monitor air quality (AQI triggers) |
| 🚧 Traffic API | TomTom API | Detect traffic congestion & road issues |
| 📍 IP Geolocation | IPinfo / ip-api | Detect location mismatch (anti-spoofing) |
| 📱 Device Sensors | GPS, Accelerometer | Movement & behavior validation |
| 💸 Payments | Razorpay (Test Mode) | Simulated instant payouts |
| 🗄️ Database | MongoDB / Firebase | Store users, claims, risk & trust scores |
| ☁️ Deployment | Vercel / Flip.io | Hosting frontend & backend |

---

## 🚧 Challenges We Ran Into

- Detecting fraud beyond GPS spoofing
- Designing a real-time, event-driven system at scale
- Balancing fraud prevention with seamless user experience
- Handling and validating multiple external data sources

---

## 🏆 Accomplishments We're Proud Of

- ✅ Built a parametric insurance model tailored for gig workers
- ✅ Designed a multi-layer fraud detection system
- ✅ Developed a trust-based adaptive payout engine
- ✅ Achieved the right balance between automation and fairness

---

## 📚 What We Learned

- Real-world AI systems require **multi-signal validation**, not single-point checks
- Fraud prevention is **critical** in any financial automation system
- System design quality matters as much as the core idea
- UX fairness builds long-term trust in automated platforms

---

## 🔮 What's Next for KlaimKavach

- 🧠 Advanced ML models for **predictive risk analysis**
- 💳 Real payment integration (UPI, bank accounts)
- 🤝 Partnerships with delivery platforms (Swiggy, Zomato, Blinkit)
- 🚀 Expansion to other gig sectors (freelancers, auto drivers, etc.)

---

## 🏁 Final Note

> KlaimKavach is not just an insurance system —
> it is a **real-time AI decision platform** that protects livelihoods while ensuring fairness and fraud resistance.

---

*🔧 Built by Bit Benders.*
