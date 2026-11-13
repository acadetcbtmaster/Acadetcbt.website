import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'node:crypto';
import path from 'node:path';

export class ObjectStorageNotConfiguredError extends Error {
  public readonly statusCode = 503;

  constructor(
    message = 'External object storage is not configured. Set OBJECT_STORAGE_ENDPOINT, OBJECT_STORAGE_BUCKET, OBJECT_STORAGE_ACCESS_KEY_ID, and OBJECT_STORAGE_SECRET_ACCESS_KEY.'
  ) {
    super(message);
    this.name = 'ObjectStorageNotConfiguredError';
  }
}

let cachedS3Client: S3Client | null = null;

function getStorageEnv() {
  return {
    endpoint: process.env.OBJECT_STORAGE_ENDPOINT?.trim() || '',
    region: process.env.OBJECT_STORAGE_REGION?.trim() || 'auto',
    bucket: process.env.OBJECT_STORAGE_BUCKET?.trim() || '',
    accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID?.trim() || '',
    secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY?.trim() || '',
    publicUrl: process.env.OBJECT_STORAGE_PUBLIC_URL?.trim() || '',
  };
}

export function isObjectStorageConfigured(): boolean {
  const cfg = getStorageEnv();
  return Boolean(cfg.endpoint && cfg.bucket && cfg.accessKeyId && cfg.secretAccessKey);
}

function getS3Client(): { client: S3Client; bucket: string; publicUrl: string } {
  const cfg = getStorageEnv();
  if (!cfg.endpoint || !cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey) {
    throw new ObjectStorageNotConfiguredError();
  }

  if (!cachedS3Client) {
    cachedS3Client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  return { client: cachedS3Client, bucket: cfg.bucket, publicUrl: cfg.publicUrl };
}

export function buildMaterialObjectKey(originalFilename: string, category: string): string {
  const ext = path.extname(originalFilename || '').toLowerCase().replace(/[^.a-z0-9]/g, '') || '.pdf';
  const safeBase = path
    .basename(originalFilename || 'material', ext)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'material';
  const folder = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const uniqueId = crypto.randomUUID().slice(0, 8);
  return `study-materials/${folder}/${Date.now()}-${uniqueId}-${safeBase}${ext}`;
}

export async function uploadObjectBuffer(params: {
  objectKey: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  const { client, bucket } = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.objectKey,
      Body: params.body,
      ContentType: params.contentType,
    })
  );
}

export async function getMaterialDownloadUrl(params: {
  objectKey: string;
  downloadFilename?: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const { client, bucket, publicUrl } = getS3Client();
  if (publicUrl && !params.downloadFilename) {
    return `${publicUrl.replace(/\/+$/, '')}/${params.objectKey.replace(/^\/+/, '')}`;
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: params.objectKey,
    ...(params.downloadFilename
      ? {
          ResponseContentDisposition: `attachment; filename="${params.downloadFilename.replace(/"/g, '')}"`,
        }
      : {}),
  });

  return getSignedUrl(client, command, {
    expiresIn: params.expiresInSeconds ?? 300,
  });
}

export async function getSignedUploadUrl(params: {
  objectKey: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const { client, bucket } = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.objectKey,
    ContentType: params.contentType,
  });

  return getSignedUrl(client, command, {
    expiresIn: params.expiresInSeconds ?? 300,
  });
}

export async function getObjectBuffer(objectKey: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const { client, bucket } = getS3Client();
  const out = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    })
  );
  const bytes = await out.Body?.transformToByteArray();
  return {
    buffer: bytes ? Buffer.from(bytes) : Buffer.alloc(0),
    contentType: out.ContentType || 'application/octet-stream',
  };
}

export async function deleteObjectKey(objectKey: string): Promise<void> {
  const { client, bucket } = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    })
  );
}
