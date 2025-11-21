# CLMS Librarian Setup Guide

This guide explains how to set up the Library Management System on the Librarian's PC.

## 1. One-Time Setup (Do this once)

1.  **Install Docker Desktop**
    - Download and install Docker Desktop for Windows.
    - Start Docker Desktop and ensure it is running.

2.  **Install Git**
    - Download and install Git for Windows.

3.  **Place the Folder**
    - Copy the `CLMS` folder to the Desktop (or any preferred location).

## 2. Daily Usage (For the Librarian)

To start the system, simply double-click the **`CLMS_LAUNCHER.bat`** file.

**What happens automatically:**

1.  **Checks for Updates:** The system connects to the internet to see if there is a new version of the software.
2.  **Auto-Update:** If a new version is found, it automatically downloads it and updates the system.
3.  **Starts System:** It turns on the Database and the Application.
4.  **Opens Browser:** It automatically opens Chrome/Edge to the Library Dashboard.

## 3. Troubleshooting

- **"Docker is not running"**: Make sure the Docker Desktop whale icon is visible in your taskbar.
- **Updates Failed**: Check your internet connection. The system will still start the old version if it can't update.
