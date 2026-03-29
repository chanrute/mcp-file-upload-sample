import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { AppConfig } from "./config.js";

/** S3 互換ストレージ（MinIO）操作ヘルパー。バケット作成・オブジェクトアップロードを提供する。 */
export class ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: AppConfig) {
    this.bucket = config.minioBucket;
    this.client = new S3Client({
      region: config.minioRegion,
      endpoint: config.minioEndpoint,
      credentials: {
        accessKeyId: config.minioAccessKey,
        secretAccessKey: config.minioSecretKey,
      },
      forcePathStyle: true,
    });
  }

  /** バケットが存在しなければ作成する。 */
  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  /** バッファをアップロードし、オブジェクトキーとパス形式の URL を返す。 */
  async putObject(
    fileName: string,
    body: Buffer,
    contentType?: string,
  ): Promise<{ key: string; url: string }> {
    const ext = path.extname(fileName) || "";
    const key = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${ext}`;
    const input: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    };
    await this.client.send(new PutObjectCommand(input));
    const base = this.config.minioEndpoint.replace(/\/$/, "");
    const pathPart = [
      this.bucket,
      ...key.split("/").map(encodeURIComponent),
    ].join("/");
    const url = `${base}/${pathPart}`;
    return { key, url };
  }
}
