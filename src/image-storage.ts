import * as fs         from 'fs/promises';
import * as path       from 'path';
import {v4 as uuidv4}  from 'uuid';
import {TypedEmitter}  from 'tiny-typed-emitter';
import * as imageUtils from './utils/image';
import {checkPath}     from './utils/util';

const enum EVENT {
	RESIZE              = 'resize',
	RESIZE_ERROR        = 'resizeError',
	RESIZE_PROGRESS     = 'resizeProgress',
	RESIZE_ALL          = 'resizeAll',
	RESIZE_ALL_PROGRESS = 'resizeAllProgress'
}

interface ResizeEvent {
	/**
	 * Image's id.
	 */
	id: string;
	/**
	 * Array of successfully resized thumbnail names.
	 */
	resized: string[];
	/**
	 * Number of errors arisen during resize.
	 */
	errors: number;
}
interface ResizeAllEvent {
	/**
	 * Number of successfully resized images.
	 */
	resized: number;
	/**
	 * Total number of images to resize.
	 */
	total: number;
}
interface ResizeAllProgressEvent extends ResizeAllEvent {
	/**
	 * Last successfully resized image id.
	 */
	id: string;
}
interface ImageStorageEvents {
	[EVENT.RESIZE]:          (ev: ResizeEvent) => void;
	[EVENT.RESIZE_ERROR]:    (e: Error) => void;
	[EVENT.RESIZE_PROGRESS]: (ev: ResizeEvent) => void;
	
	[EVENT.RESIZE_ALL]:          (ev: ResizeAllEvent) => void;
	[EVENT.RESIZE_ALL_PROGRESS]: (ev: ResizeAllProgressEvent) => void;
}


export interface ThumbnailDescription extends imageUtils.ResizeOptions {
	/**
	 * Thumbnail name.
	 */
	name: string;
}

type Thumbnails = ThumbnailDescription[]
	| ((metadata: imageUtils.ImageMetadata) => ThumbnailDescription[]);

/**
 * Storage interface object
 */
export default class ImageStorage extends TypedEmitter<ImageStorageEvents> {
	
	#path:       string;
	#thumbnails: Thumbnails;
	
	constructor({path, thumbnails = []}: {
		/**
		 * Storage's root path.
		 */
		path: string,
		/**
		 * Generated thumbnails.
		 */
		thumbnails?: Thumbnails
	}) {
		super();
		
		if (!path) throw new Error('Path is required');
		
		this.#path       = path;
		this.#thumbnails = thumbnails;
	}
	
	/**
	 * Saves an image to the storage and creates thumbnails, if necessary.
	 * @param buffer - Image's buffer.
	 * @param resize - Generate image's thumbnails?
	 * @param uid    - Image's id without extension.
	 * @return Image's id.
	 */
	async saveImage(
		buffer: Buffer,
		{resize = true, uid = uuidv4()}: {
			resize?: boolean | 'async',
			uid?:    string
		} = {}
	): Promise<string> {
		const metadata: imageUtils.ImageMetadata = await imageUtils.identify(buffer);
		
		const fileName:         string = `${uid}.${metadata.format}`;
		const filePath:         string = getImagePath(        this.#path, fileName);
		const metadataFilePath: string = getImageMetadataPath(this.#path, fileName);
		const {dir: fileDir}           = path.parse(filePath);
		
		await fs.mkdir(fileDir, {recursive: true});
		try {
			await Promise.all([
				fs.writeFile(filePath,         buffer),
				fs.writeFile(metadataFilePath, JSON.stringify(metadata), 'utf8')
			]);
			
			if (resize) {
				const promise = this.resizeImage(fileName);
				if (resize !== 'async') await promise;
			}
			
			return fileName;
		} catch (e) {
			await Promise.all([filePath, metadataFilePath]
				.map(path => fs.rm(path, {force: true})));
			
			throw e;
		}
	}
	
	/**
	 * Deletes the image and its thumbnails.
	 * @param id - Image's id
	 */
	async deleteImage(id: string): Promise<void> {
		const [name, ext]     = parseId(id);
		const dirPath: string = path.dirname(getImagePath(this.#path, id));
		if (!await checkPath(dirPath)) return;
		
		const fileNames: string[] = (await fs.readdir(dirPath))
			.filter(fileName => fileName.startsWith(name) && (fileName.endsWith(ext) || fileName.endsWith(`${ext}.json`)))
			.map(fileName => path.join(dirPath, fileName));
		
		await Promise.all(fileNames.map(path => fs.rm(path, {force: true})));
	}
	
	/**
	 * Gets image's metadata.
	 * @param id - Image's id.
	 * @return Image's metadata or `null` if the image does not exist.
	 */
	async getImageMetadata(id: string): Promise<imageUtils.ImageMetadata | null> {
		const filePath: string | null = await checkPath(getImageMetadataPath(this.#path, id));
		if (!filePath) return null;
		
		return JSON.parse(await fs.readFile(filePath, 'utf8'));
	}
	
	/**
	 * Gets image's path.
	 * @param id        - Image's id.
	 * @param thumbnail - Thumbnail name.
	 * @param fallback  - Alternative(s) to look for, if the specified thumbnail does not exist. `true` - for original image.
	 * @return Image's path or `null` if the image does not exist.
	 */
	async getImagePath(
		id:         string,
		thumbnail?: string,
		{fallback = []}: {
			fallback?: true | string | Array<true | string>
		} = {}
	): Promise<string | null> {
		const thumbnailNames: Array<string | undefined> = [
			thumbnail,
			...(!Array.isArray(fallback) ? [fallback] : fallback)
				.map(f => (f === true) ? undefined : f)
		];
		
		for (const thumbnailName of thumbnailNames) {
			const filePath: string | null = await checkPath(getImagePath(this.#path, id, thumbnailName));
			if (filePath) return filePath;
		}
		
		return null;
	}
	
	/**
	 * Converts the image to the specified format.
	 * @param id     - Original image's id.
	 * @param format - New image format.
	 * @param resize - Generate image's thumbnails?
	 * @return New image's id or `null` if the source image does not exist.
	 */
	async convertImage(id: string, format: string, {resize = true}: {resize?: boolean | 'async'} = {}): Promise<string | null> {
		const srcPath: string | null = await this.getImagePath(id);
		if (!srcPath) return null;
		
		const buffer: Buffer = await imageUtils.convert(srcPath, format);
		const [name]         = parseId(id);
		return await this.saveImage(buffer, {resize, uid: name});
	}
	
	/**
	 * Regenerates image's thumbnails.
	 * @param id    - Image's id.
	 * @param clean - Remove existing thumbnails before.
	 */
	async resizeImage(id: string, {clean = false}: {clean?: boolean} = {}): Promise<void> {
		const srcPath: string | null = await this.getImagePath(id);
		if (!srcPath) return;
		
		if (clean) {
			const [name, ext]     = parseId(id);
			const dirPath: string = path.dirname(srcPath);
			
			const fileNames: string[] = (await fs.readdir(dirPath))
				.filter(fileName => fileName.startsWith(name) && (fileName !== id) && fileName.endsWith(ext))
				.map(fileName => path.join(dirPath, fileName));
			
			await Promise.all(fileNames.map(path => fs.rm(path, {force: true})));
		}
		
		const resized:     string[] = [];
		let   errorsCount: number   = 0;
		const thumbnails:  ThumbnailDescription[] = Array.isArray(this.#thumbnails)
			? this.#thumbnails
			: this.#thumbnails((await this.getImageMetadata(id))!);
		for (const thumbnailDescription of thumbnails) {
			try {
				const destPath: string = getImagePath(this.#path, id, thumbnailDescription.name);
				
				await imageUtils.resize(srcPath, destPath, thumbnailDescription);
				resized.push(thumbnailDescription.name);
			} catch (e) {
				errorsCount++;
				this.emit(EVENT.RESIZE_ERROR, e);
			} finally {
				this.emit(EVENT.RESIZE_PROGRESS, {id, resized, errors: errorsCount})
			}
		}
		this.emit(EVENT.RESIZE, {id, resized, errors: errorsCount});
	}
	
	/**
	 * Regenerates thumbnails for all images.
	 * @param clean - Remove existing thumbnails before.
	 */
	async resizeAllImages({clean = false}: {clean?: boolean} = {}): Promise<void> {
		const ids: string[] = [];
		
		for (const hash1 of await fs.readdir(this.#path)) {
			const hash1DirPath: string = path.join(this.#path, hash1);
			
			for (const hash2 of await fs.readdir(hash1DirPath)) {
				const hash2DirPath: string = path.join(hash1DirPath, hash2);
				
				const fileNames: string[] = (await fs.readdir(hash2DirPath))
					.filter(fileName => /^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}\.\w+$/.test(fileName) && !fileName.endsWith('.json'));
				ids.push(...fileNames);
			}
		}
		
		let resized: number = 0;
		for (const id of ids) {
			try {
				await this.resizeImage(id, {clean});
				resized++;
			} finally {
				this.emit(EVENT.RESIZE_ALL_PROGRESS, {id, resized, total: ids.length})
			}
		}
		
		this.emit(EVENT.RESIZE_ALL, {resized, total: ids.length});
	}
	
};



function getHash(id: string): string[] {
	const [name] = parseId(id);
	
	return [
		name.slice(-3, -2),
		name.slice(-2)
	];
}

function getImageMetadataPath(root: string, id: string): string {
	const hash:     string[] = getHash(id);
	const fileName: string   = `${id}.json`;
	
	return path.join(root, ...hash, fileName);
}

function getImagePath(root: string, id: string, thumbnail?: string): string {
	const [name, ext]        = parseId(id);
	const hash:     string[] = getHash(id);
	const fileName: string   = [name, thumbnail, ext].filter(Boolean).join('.');
	
	return path.join(root, ...hash, fileName);
}

function parseId(id: string): [string, string] {
	return id.split('.') as [string, string];
}
