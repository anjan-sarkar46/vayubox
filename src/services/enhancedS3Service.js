import { 
  S3Client, 
  ListObjectsV2Command, 
  PutObjectCommand, 
  HeadObjectCommand, 
  RestoreObjectCommand, 
  DeleteObjectCommand, 
  DeleteObjectsCommand, 
  GetObjectCommand, 
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import JSZip from 'jszip';

// Import required functions from other services
import { getAllObjects } from './s3Service';
import { checkGlacierStatus } from './glacierService';
import { logActivity } from './supabaseHistoryService.js';

// Optimized chunk size for large files - 100MB per chunk
const OPTIMAL_CHUNK_SIZE = 100 * 1024 * 1024; // 100MB
// For files larger than this, we'll use multipart upload with manual control
const LARGE_FILE_THRESHOLD = 1024 * 1024 * 1024; // 1GB

// Initialize S3 client
const s3Client = new S3Client({
  region: import.meta.env.VITE_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_SECRET_KEY
  },
  forcePathStyle: false,
  maxAttempts: 3
});

// Enhanced upload function with better handling for large files
const uploadToS3Enhanced = async (file, filePath, onProgress = () => {}, transferContext = null) => {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    if (!(file instanceof Blob || file instanceof File)) {
      throw new Error('Invalid file type - must be File or Blob');
    }

    // Log file information for debugging
    console.log('Upload attempt:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      isFile: file instanceof File,
      isBlob: file instanceof Blob,
      constructor: file.constructor.name
    });

    // Clean up the file path
    const cleanPath = filePath
      .replace(/^\.\//, '')
      .replace(/^\/+|\/+$/g, '')
      .replace(/\\/g, '/');

    const fileName = cleanPath.split('/').pop();
    const fileSize = file.size;
    
    // Create a transfer ID if using the transfer context
    let transferId = null;
    if (transferContext) {
      transferId = transferContext.addTransfer({
        name: fileName,
        type: 'upload',
        size: fileSize,
        key: cleanPath
      });
    }

    try {
      console.log(`Starting upload for ${fileName}, size: ${fileSize} bytes`);
      
      // For very large files (>1GB), use manual multipart upload for better control
      if (fileSize > LARGE_FILE_THRESHOLD) {
        console.log(`Using manual multipart upload for large file: ${fileName}`);
        await uploadLargeFile(file, cleanPath, fileSize, (progress) => {
          onProgress(progress);
          if (transferContext && transferId) {
            transferContext.updateTransferProgress(transferId, progress.loaded, progress.total);
          }
        });
      } else {
        // For smaller files, decide between simple PUT and multipart upload
        console.log(`Using standard upload for file: ${fileName}`);
        
        // Ensure we have a valid File or Blob object
        if (!(file instanceof File || file instanceof Blob)) {
          throw new Error('Invalid file object - must be File or Blob');
        }

        // For very small files (< 25MB), use simple PUT to avoid multipart complexity
        if (fileSize < 25 * 1024 * 1024) {
          console.log(`Using simple PUT for small file: ${fileName}`);
          
          try {
            // Convert file to ArrayBuffer to avoid stream reader issues
            console.log('Converting file to ArrayBuffer for reliable upload...');
            
            // Check available memory and file size
            if (fileSize > 100 * 1024 * 1024 && typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory < 4) {
              throw new Error('File too large for available memory, using multipart upload instead');
            }
            
            const arrayBuffer = await file.arrayBuffer();
            console.log(`ArrayBuffer created, size: ${arrayBuffer.byteLength} bytes`);
            
            const putCommand = new PutObjectCommand({
              Bucket: import.meta.env.VITE_BUCKET_NAME,
              Key: cleanPath,
              Body: new Uint8Array(arrayBuffer), // Use Uint8Array for maximum compatibility
              ContentType: file.type || 'application/octet-stream',
              ContentLength: arrayBuffer.byteLength
            });
            
            console.log('Sending PUT command to S3...');
            const result = await s3Client.send(putCommand);
            console.log(`Simple PUT upload completed for ${fileName}`, result);
            
            // Simulate progress for consistency
            onProgress({ loaded: fileSize, total: fileSize, percentage: 100 });
            if (transferContext && transferId) {
              transferContext.updateTransferProgress(transferId, fileSize, fileSize);
            }
            
          } catch (putError) {
            console.error(`Simple PUT upload failed for ${fileName}:`, putError);
            
            // If ArrayBuffer conversion fails, fall back to multipart upload
            if (putError.message.includes('memory') || putError.name === 'QuotaExceededError' || putError.name === 'TypeError') {
              console.log(`Falling back to multipart upload due to: ${putError.message}`);
              // Force multipart upload for this file
              return await uploadLargeFile(file, cleanPath, fileSize, onProgress);
            }
            throw putError;
          }
        } else if (fileSize < 100 * 1024 * 1024) {
          // For medium files (25MB - 100MB), try ArrayBuffer first, fallback to multipart
          console.log(`Using multipart upload for medium file: ${fileName}`);
          
          try {
            // Try ArrayBuffer approach first for files < 100MB
            console.log('Converting file to ArrayBuffer for multipart upload...');
            const arrayBuffer = await file.arrayBuffer();
            console.log(`ArrayBuffer created for multipart, size: ${arrayBuffer.byteLength} bytes`);
            
            const upload = new Upload({
              client: s3Client,
              params: {
                Bucket: import.meta.env.VITE_BUCKET_NAME,
                Key: cleanPath,
                Body: new Uint8Array(arrayBuffer), // Use Uint8Array for compatibility
                ContentType: file.type || 'application/octet-stream',
                ContentLength: arrayBuffer.byteLength
              },
              queueSize: 4,
              partSize: 10 * 1024 * 1024, // Always use 10MB parts for multipart uploads
              leavePartsOnError: false
            });

          // Add progress handling with error protection
          upload.on("httpUploadProgress", (progress) => {
            try {
              if (progress && progress.loaded !== undefined && progress.total !== undefined) {
                const percentage = Math.round((progress.loaded / progress.total) * 100);
                onProgress({ loaded: progress.loaded, total: progress.total, percentage });
                
                if (transferContext && transferId) {
                  transferContext.updateTransferProgress(transferId, progress.loaded, progress.total);
                }
              }
            } catch (error) {
              console.error('Error in upload progress callback:', error);
            }
          });

          await upload.done();
          console.log(`Multipart upload completed for ${fileName}`);
          } catch (multipartError) {
            console.error(`Multipart upload failed for ${fileName}:`, multipartError);
            
            // If ArrayBuffer approach fails, fallback to large file upload
            if (multipartError.message.includes('memory') || multipartError.name === 'QuotaExceededError') {
              console.log(`Falling back to large file upload due to: ${multipartError.message}`);
              return await uploadLargeFile(file, cleanPath, fileSize, onProgress);
            }
            throw multipartError;
          }
        } else {
          // For very large files (>100MB), use manual multipart upload
          console.log(`Using manual multipart upload for very large file: ${fileName}`);
          await uploadLargeFile(file, cleanPath, fileSize, (progress) => {
            onProgress(progress);
            if (transferContext && transferId) {
              transferContext.updateTransferProgress(transferId, progress.loaded, progress.total);
            }
          });
        }
      }

      console.log(`Upload completed successfully for ${fileName}`);
      
      // Complete the transfer
      if (transferContext && transferId) {
        transferContext.completeTransfer(transferId);
      }

      // Log the upload activity using Supabase
      await logActivity({
        action: 'Upload',
        itemName: fileName,
        size: fileSize,
        fileCount: 1,
        folderPath: cleanPath.substring(0, cleanPath.lastIndexOf('/')) || null
      });

      return { success: true, key: cleanPath };
    } catch (error) {
      console.error(`Upload failed for ${fileName}:`, error);
      
      if (transferContext && transferId) {
        transferContext.errorTransfer(transferId, error);
      }
      throw error;
    }
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

// Function to handle very large file uploads with manual multipart control
const uploadLargeFile = async (file, key, fileSize, onProgress) => {
  // Initiate multipart upload
  const createCommand = new CreateMultipartUploadCommand({
    Bucket: import.meta.env.VITE_BUCKET_NAME,
    Key: key,
    ContentType: file.type || 'application/octet-stream'
  });
  
  let uploadId;
  try {
    const { UploadId } = await s3Client.send(createCommand);
    uploadId = UploadId;
    
    // Calculate number of parts based on optimal chunk size for file size
    const chunkSize = Math.min(OPTIMAL_CHUNK_SIZE, 100 * 1024 * 1024); // Limit to 100MB chunks
    const numParts = Math.ceil(fileSize / chunkSize);
    let completedParts = [];
    let uploadedBytes = 0;
    
    // Create abort controller for the upload
    const controller = new AbortController();
    
    // Use sequential upload for very large files to prevent memory issues
    for (let i = 0; i < numParts; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fileSize);
      const partNumber = i + 1;
      
      // Slice the file into a chunk
      const chunk = file.slice(start, end);
      
      // Set up part upload with retry logic
      let retryCount = 0;
      const MAX_RETRIES = 3;
      
      while (retryCount <= MAX_RETRIES) {
        try {
          // Convert chunk to ArrayBuffer for reliable upload
          const chunkBuffer = await chunk.arrayBuffer();
          
          // Prepare part upload command
          const uploadPartCommand = new UploadPartCommand({
            Bucket: import.meta.env.VITE_BUCKET_NAME,
            Key: key,
            PartNumber: partNumber,
            UploadId: uploadId,
            Body: new Uint8Array(chunkBuffer),
            ContentLength: chunkBuffer.byteLength
          });
          
          // Upload the part
          const response = await s3Client.send(uploadPartCommand, { 
            abortSignal: controller.signal 
          });
          
          // Add to completed parts
          completedParts.push({
            ETag: response.ETag,
            PartNumber: partNumber
          });
          
          // Update progress
          uploadedBytes += chunk.size;
          onProgress({
            loaded: uploadedBytes,
            total: fileSize,
            percentage: Math.round((uploadedBytes / fileSize) * 100)
          });
          
          // Successfully uploaded this part, break retry loop
          break;
          
        } catch (error) {
          // Check if request was aborted
          if (error.name === 'AbortError') {
            throw error;
          }
          
          retryCount++;
          console.warn(`Error uploading part ${partNumber}, attempt ${retryCount}:`, error);
          
          // If we've used all retries, rethrow the error
          if (retryCount > MAX_RETRIES) {
            throw error;
          }
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 500));
        }
      }
    }
    
    // Complete the multipart upload
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: completedParts.sort((a, b) => a.PartNumber - b.PartNumber)
      }
    });
    
    await s3Client.send(completeCommand);
    return { success: true };
    
  } catch (error) {
    console.error('Error during large file upload:', error);
    
    // Abort the multipart upload if something goes wrong and we have an uploadId
    if (uploadId) {
      try {
        await s3Client.send(new AbortMultipartUploadCommand({
          Bucket: import.meta.env.VITE_BUCKET_NAME,
          Key: key,
          UploadId: uploadId
        }));
        console.log('Multipart upload aborted');
      } catch (abortError) {
        console.error('Error aborting multipart upload:', abortError);
      }
    }
    throw error;
  }
};

// Enhanced download function for large files with progress tracking
const getS3DownloadUrlEnhanced = async (key, size, transferContext = null) => {
  try {
    // Determine if the file is in Glacier
    const glacierStatus = await checkGlacierStatus(key);
    if (glacierStatus.isGlacier && !glacierStatus.restoreStatus?.ongoingRequest === false) {
      throw new Error('File is in Glacier storage and not yet restored');
    }

    const command = new GetObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: key
    });

    // Get the file name from the key
    const fileName = key.split('/').pop();

    // Log the download activity using Supabase
    await logActivity({
      action: 'Download',
      itemName: fileName,
      size: size,
      fileCount: 1,
      folderPath: key.substring(0, key.lastIndexOf('/')) || null
    });

    // For large files, use direct signed URL instead of chunked download to avoid Vercel timeouts
    if (size > 50 * 1024 * 1024) { // 50MB
      console.log(`Using direct signed URL for large file: ${fileName}`);
      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      
      if (transferContext) {
        const transferId = transferContext.addTransfer({
          name: fileName,
          type: 'download',
          size: size
        });
        
        // Create download link and trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Mark as completed (progress tracking not available for direct downloads)
        transferContext.completeTransfer(transferId);
      }
      
      return url;
    } else {
      // For smaller files, use signed URL
      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      
      // Create transfer record if context provided
      if (transferContext) {
        const transferId = transferContext.addTransfer({
          name: fileName,
          type: 'download',
          size: size
        });

        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);

        // Set up XHR to track progress
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';

        xhr.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            transferContext.updateTransferProgress(transferId, event.loaded, event.total);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            // Download completed successfully
            const blob = new Blob([xhr.response]);
            const downloadUrl = window.URL.createObjectURL(blob);
            a.href = downloadUrl;
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            transferContext.completeTransfer(transferId);
          } else {
            transferContext.errorTransfer(transferId, new Error('Download failed'));
          }
          document.body.removeChild(a);
        });

        xhr.addEventListener('error', () => {
          transferContext.errorTransfer(transferId, new Error('Download failed'));
          document.body.removeChild(a);
        });

        xhr.send();
        return { success: true };
      }

      return url;
    }
  } catch (error) {
    console.error('Error getting download URL:', error);
    throw error;
  }
};

// Enhanced function to download a folder with better progress tracking for large files
const downloadFolderEnhanced = async (folderKey, transferContext = null) => {
  try {
    const zip = new JSZip();
    const objects = await getAllObjects(folderKey);
    
    if (objects.length === 0) {
      throw new Error('No files found in folder');
    }

    // Calculate total size for progress tracking
    const totalSize = objects.reduce((sum, obj) => sum + obj.Size, 0);
    const folderName = folderKey.split('/').slice(-2)[0];
    
    let transferId = null;
    if (transferContext) {
      transferId = transferContext.addTransfer({
        name: `${folderName}.zip`,
        type: 'download',
        size: totalSize,
        fileCount: objects.length
      });
    }

    let processedSize = 0;

    // Process objects in batches to avoid memory issues with very large folders
    const batchSize = 10;
    for (let i = 0; i < objects.length; i += batchSize) {
      const batch = objects.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (obj) => {
        try {
          // Check if file is in Glacier and restored
          const glacierStatus = await checkGlacierStatus(obj.Key);
          if (glacierStatus.isGlacier && !glacierStatus.restoreStatus?.ongoingRequest === false) {
            // Skip files that are in Glacier and not restored
            processedSize += obj.Size;
            return;
          }
          
          const command = new GetObjectCommand({
            Bucket: import.meta.env.VITE_BUCKET_NAME,
            Key: obj.Key
          });
          
          const response = await s3Client.send(command);
          const data = await response.Body.transformToByteArray();
          
          // Add file to zip
          const relativePath = obj.Key.substring(folderKey.length);
          zip.file(relativePath, data);
          
          // Update progress
          processedSize += obj.Size;
          if (transferContext && transferId) {
            transferContext.updateTransferProgress(transferId, processedSize, totalSize);
          }
        } catch (error) {
          console.error(`Error processing file ${obj.Key}:`, error);
          // Continue with other files
        }
      }));
    }

    // Generate the zip file
    const content = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 5 }
    }, (metadata) => {
      if (transferContext && transferId) {
        // Update progress during zip generation
        const zipProgress = Math.round(metadata.percent);
        transferContext.updateTransfer(transferId, {
          progress: zipProgress,
          status: 'compressing'
        });
      }
    });

    // Create download link
    const url = window.URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = folderKey.split('/').slice(-2)[0] + '.zip';
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    if (transferContext && transferId) {
      transferContext.completeTransfer(transferId);
    }

    return { success: true };
  } catch (error) {
    console.error('Error downloading folder:', error);
    throw error;
  }
};

// Expose the enhanced methods
export {
  uploadToS3Enhanced,
  getS3DownloadUrlEnhanced,
  downloadFolderEnhanced
};
