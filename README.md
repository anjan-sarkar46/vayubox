# Vayubox - Cloud Storage Manager

A modern React-based cloud storage management application for AWS S3 with advanced features like file management, Glacier archiving, and comprehensive activity tracking.

![Vayubox](https://img.shields.io/badge/Vayubox-Cloud%20Storage-F8C406?style=for-the-badge)
![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react)
![AWS](https://img.shields.io/badge/AWS-S3%20%7C%20Glacier-FF9900?style=for-the-badge&logo=amazon-aws)
![Firebase](https://img.shields.io/badge/Firebase-Auth-FFCA28?style=for-the-badge&logo=firebase)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase)

## 🌟 Features

- **📁 File Management**: Upload, download, organize files and folders in AWS S3
- **❄️ Glacier Integration**: Cost-effective long-term storage with automated archiving
- **🔄 File Restoration**: Seamless restoration from Glacier storage classes
- **📊 Activity Tracking**: Comprehensive logging of all operations via Supabase
- **🔐 Secure Authentication**: Firebase-powered user authentication
- **📱 Responsive Design**: Modern UI with Bootstrap 5 and custom Vayubox styling
- **⚡ Performance**: Multipart uploads, lazy loading, and optimized transfers

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- AWS Account with S3 access
- Firebase project
- Supabase account

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/anjan-sarkar46/vayubox.git
   cd vayubox
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment setup:**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables:**
   ```env
   # AWS Configuration
   VITE_BUCKET_NAME=your-s3-bucket
   VITE_REGION=your-aws-region
   VITE_ACCESS_KEY_ID=your-access-key
   VITE_SECRET_KEY=your-secret-key
   
   # Firebase Configuration
   VITE_FIREBASE_API_KEY=your-firebase-key
   VITE_FIREBASE_AUTH_DOMAIN=your-firebase-domain
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-firebase-bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   
   # Supabase Configuration
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-key
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

## ⚙️ Configuration

### AWS S3 CORS Configuration

Add this CORS policy to your S3 bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://your-domain.com"
    ],
    "ExposeHeaders": ["ETag", "x-amz-version-id"],
    "MaxAgeSeconds": 3000
  }
]
```

### Supabase Database Setup

Create the activity history table:

```sql
CREATE TABLE vayubox_activity_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  item_name TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  bucket_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE vayubox_activity_history ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can view own activity" ON vayubox_activity_history
  FOR SELECT USING (auth.uid()::text = user_id);
```

## 🎨 Vayubox Design System

Vayubox features a distinctive golden color palette:

- **Primary**: Jonquil (#F8C406)
- **Secondary**: Goldenrod (#D6A30A) 
- **Accent**: Xanthous (#E7B307)
- **Dark**: Dark Goldenrod (#A97613)

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🌐 Deployment

### Vercel Deployment

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Environment variables:** Add all `.env` variables to Vercel dashboard

3. **Deploy:** Push to main branch for automatic deployment

## 📊 Key Features

### File Operations
- **Upload**: Drag & drop, multipart upload for large files
- **Download**: Individual files or bulk downloads as ZIP
- **Organization**: Create folders, move files, batch operations

### Storage Management  
- **Glacier Archiving**: Automated lifecycle policies
- **Storage Classes**: Standard, IA, Glacier, Deep Archive
- **Restoration**: Expedited, Standard, or Bulk restore

### Activity Monitoring
- **Comprehensive Logging**: All user actions tracked
- **Search & Filter**: Find specific activities quickly  
- **Export Options**: Download activity reports

## 🔒 Security

- **Authentication**: Firebase Auth with email/password
- **Authorization**: Row Level Security in Supabase
- **AWS Security**: IAM roles and bucket policies
- **Data Protection**: Encrypted data transmission

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Submit Pull Request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Made with ❤️ by the Vayubox Team**

*Vayubox - Your cloud storage, simplified.*