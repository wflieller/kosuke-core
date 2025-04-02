import { Client } from 'minio';
import { STORAGE_BUCKET_NAME, STORAGE_BASE_URL } from './constants';

// Parse combined endpoint
function parseEndpoint(combinedEndpoint: string = 'localhost:9000') {
  const [endPoint, portStr] = combinedEndpoint.split(':');
  return {
    endPoint: endPoint || 'localhost',
    port: portStr ? parseInt(portStr) : 9000,
  };
}

// Get endpoint config
const endpointConfig = parseEndpoint(process.env.MINIO_ENDPOINT);

// Initialize MinIO client
const minioClient = new Client({
  endPoint: endpointConfig.endPoint,
  port: endpointConfig.port,
  useSSL: process.env.MINIO_BASE_URL?.startsWith('https://') || false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minio',
  secretKey: process.env.MINIO_SECRET_KEY || 'minio123',
});

const bucketName = STORAGE_BUCKET_NAME;

// Ensure bucket exists
async function ensureBucket() {
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName, 'us-east-1');
      // Set bucket policy to public read for profile images
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Action: ['s3:GetObject'],
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Resource: [`arn:aws:s3:::${bucketName}/*`],
            Sid: 'PublicRead',
          },
        ],
      };
      await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
    }
  } catch (error) {
    console.error('Error ensuring MinIO bucket exists:', error);
    throw new Error('Failed to initialize storage');
  }
}

// Get public URL for a file
function getFileUrl(filename: string): string {
  return `${STORAGE_BASE_URL}/${bucketName}/${filename}`;
}

export async function uploadProfileImage(file: globalThis.File, userId: number) {
  try {
    await ensureBucket();

    const filename = `profile-${userId}-${Date.now()}-${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await minioClient.putObject(bucketName, filename, buffer, buffer.length, {
      'Content-Type': file.type,
    });

    return getFileUrl(filename);
  } catch (error) {
    console.error('Error uploading profile image:', error);
    throw new Error('Failed to upload profile image');
  }
}

export async function deleteProfileImage(url: string) {
  try {
    if (!url) return;

    // Extract filename from URL using the same pattern as deleteFile
    const urlParts = url.split('/');
    const bucketIndex = urlParts.indexOf(bucketName);
    const filename =
      bucketIndex >= 0 ? urlParts.slice(bucketIndex + 1).join('/') : urlParts[urlParts.length - 1];

    if (!filename) return;

    await ensureBucket();
    await minioClient.removeObject(bucketName, filename);
  } catch (error) {
    console.error('Error deleting profile image:', error);
    throw new Error('Failed to delete profile image');
  }
}

/**
 * Generic file upload function
 * @param file File to upload
 * @param prefix Optional prefix for organizing files (e.g., 'documents/', 'images/')
 * @returns URL of the uploaded file
 */
export async function uploadFile(file: globalThis.File, prefix: string = '') {
  try {
    await ensureBucket();

    const sanitizedPrefix = prefix ? (prefix.endsWith('/') ? prefix : `${prefix}/`) : '';
    const filename = `${sanitizedPrefix}${Date.now()}-${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await minioClient.putObject(bucketName, filename, buffer, buffer.length, {
      'Content-Type': file.type,
    });

    return getFileUrl(filename);
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Failed to upload file');
  }
}

/**
 * Delete a file by its URL
 * @param url URL of the file to delete
 */
export async function deleteFile(url: string) {
  try {
    if (!url) return;

    // Extract filename from URL
    const urlParts = url.split('/');
    const filename = urlParts.slice(urlParts.indexOf(bucketName) + 1).join('/');

    if (!filename) return;

    await ensureBucket();
    await minioClient.removeObject(bucketName, filename);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new Error('Failed to delete file');
  }
}

/**
 * List files in a directory
 * @param prefix Directory prefix to list files from (e.g., 'documents/', 'images/')
 * @param recursive Whether to list files recursively in subdirectories
 * @returns Array of objects containing file info
 */
export async function listFiles(prefix: string = '', recursive: boolean = false) {
  try {
    await ensureBucket();

    const files: { name: string; size: number; lastModified: Date; url: string }[] = [];
    const stream = minioClient.listObjects(bucketName, prefix, recursive);

    return new Promise<typeof files>((resolve, reject) => {
      stream.on('data', obj => {
        if (obj.name && !obj.name.endsWith('/')) {
          // Skip directories
          files.push({
            name: obj.name,
            size: obj.size || 0, // Default to 0 if undefined
            lastModified: obj.lastModified || new Date(), // Default to current date if undefined
            url: getFileUrl(obj.name),
          });
        }
      });

      stream.on('error', err => {
        reject(err);
      });

      stream.on('end', () => {
        resolve(files);
      });
    });
  } catch (error) {
    console.error('Error listing files:', error);
    throw new Error('Failed to list files');
  }
}
