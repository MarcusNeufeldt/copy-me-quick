# Alternative Turso Setup (Without CLI)

Since we're having network issues with the CLI installation, here's how to set up Turso using the web interface:

## Web-Based Setup

1. **Go to Turso Dashboard**
   - Visit: https://turso.tech/
   - Click "Sign Up" and create an account using GitHub

2. **Create a Database**
   - Once logged in, click "Create Database"
   - Name it: `copy-me-quick`
   - Choose the region closest to you
   - Click "Create"

3. **Get Database URL**
   - Click on your `copy-me-quick` database
   - Copy the "Database URL" (starts with `libsql://`)

4. **Create Auth Token**
   - In the database dashboard, go to "Settings" tab
   - Click "Create Token"
   - Copy the generated token

5. **Set Up Environment Variables**
   Create a `.env.local` file in your project root:
   ```env
   TURSO_DATABASE_URL=libsql://copy-me-quick-[your-username].turso.io
   TURSO_AUTH_TOKEN=your_auth_token_here
   
   # Your existing GitHub OAuth variables
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   ```

6. **Test the Setup**
   ```bash
   npm run dev
   ```

## What Happens Next

1. When you first run the app and log in with GitHub, the database schema will be automatically created
2. Your user record will be created in the `users` table
3. As you create projects, they'll be stored in the `projects` table
4. All your filter settings will be persistent across sessions

## Verify It's Working

1. Start the app: `npm run dev`
2. Go to `http://localhost:3000`
3. Log in with GitHub
4. Check the browser console - you should see "Database schema initialized successfully"
5. Try creating a project or changing filters - everything should persist after page refresh

## Database Management

You can view and manage your data through the Turso web dashboard:
- Go to your database in the Turso dashboard
- Click "Query" tab to run SQL queries
- View your tables: `SELECT * FROM users;` and `SELECT * FROM projects;`

This approach is actually easier than the CLI for getting started! 