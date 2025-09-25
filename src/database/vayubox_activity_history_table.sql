-- =====================================================
-- SUPABASE TABLE SCHEMA FOR VAYUBOX ACTIVITY HISTORY
-- =====================================================

-- Create the vayubox_activity_history table
-- This table will store all file management activities for Vayubox Cloud Storage Manager

CREATE TABLE IF NOT EXISTS vayubox_activity_history (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- User identification (from Firebase Auth)
    user_id TEXT NOT NULL,
    user_email TEXT,
    
    -- Activity details
    action TEXT NOT NULL CHECK (action IN ('Upload', 'Download', 'Delete', 'Rename', 'Move', 'Restore')),
    item_name TEXT NOT NULL,
    
    -- File/folder metadata
    file_size BIGINT DEFAULT 0,
    file_count INTEGER DEFAULT 1,
    folder_path TEXT,
    
    -- Vayubox-specific metadata
    bucket_name TEXT,
    storage_class TEXT DEFAULT 'STANDARD',
    
    -- Additional metadata (JSON format for extensibility)
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vayubox_activity_user_id ON vayubox_activity_history(user_id);
CREATE INDEX IF NOT EXISTS idx_vayubox_activity_created_at ON vayubox_activity_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vayubox_activity_action ON vayubox_activity_history(action);
CREATE INDEX IF NOT EXISTS idx_vayubox_activity_user_created ON vayubox_activity_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vayubox_activity_bucket ON vayubox_activity_history(bucket_name);

-- Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_vayubox_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update the updated_at column
CREATE OR REPLACE TRIGGER update_vayubox_activity_updated_at
    BEFORE UPDATE ON vayubox_activity_history
    FOR EACH ROW
    EXECUTE FUNCTION update_vayubox_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE vayubox_activity_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for Vayubox
-- Users can only see their own activities
CREATE POLICY "Vayubox users can view own activity history" ON vayubox_activity_history
    FOR SELECT USING (auth.uid()::text = user_id);

-- Users can insert their own activities
CREATE POLICY "Vayubox users can insert own activity history" ON vayubox_activity_history
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own activities (if needed)
CREATE POLICY "Vayubox users can update own activity history" ON vayubox_activity_history
    FOR UPDATE USING (auth.uid()::text = user_id);

-- Users can delete their own activities (for clear history functionality)
CREATE POLICY "Vayubox users can delete own activity history" ON vayubox_activity_history
    FOR DELETE USING (auth.uid()::text = user_id);

-- =====================================================
-- VAYUBOX TABLE STRUCTURE EXPLANATION
-- =====================================================

/*
COLUMN DESCRIPTIONS:

id: UUID primary key for unique record identification
user_id: Firebase Auth user ID to associate activities with specific Vayubox users
user_email: User's email address for easier identification (optional)
action: Type of activity (Upload, Download, Delete, Rename, Move, Restore)
item_name: Name of the file or folder being acted upon
file_size: Size of the file in bytes (0 for folders)
file_count: Number of files affected (1 for single file, multiple for folders)
folder_path: Path of the parent folder in Vayubox storage structure
bucket_name: S3 bucket name used for this activity (Vayubox specific)
storage_class: S3 storage class (STANDARD, GLACIER, DEEP_ARCHIVE, etc.)
metadata: JSON field for storing additional Vayubox information like:
  - file_type: File extension or type
  - transfer_duration: Time taken for upload/download
  - error_details: Error information if operation failed
  - client_info: Browser/device information
  - restoration_tier: For Glacier restores (Expedited, Standard, Bulk)
  - cost_impact: Estimated cost for the operation
  - vayubox_session_id: Session tracking for analytics
created_at: When the activity occurred
updated_at: When the record was last modified

INDEXES:
- idx_vayubox_activity_user_id: Fast lookup by user
- idx_vayubox_activity_created_at: Fast sorting by date (newest first)
- idx_vayubox_activity_action: Fast filtering by action type
- idx_vayubox_activity_user_created: Composite index for user + date queries
- idx_vayubox_activity_bucket: Fast filtering by bucket name

RLS POLICIES:
- Ensures Vayubox users can only access their own activity history
- Provides secure multi-tenant architecture for Vayubox platform
*/

-- =====================================================
-- SAMPLE VAYUBOX QUERIES
-- =====================================================

-- Get recent Vayubox activities for a user (ordered by newest first)
-- SELECT * FROM vayubox_activity_history 
-- WHERE user_id = 'firebase_user_id' 
-- ORDER BY created_at DESC 
-- LIMIT 50;

-- Get activities by action type in Vayubox
-- SELECT * FROM vayubox_activity_history 
-- WHERE user_id = 'firebase_user_id' AND action = 'Upload' 
-- ORDER BY created_at DESC;

-- Get total file size managed through Vayubox by user
-- SELECT SUM(file_size) as total_uploaded 
-- FROM vayubox_activity_history 
-- WHERE user_id = 'firebase_user_id' AND action = 'Upload';

-- Get Vayubox activity statistics
-- SELECT 
--     action,
--     COUNT(*) as count,
--     SUM(file_size) as total_size,
--     SUM(file_count) as total_files
-- FROM vayubox_activity_history 
-- WHERE user_id = 'firebase_user_id'
-- GROUP BY action;

-- Get activities by storage class (Vayubox specific)
-- SELECT 
--     storage_class,
--     action,
--     COUNT(*) as count,
--     SUM(file_size) as total_size
-- FROM vayubox_activity_history 
-- WHERE user_id = 'firebase_user_id'
-- GROUP BY storage_class, action;

-- Get bucket-wise activity summary (Vayubox multi-bucket support)
-- SELECT 
--     bucket_name,
--     action,
--     COUNT(*) as activity_count,
--     SUM(file_size) as total_data_size
-- FROM vayubox_activity_history 
-- WHERE user_id = 'firebase_user_id'
-- GROUP BY bucket_name, action
-- ORDER BY bucket_name, activity_count DESC;