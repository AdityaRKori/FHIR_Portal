# 🏥 AetherHealth FHIR Portal

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![FHIR R4](https://img.shields.io/badge/Standard-FHIR%20R4-firebrick)](http://hl7.org/fhir/)
[![Powered by Gemini](https://img.shields.io/badge/AI-Google%20Gemini-blue)](https://deepmind.google/technologies/gemini/)

> **A bridge between legacy healthcare data and modern AI-driven clinical insights.**

### [🚀 LAUNCH LIVE APP](https://your-app-url-here.com) 
*(Replace this link with your Vercel/Netlify deployment URL)*

---

## 📖 The Story: Why AetherHealth?

### The Problem: The Data Silo Crisis
Modern healthcare is drowning in data but starving for wisdom. 
1. **Fragmentation:** Patient data is scattered across legacy systems (using HL7 v2), Excel sheets from field clinics, and modern EHRs.
2. **Interoperability Gap:** Converting a paper form or a CSV row into a standardized HL7 FHIR resource is technically complex and error-prone.
3. **Information Overload:** Clinicians spend more time connecting dots between vital signs and history than actually diagnosing the patient.

### The Solution
AetherHealth is a **Next-Generation Interoperability Portal** designed to ingest data from low-tech sources (like Google Sheets/Forms), convert it into the robust **FHIR R4 standard**, and immediately apply **Generative AI** to produce clinical summaries and triage recommendations.

---

## ⚡ Key Features

### 1. Smart Data Ingestion (CSV -> HL7 -> FHIR)
We recognize that real-world data collection is messy. 
- **Universal Form Adapter:** The system connects directly to Google Sheets (Published CSVs).
- **Smart Header Detection:** It uses fuzzy matching to understand columns like "What is your MRN?" or "Current Temp" without strict formatting requirements.
- **ID Matching Logic:** Automatically detects if a patient exists. If the ID matches, it **updates** the record (merging new vitals) rather than creating duplicates.

### 2. Generative AI Clinical Insights
Powered by **Google Gemini 2.5 Flash**, the application:
- Reads the complex FHIR JSON bundle.
- Analyzes vitals trends (Heart Rate, Temperature).
- **Generates a narrative clinical summary** (e.g., *"Patient shows signs of tachycardia consistent with reported fever..."*).
- Suggests a **Triage Priority (P1-P4)** based on the data.

### 3. Hybrid Data Architecture
- **Local Store:** A simulated, browser-based FHIR store for privacy-first, offline-capable demos.
- **Public Interoperability:** Can switch modes to search the **HAPI FHIR Public Server**, demonstrating real-world interoperability.

---

## 📸 Interface & Architecture

### The Dashboard (Triage Board)
*A real-time view of active patients, color-coded by AI-suggested triage levels.*

![Dashboard Preview](./public/dashboard-screenshot.png)
*(Place a screenshot of your dashboard here named dashboard-screenshot.png)*

### The Clinical View
*Detailed breakdown of patient history, combining AI insights with raw FHIR JSON data availability.*

![Clinical View](./public/clinical-screenshot.png)
*(Place a screenshot of the patient detail page here named clinical-screenshot.png)*

---

## 🛠️ Technical Implementation

### Tech Stack
- **Frontend:** React 19, TailwindCSS, Lucide Icons.
- **Visualization:** Recharts for vital sign trending.
- **AI Engine:** Google GenAI SDK (`@google/genai`).
- **Standards:** HL7 v2.5 (Simulated pipeline) & FHIR R4.

### The Pipeline
1. **Input:** User submits a Google Form (e.g., Triage Form).
2. **Ingestion:** React app fetches the published CSV.
3. **Translation:** 
   - Converts CSV row → **HL7 v2.5 String** (ADT^A01).
   - Parses HL7 → **FHIR R4 JSON** (Patient, Encounter, Observation resources).
4. **Storage:** Upserts data into the Local Store.
5. **Analysis:** Gemini AI reads the new resources and updates the dashboard.

---

## 🚀 How to Run

1. **Clone the repository**
2. **Install Dependencies:**
   ```bash
   npm install
   ```
3. **Configure API Key:**
   Create a `.env` file and add your Google Gemini API Key:
   ```env
   API_KEY=your_google_ai_studio_key
   ```
4. **Start the App:**
   ```bash
   npm start
   ```

---

## 🔮 Future Roadmap
- [ ] **Wearable Integration:** Direct API hooks for Apple Watch / Fitbit data.
- [ ] **Voice-to-FHIR:** Using Gemini Live API to transcribe doctor notes directly into ClinicalImpressions.
- [ ] **Backend Persistence:** Moving from LocalStorage to a real FHIR Server (Firely or Google Cloud Healthcare API).

---

*Built with ❤️ for the future of Digital Health.*
