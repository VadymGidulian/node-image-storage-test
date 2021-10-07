'use strict';

const fs   = require('fs');
const path = require('path');
const omit = require('lodash.omit');

const ImageStorage = require('../dist').default;

const PATH = 'images';

const IMAGES_DATA = [
	['lenna.bmp',  'bmp',  'image/x-ms-bmp'],
	['lenna.gif',  'gif',  'image/gif'],
	['lenna.jpg',  'jpeg', 'image/jpeg'],
	['lenna.png',  'png',  'image/png'],
	['lenna.tif',  'tiff', 'image/tiff'],
	['lenna.webp', 'webp', 'image/webp']
];

describe.each(IMAGES_DATA)('`%s`', (fileName, format, mediaType) => {
	const CONFIG = {
		path: PATH
	};
	const IMAGE = fs.readFileSync(`test/assets/${fileName}`);
	
	beforeEach(clean);
	afterAll(  clean);
	
	describe('Create', () => {
		test('Create an image', async () => {
			const storage = new ImageStorage(CONFIG);
			
			const id = await storage.saveImage(IMAGE);
			expect(id).toBeTruthy();
		});
	});
	
	describe('Get', () => {
		const GLOBALS = {};
		
		beforeEach(async () => {
			const storage = new ImageStorage(CONFIG);
			
			GLOBALS.imageId = await storage.saveImage(IMAGE);
		});
		
		test('Get an existing image', async () => {
			const storage = new ImageStorage(CONFIG);
			
			const imagePath = await storage.getImagePath(GLOBALS.imageId);
			expect(imagePath).toBeTruthy();
			
			const image = fs.readFileSync(imagePath);
			expect(image).toStrictEqual(IMAGE);
		});
		
		test('Get path of a non-existing image thumbnail', async () => {
			const storage = new ImageStorage(CONFIG);
			
			expect(await storage.getImagePath(GLOBALS.imageId, '404')).toBeNull();
			
			{
				const imagePath = await storage.getImagePath(GLOBALS.imageId);
				expect(imagePath).toBeTruthy();
				expect(await storage.getImagePath(GLOBALS.imageId, '404', {force: true})).toBe(imagePath);
			}
		});
		
		test('Get metadata of an existing image', async () => {
			const storage = new ImageStorage(CONFIG);
			
			expect(await storage.getImageMetadata(GLOBALS.imageId)).toStrictEqual({
				format,
				mediaType,
				size:   IMAGE.length,
				width:  512,
				height: 512
			});
		});
		
		test('Get path of a non-existing image', async () => {
			const storage = new ImageStorage(CONFIG);
			
			expect(await storage.getImagePath('404')).toBeNull();
		});
		
		test('Get metadata of a non-existing image', async () => {
			const storage = new ImageStorage(CONFIG);
			
			expect(await storage.getImageMetadata('404')).toBeNull();
		});
	});
	
	describe('Delete', () => {
		const GLOBALS = {};
		
		beforeEach(async () => {
			const storage = new ImageStorage(CONFIG);
			
			GLOBALS.imageId = await storage.saveImage(IMAGE);
		});
		
		test('Delete an existing image', async () => {
			const storage = new ImageStorage(CONFIG);
			
			const {dir, name} = path.parse(await storage.getImagePath(GLOBALS.imageId));
			
			await storage.deleteImage(GLOBALS.imageId);
			
			const imagePath = await storage.getImagePath(GLOBALS.imageId);
			expect(imagePath).toBeNull();
			
			expect(fs.readdirSync(dir).some(fileName => fileName.startsWith(name))).toBeFalsy();
		});
		
		test('Delete a non-existing image', async () => {
			const storage = new ImageStorage(CONFIG);
			
			await storage.deleteImage('404');
			
			const imagePath = await storage.getImagePath('404');
			expect(imagePath).toBeNull();
		});
	});
});

describe.each(IMAGES_DATA)('`%s` with thumbnails', (fileName, format, mediaType) => {
	const CONFIG = {
		path: PATH,
		thumbnails: [
			{name: 'md',   size: 256, progressive: false},
			{name: 'sm',   size: 128, progressive: false},
			{name: 'xs',   size: 64,  progressive: false},
			{name: 'xxs',  size: 32,  progressive: false},
			{name: 'mdp',  size: 256, progressive: true},
			{name: 'smp',  size: 128, progressive: true},
			{name: 'xsp',  size: 64,  progressive: true},
			{name: 'xxsp', size: 32,  progressive: true}
		]
	};
	const IMAGE = fs.readFileSync(`test/assets/${fileName}`);
	
	beforeEach(clean);
	afterAll(  clean);
	
	describe('Create', () => {
		test('Create an image', async () => {
			const storage = new ImageStorage(CONFIG);
			
			const id = await storage.saveImage(IMAGE);
			expect(id).toBeTruthy();
		});
		
		test('Create an image (async resize)', async () => {
			const storage = new ImageStorage(CONFIG);
			
			const id = await storage.saveImage(IMAGE, {resize: 'async'});
			expect(id).toBeTruthy();
			
			expect(await waitForResize(storage)).toStrictEqual({
				id,
				resized: CONFIG.thumbnails.map(({name}) => name),
				errors:  0
			});
		});
	});
	
	describe('Get', () => {
		const GLOBALS = {};
		
		beforeEach(async () => {
			const storage = new ImageStorage(CONFIG);
			
			GLOBALS.imageId = await storage.saveImage(IMAGE);
		});
		
		test('Get an existing image', async () => {
			const storage = new ImageStorage(CONFIG);
			
			const imagePath = await storage.getImagePath(GLOBALS.imageId);
			expect(imagePath).toBeTruthy();
			
			const image = fs.readFileSync(imagePath);
			expect(image).toStrictEqual(IMAGE);
		});
		
		test('Get an existing image thumbnail', async () => {
			const storage = new ImageStorage(CONFIG);
			
			const imagePath = await storage.getImagePath(GLOBALS.imageId);
			
			const thumbnailPath = await storage.getImagePath(GLOBALS.imageId, CONFIG.thumbnails[0].name);
			expect(thumbnailPath).toBeTruthy();
			expect(thumbnailPath).not.toBe(imagePath);
			
			expect(await storage.getImagePath(GLOBALS.imageId, CONFIG.thumbnails[0].name, {force: true})).toBe(thumbnailPath);
		});
		
		test('Get metadata of an existing image', async () => {
			const storage = new ImageStorage(CONFIG);
			
			expect(await storage.getImageMetadata(GLOBALS.imageId)).toStrictEqual({
				format,
				mediaType,
				size:   IMAGE.length,
				width:  512,
				height: 512
			});
		});
	});
	
	describe('Dynamic thumbnails', () => {
		const CONFIG = {
			path: PATH,
			thumbnails: (metadata) => {
				expect(metadata).toStrictEqual({
					format,
					mediaType,
					size:   IMAGE.length,
					width:  512,
					height: 512
				});
				
				return [
					{name: 'lg', size: 1024},
					{name: 'md', size: 256},
					{name: 'sm', size: 128},
					{name: 'xs', size: 64}
				].filter(({size}) => (metadata.width > size) || (metadata.height > size));
			}
		};

		test('Create an image', async () => {
			const storage = new ImageStorage(CONFIG);

			const id = await storage.saveImage(IMAGE);
			expect(id).toBeTruthy();

			expect(await storage.getImagePath(id)).toBeTruthy();
			
			expect(await storage.getImagePath(id, 'lg')).toBeNull();
			expect(await storage.getImagePath(id, 'md')).toBeTruthy();
			expect(await storage.getImagePath(id, 'sm')).toBeTruthy();
			expect(await storage.getImagePath(id, 'xs')).toBeTruthy();
		});
	});
	
	describe('Resize', () => {
		const OLD_CONFIG = {
			path: PATH,
			thumbnails: [
				{name: 'old', size: 256}
			]
		};
		const NEW_CONFIG = {
			path: PATH,
			thumbnails: [
				{name: 'new', size: 256}
			]
		};
		const GLOBALS = {};
		
		beforeEach(async () => {
			const storage = new ImageStorage(OLD_CONFIG);
			
			GLOBALS.imageId = await storage.saveImage(IMAGE);
		});
		
		test('Resize', async () => {
			const storage = new ImageStorage(NEW_CONFIG);
			
			const oldMetadata = await storage.getImageMetadata(GLOBALS.imageId);
			expect(oldMetadata).toBeTruthy();
			
			const oldThumbnailPath = await storage.getImagePath(GLOBALS.imageId, OLD_CONFIG.thumbnails[0].name);
			expect(oldThumbnailPath).toBeTruthy();
			
			await storage.resizeImage(GLOBALS.imageId);
			
			expect(await storage.getImageMetadata(GLOBALS.imageId)).toStrictEqual(oldMetadata);
			
			expect(await storage.getImagePath(GLOBALS.imageId, OLD_CONFIG.thumbnails[0].name)).toBe(oldThumbnailPath);
			
			const newThumbnailPath = await storage.getImagePath(GLOBALS.imageId, NEW_CONFIG.thumbnails[0].name);
			expect(newThumbnailPath).toBeTruthy();
			expect(newThumbnailPath).not.toBe(oldThumbnailPath);
		});
		
		test('Clean and resize', async () => {
			const storage = new ImageStorage(NEW_CONFIG);
			
			const oldMetadata = await storage.getImageMetadata(GLOBALS.imageId);
			expect(oldMetadata).toBeTruthy();
			
			const oldThumbnailPath = await storage.getImagePath(GLOBALS.imageId, OLD_CONFIG.thumbnails[0].name);
			expect(oldThumbnailPath).toBeTruthy();
			
			await storage.resizeImage(GLOBALS.imageId, {clean: true});
			
			expect(await storage.getImageMetadata(GLOBALS.imageId)).toStrictEqual(oldMetadata);
			
			expect(await storage.getImagePath(GLOBALS.imageId, OLD_CONFIG.thumbnails[0].name)).toBeNull();
			
			const newThumbnailPath = await storage.getImagePath(GLOBALS.imageId, NEW_CONFIG.thumbnails[0].name);
			expect(newThumbnailPath).toBeTruthy();
			expect(newThumbnailPath).not.toBe(oldThumbnailPath);
		});
	});
	
	describe('Delete', () => {
		const GLOBALS = {};
		
		beforeEach(async () => {
			const storage = new ImageStorage(CONFIG);
			
			GLOBALS.imageId = await storage.saveImage(IMAGE);
		});
		
		test('Delete an existing image', async () => {
			const storage = new ImageStorage(CONFIG);
			
			const {dir, name} = path.parse(await storage.getImagePath(GLOBALS.imageId));
			
			await storage.deleteImage(GLOBALS.imageId);
			
			{
				const imagePath = await storage.getImagePath(GLOBALS.imageId);
				expect(imagePath).toBeNull();
			}
			{
				const thumbnailPath = await storage.getImagePath(GLOBALS.imageId, CONFIG.thumbnails[0].name);
				expect(thumbnailPath).toBeNull();
			}
			
			expect(fs.readdirSync(dir).some(fileName => fileName.startsWith(name))).toBeFalsy();
		});
		
		test('Delete a non-existing image', async () => {
			const storage = new ImageStorage(CONFIG);
			
			await storage.deleteImage('404');
			
			const imagePath = await storage.getImagePath('404');
			expect(imagePath).toBeNull();
		});
	});
});

describe('Convert', () => {
	const CONFIG = {
		path: PATH
	};
	
	beforeEach(clean);
	afterAll(  clean);
	
	describe.each(IMAGES_DATA)('Convert `%s`', (fromFileName, fromFormat) => {
		const IMAGE_FROM = fs.readFileSync(`test/assets/${fromFileName}`);
		
		const GLOBALS = {};
		
		beforeEach(async () => {
			const storage = new ImageStorage(CONFIG);
			
			GLOBALS.imageId = await storage.saveImage(IMAGE_FROM);
		});
		
		test.each(IMAGES_DATA)('to `%s`', async (_, toFormat, toMediaType) => {
			const storage = new ImageStorage(CONFIG);
			
			const id = await storage.convertImage(GLOBALS.imageId, toFormat);
			expect(id).toBeTruthy();
			expect(id.split('.')[0]).toBe(GLOBALS.imageId.split('.')[0]);
			
			const originalImagePath = await storage.getImagePath(GLOBALS.imageId);
			expect(originalImagePath).toBeTruthy();
			if (fromFormat === toFormat) {
				expect(await storage.getImagePath(id)).toBe(originalImagePath);
			} else {
				expect(await storage.getImagePath(id)).not.toBe(originalImagePath);
			}
			
			const metadata = await storage.getImageMetadata(id);
			expect(omit(metadata, ['size'])).toStrictEqual({
				format:    toFormat,
				mediaType: toMediaType,
				width:     512,
				height:    512
			});
			expect(metadata.size).toBeGreaterThan(0);
		});
	});
	
	describe('Delete', () => {
		const IMAGE = fs.readFileSync(`test/assets/${IMAGES_DATA[0][0]}`);
		
		const GLOBALS = {};
		
		beforeEach(async () => {
			const storage = new ImageStorage(CONFIG);
			
			GLOBALS.imageId    = await storage.saveImage(IMAGE);
			GLOBALS.newImageId = await storage.convertImage(GLOBALS.imageId, IMAGES_DATA[1][1]);
		});
		
		test('Delete old image', async () => {
			const storage = new ImageStorage(CONFIG);
			
			expect(await storage.getImagePath(GLOBALS.imageId)).toBeTruthy();
			expect(await storage.getImagePath(GLOBALS.newImageId)).toBeTruthy();
			
			await storage.deleteImage(GLOBALS.imageId);
			
			expect(await storage.getImagePath(GLOBALS.imageId)).toBeNull();
			expect(await storage.getImagePath(GLOBALS.newImageId)).toBeTruthy();
		});
	});
});

describe('Resize all', () => {
	const OLD_CONFIG = {
		path: PATH,
		thumbnails: [
			{name: 'old', size: 256}
		]
	};
	const NEW_CONFIG = {
		path: PATH,
		thumbnails: [
			{name: 'new', size: 256}
		]
	};
	
	beforeEach(clean);
	afterAll(  clean);
	
	const GLOBALS = {
		imageIds: []
	};
	
	beforeEach(async () => {
		const storage = new ImageStorage(OLD_CONFIG);
		
		GLOBALS.imageIds.length = 0;
		for (const [name] of IMAGES_DATA) {
			const image = fs.readFileSync(`test/assets/${name}`);
			GLOBALS.imageIds.push(await storage.saveImage(image));
		}
	});
	
	test('Resize all', async () => {
		const storage = new ImageStorage(NEW_CONFIG);
		
		const oldMetadatas      = [];
		const oldThumbnailPaths = [];
		
		for (const imageId of GLOBALS.imageIds) {
			const oldMetadata = await storage.getImageMetadata(imageId);
			expect(oldMetadata).toBeTruthy();
			oldMetadatas.push(oldMetadata);
			
			const oldThumbnailPath = await storage.getImagePath(imageId, OLD_CONFIG.thumbnails[0].name);
			expect(oldThumbnailPath).toBeTruthy();
			oldThumbnailPaths.push(oldThumbnailPath);
		}
		
		await storage.resizeAllImages();
		
		for (let i = 0; i < GLOBALS.imageIds.length; i++) {
			const imageId = GLOBALS.imageIds[i];
			
			expect(await storage.getImageMetadata(imageId)).toStrictEqual(oldMetadatas[i]);
			
			const oldThumbnailPath = await storage.getImagePath(imageId, OLD_CONFIG.thumbnails[0].name);
			expect(oldThumbnailPath).toBe(oldThumbnailPaths[i]);
			
			const newThumbnailPath = await storage.getImagePath(imageId, NEW_CONFIG.thumbnails[0].name);
			expect(newThumbnailPath).toBeTruthy();
			expect(newThumbnailPath).not.toBe(oldThumbnailPath);
		}
	});
	
	test('Clean and resize all', async () => {
		const storage = new ImageStorage(NEW_CONFIG);
		
		const oldMetadatas      = [];
		const oldThumbnailPaths = [];
		
		for (const imageId of GLOBALS.imageIds) {
			const oldMetadata = await storage.getImageMetadata(imageId);
			expect(oldMetadata).toBeTruthy();
			oldMetadatas.push(oldMetadata);
			
			const oldThumbnailPath = await storage.getImagePath(imageId, OLD_CONFIG.thumbnails[0].name);
			expect(oldThumbnailPath).toBeTruthy();
			oldThumbnailPaths.push(oldThumbnailPath);
		}
		
		await storage.resizeAllImages({clean: true});
		
		for (let i = 0; i < GLOBALS.imageIds.length; i++) {
			const imageId = GLOBALS.imageIds[i];
			
			expect(await storage.getImageMetadata(imageId)).toStrictEqual(oldMetadatas[i]);
			
			expect(await storage.getImagePath(imageId, OLD_CONFIG.thumbnails[0].name)).toBeNull();
			
			const newThumbnailPath = await storage.getImagePath(imageId, NEW_CONFIG.thumbnails[0].name);
			expect(newThumbnailPath).toBeTruthy();
			expect(newThumbnailPath).not.toBe(oldThumbnailPaths[i]);
		}
	});
});



function clean() {
	fs.rmSync(PATH, {force: true, recursive: true});
}

function waitForResize(storage) {
	return new Promise((resolve, reject) => {
		function resizeListener(...args) {
			storage.removeListener('resizeError', resizeErrorListener);
			resolve(...args);
		}
		function resizeErrorListener(...args) {
			storage.removeListener('resize', resizeListener);
			reject(...args);
		}
		
		storage.once('resize', resizeListener);
		storage.once('resizeError', resizeErrorListener);
	});
}
