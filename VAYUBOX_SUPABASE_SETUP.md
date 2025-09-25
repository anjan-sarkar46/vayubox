# Vayubox Supabase Database Setup

This guide will help you set up the Supabase database specifically for your Vayubox application.

## 🛠️ Setup Steps

### 1. Create New Supabase Project
1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project for your Vayubox application
3. Note down your project URL and anon key

### 2. Update Environment Variables
Update your `.env` file with the new Supabase credentials:
```env
# Vayubox Supabase Configuration
VITE_SUPABASE_URL=your_new_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_new_supabase_anon_key
```

### 3. Create Vayubox Activity History Table
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the SQL script from `src/database/vayubox_activity_history_table.sql`

### 4. Verify Table Creation
After running the SQL script, you should see:
- ✅ `vayubox_activity_history` table created
- ✅ Indexes created for performance
- ✅ Row Level Security (RLS) enabled
- ✅ Policies created for user data isolation

### 5. Test the Setup
1. Start your Vayubox application
2. Perform a file operation (upload/download)
3. Check the Supabase dashboard to see activity logged in `vayubox_activity_history`

## 🔒 Security Features

### Row Level Security (RLS)
The table uses RLS to ensure users can only access their own activity history:
- Users can view their own activities
- Users can insert their own activities  
- Users can update their own activities
- Users can delete their own activities

### Data Isolation
Each user's data is completely isolated using their Firebase Auth UID.

## 📊 Table Structure

The `vayubox_activity_history` table includes these Vayubox-specific fields:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | TEXT | Firebase Auth user ID |
| `user_email` | TEXT | User's email |
| `action` | TEXT | Activity type (Upload, Download, etc.) |
| `item_name` | TEXT | File/folder name |
| `file_size` | BIGINT | File size in bytes |
| `file_count` | INTEGER | Number of files affected |
| `folder_path` | TEXT | Parent folder path |
| `bucket_name` | TEXT | S3 bucket name (Vayubox specific) |
| `storage_class` | TEXT | S3 storage class |
| `metadata` | JSONB | Additional Vayubox metadata |
| `created_at` | TIMESTAMP | When activity occurred |
| `updated_at` | TIMESTAMP | Last modification time |

## 🚀 Vayubox-Specific Features

### Enhanced Metadata
The metadata field can store Vayubox-specific information:
```json
{
  "vayubox_session_id": "1632847200000",
  "restoration_tier": "Standard",
  "cost_impact": "0.05",
  "file_type": "image/jpeg",
  "transfer_duration": "2.5"
}
```

### Multi-Bucket Support
The `bucket_name` field allows tracking activities across different S3 buckets.

### Storage Class Tracking
Track which S3 storage class (STANDARD, GLACIER, DEEP_ARCHIVE) files are using.

## 🧪 Testing Queries

Test your setup with these sample queries:

### Get Recent Activities
```sql
SELECT * FROM vayubox_activity_history 
WHERE user_id = 'your_firebase_user_id' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Activity Summary by Action
```sql
SELECT 
    action,
    COUNT(*) as count,
    SUM(file_size) as total_size
FROM vayubox_activity_history 
WHERE user_id = 'your_firebase_user_id'
GROUP BY action;
```

### Storage Class Distribution
```sql
SELECT 
    storage_class,
    COUNT(*) as file_count,
    SUM(file_size) as total_size
FROM vayubox_activity_history 
WHERE user_id = 'your_firebase_user_id'
GROUP BY storage_class;
```

## 🔄 Migration from Old System

If you have data in the old `activity_history` table, the application includes a migration function that will:
1. Fetch old records
2. Transform them to the new Vayubox format
3. Insert into `vayubox_activity_history`
4. Add bucket and storage class information

The migration runs automatically when needed and is safe to run multiple times.