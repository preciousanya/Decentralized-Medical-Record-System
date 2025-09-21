# 🩺 Decentralized Medical Record System

Welcome to a revolutionary decentralized medical record system built on the Stacks blockchain! This project empowers patients to control their medical data, ensures secure sharing with healthcare providers, and enhances interoperability across systems while maintaining privacy.

## ✨ Features

🔒 **Patient-Controlled Data**: Patients own and manage their medical records using cryptographic keys.  
🔐 **Granular Access Control**: Grant or revoke access to specific records for doctors or institutions.  
📜 **Immutable Audit Trail**: Track all data access and modifications with timestamps.  
🔄 **Interoperability**: Standardized data formats for seamless sharing across healthcare providers.  
🩺 **Emergency Access**: Secure emergency access to critical medical data.  
📊 **Data Verification**: Ensure data integrity with hash-based verification.  
💸 **Incentivized Data Sharing**: Patients can opt into anonymized data sharing for research with token rewards.

## 🛠 How It Works

**For Patients**  
- Register on the platform with `PatientRegistry` to create a unique patient profile.  
- Add medical records (e.g., lab results, prescriptions) using `MedicalRecord`.  
- Generate a SHA-256 hash of each record for integrity verification.  
- Grant or revoke access to specific records using `AccessControl`.  
- Opt into anonymized data sharing for research via `ResearchDataPool` and earn tokens.  
- Set emergency access permissions with `EmergencyAccess` for critical situations.

**For Healthcare Providers**  
- Register as a provider using `ProviderRegistry`.  
- Request access to patient records via `AccessControl`.  
- Verify record integrity using `RecordVerification`.  
- Access emergency data in critical situations with `EmergencyAccess`.  

**For Researchers**  
- Access anonymized datasets through `ResearchDataPool`.  
- Pay tokens to access aggregated data for medical research.  

**Audit and Compliance**  
- Use `AuditTrail` to view immutable logs of all data access and modifications.  
