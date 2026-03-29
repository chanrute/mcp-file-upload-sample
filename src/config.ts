/** 環境変数から設定を読み込む。未設定の場合はローカル MinIO 用のデフォルト値を使う。 */
export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? "3030"),
    minioEndpoint: process.env.MINIO_ENDPOINT ?? "http://127.0.0.1:9000",
    minioRegion: process.env.MINIO_REGION ?? "us-east-1",
    minioAccessKey:
      process.env.MINIO_ROOT_USER ??
      process.env.MINIO_ACCESS_KEY ??
      "minioadmin",
    minioSecretKey:
      process.env.MINIO_ROOT_PASSWORD ??
      process.env.MINIO_SECRET_KEY ??
      "minioadmin",
    minioBucket: process.env.MINIO_BUCKET ?? "uploads",
  };
}

export type AppConfig = {
  port: number;
  minioEndpoint: string;
  minioRegion: string;
  minioAccessKey: string;
  minioSecretKey: string;
  minioBucket: string;
};
