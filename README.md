`# EvoSecure CCTV Monitoring UI

Modern, elegant, and technological CCTV monitoring interface built with React and Tailwind CSS.

## Features

### Secure Login
- **Credential Verification**: Simulated backend verification.
- **Account Lockout**: Security measure that suspends access for 5 minutes after 3 consecutive failed attempts.
- **Session Management**: "Remember Me" functionality using LocalStorage.
- **Status Indicators**: Real-time feedback for wrong credentials or suspension status.

### Interactive Dashboard
- **Live Monitoring**: High-definition main player with real-time stream simulation.
- **Multi-Camera Support**: Thumbnail gallery for quick camera switching.
- **AI Analytics**:
  - **People Counting**: Aggregated daily traffic.
  - **Face Detection**: Activity indicator.
  - **Face Recognition**: Database matching counter.
- **Health Monitoring**: Real-time camera online/offline status.
- **Event Log**: Dynamic log of the 5 most recent system events.
- **Real-time Updates**: Data automatically refreshes without manual interaction.

## How to Run

1.  **Extract/Navigate** to the `EVOSecure` folder.
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Run development server**:
    ```bash
    npm run dev
    ```
4.  **Login Credentials**:
    - **Username**: `admin`
    - **Password**: `password123`

## Technical Stack
- **Framework**: React 18 (Vite)
- **Styling**: Tailwind CSS 3
- **Icons**: Lucide React
- **Routing**: React Router DOM v6
