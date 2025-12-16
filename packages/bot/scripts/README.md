# Scripts

This directory contains utility scripts for the HalaqaBot project.

## Export Users to CSV

The `export-users-csv.ts` script exports all users from the database to a CSV file.

### Usage

```bash
# From the bot package directory
CONVEX_URL=<your-convex-url> bun run scripts/export-users-csv.ts
```

### Output

- Creates an `exports/` directory in the current working directory if it doesn't exist
- Generates a CSV file named `users-export-<timestamp>.csv`
- The CSV includes the following columns:
  - `userId`: Telegram user ID
  - `username`: Telegram username (@username)
  - `telegramName`: Concatenation of firstName + lastName from Telegram
  - `realName`: AI-detected name from messages
  - `realNameVerified`: Whether the real name has been verified
  - `sourceMessageText`: The message text from which realName was detected
  - `updatedAt`: Timestamp in milliseconds when the record was last updated

### Example Output

```
userId,username,telegramName,realName,realNameVerified,sourceMessageText,updatedAt
123456789,john_doe,John Doe,محمد أحمد,,أنا محمد أحمد,1702834567890
987654321,jane_smith,Jane Smith,فاطمة الزهراء,true,فاطمة الزهراء حاضرة,1702834567891
```

### CSV Formatting

- Fields containing commas, quotes, or newlines are automatically wrapped in quotes
- Internal quotes are escaped by doubling them
- Empty/null values are represented as empty fields
