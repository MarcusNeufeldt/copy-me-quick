# Turso Database Setup Guide

This application now uses [Turso](https://turso.tech/) as its database backend for storing user projects and settings.

## Quick Setup

1. **Install Turso CLI**
   ```bash
   # On Windows (PowerShell)
   irm https://get.turso.tech/windows | iex
   
   # On macOS/Linux
   curl -sSfL https://get.turso.tech/install.sh | bash
   ```

2. **Sign up and authenticate**
   ```bash
   turso auth signup
   turso auth login
   ```

3. **Create a database**
   ```bash
   turso db create copy-me-quick
   ```

4. **Get your database URL**
   ```bash
   turso db show copy-me-quick
   ```
   Copy the URL from the output.

5. **Create an auth token**
   ```bash
   turso db tokens create copy-me-quick
   ```
   Copy the token from the output.

6. **Set up environment variables**
   Create a `.env.local` file in your project root:
   ```env
   TURSO_DATABASE_URL=your_database_url_here
   TURSO_AUTH_TOKEN=your_auth_token_here
   
   # Your existing GitHub OAuth variables
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   ```

7. **Start the application**
   ```bash
   npm run dev
   ```

The database schema will be automatically created when you first run the application.

## What Changed

- **User data is now persistent** across devices and browsers
- **Project settings are stored in the database** instead of localStorage
- **GitHub filter settings are global** and tied to your GitHub account
- **No more localStorage sync issues** - everything is handled server-side

## Database Schema

The application creates two main tables:

### `users`
- Stores GitHub user information
- Stores global GitHub filter preferences
- Automatically created when you first log in

### `projects`
- Stores project metadata (name, type, settings)
- Links to GitHub repos or local project configurations
- Tracks last accessed time for recent projects list

## Benefits

1. **Reliability**: No more localStorage corruption or sync issues
2. **Persistence**: Your projects and settings are saved across devices
3. **Performance**: Faster loading and better user experience
4. **Scalability**: Can handle many users and projects efficiently

## Migration

If you had projects in the old localStorage system, you'll need to re-add them after the upgrade. The new system is much more reliable and will prevent the filter state issues you were experiencing. 