import { randomUUIDv7 } from "bun";
import { ObjectCannedACL, S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

import infoLogs, { LogTypes } from "@/libs/logger";
import { config } from "@/utils/env";

/**
 * Uploader class
 */
export class Uploader {
	private _s3Client: S3Client;
	private _s3Opts: { bucket: string };

	/**
	 * Initialize the uploader
	 * @param bucket Bucket name
	 */
	constructor(bucket: string) {
		this._s3Opts = { bucket };
		const s3ClientOpts: S3ClientConfig = {
			region: config.S3_REGION,
			endpoint: config.S3_ENDPOINT,
			forcePathStyle: true,
			credentials: {
				accessKeyId: config.S3_ACCESS_KEY,
				secretAccessKey: config.S3_SECRET_KEY,
			},
		};
		this._s3Client = new S3Client(s3ClientOpts);
	}

	/**
	 * Upload a file to S3
	 * @param folderName Location to upload the file
	 * @param file File to upload
	 * @param acl `public-read` or `private` access
	 */
	async uploadFile(folderName: string, file: File, acl: ObjectCannedACL) {
		const s3Key = folderName + "/" + randomUUIDv7() + "-" + file.name;
		const parallelUploads3 = new Upload({
			client: this._s3Client,
			params: {
				Bucket: this._s3Opts.bucket,
				ACL: acl,
				Body: file,
				Key: s3Key,
			},
		});

		await parallelUploads3.done();

		infoLogs("File uploaded successfully to S3", LogTypes.LOGS, "S3:Upload");

		return `${config.S3_BUCKET_URL}/${s3Key}`;
	}
}
