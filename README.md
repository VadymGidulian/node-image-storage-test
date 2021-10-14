# 🌌 image-storage

Image storage: stores, resizes, converts.

## 🎯 Motivation

This module is designed to be a simple and easily configurable image storage solution.

## ✨ Features

- Simple API
- Flexible configuration
- Works with all popular image formats
- Generates thumbnails
- Converts images to required format
- Requires no external storage

## 📝 Usage

System requirements: /etc/mime.types, file, imagemagick

```js
const {createStorage} = require('@vadym.gidulian/image-storage');

// Create storage interface object
const storage = createStorage({
	// Storage's root path.
	path: 'path/to/storage',
	// Generated thumbnails. (Optional)
	thumbnails: [
		{
			// Thumbnail name.
			name: 'md',
			// Image geometry¹.
			size: 512,
			// Is progressive image?
			progressive: false
		},
		...
	],
	// or
	thumbnails({
		// Detected image's format.
		// Ex.: `jpeg`, `png`, etc.
		format,
		// Detected image's media type (MIME type).
		// Ex.: `image/jpeg`, `image/png`, etc.
		mediaType,
		// Image's size in bytes.
		size,
		// Image's width in pixels.
		width,
		// Image's height in pixels.
		height
	}) {
		const progressive = (mediaType === 'image/jpeg') && (size > 2**19/*512 KiB*/);
		
		return [
			{name: 'lg', size: 1024, progressive},
			{name: 'md', size: 512,  progressive},
			{name: 'sm', size: 256,  progressive}
		].filter(({size}) => (metadata.width > size) || (metadata.height > size));
	}
});

// Save an image to the storage and create thumbnails
const imageId = await storage.saveImage(buffer);
// or
// Save an image to the storage and don't create thumbnails
const imageId = await storage.saveImage(buffer, {resize: false});
// or
// Save an image to the storage and don't wait for thumbnails
const imageId = await storage.saveImage(buffer, {resize: 'async'});
// '01234567-89ab-cdef-0123-456789abcdef.jpeg'


// Get image's metadata
const metadata = await storage.getImageMetadata(imageId);
// {
//     format:    'jpeg',
//     mediaType: 'image/jpeg',
//     size:      131072,
//     width:     512,
//     height:    512
// }

// Get image's path
const imagePath = await storage.getImagePath(imageId);
// 'path/to/storage/d/ef/01234567-89ab-cdef-0123-456789abcdef.jpeg'

const thumbnailPath = await storage.getImagePath(imageId, 'md');
// 'path/to/storage/d/ef/01234567-89ab-cdef-0123-456789abcdef.md.jpeg'
const thumbnailPath = await storage.getImagePath(imageId, 'xs');
// null
const thumbnailPath = await storage.getImagePath(imageId, 'xs', {fallback: 'sm'});
// 'path/to/storage/d/ef/01234567-89ab-cdef-0123-456789abcdef.sm.jpeg'
// or
const thumbnailPath = await storage.getImagePath(imageId, 'xs', {fallback: ['sm', 'md']});
// 'path/to/storage/d/ef/01234567-89ab-cdef-0123-456789abcdef.sm.jpeg'
// or
const thumbnailPath = await storage.getImagePath(imageId, 'xs', {fallback: true});
// 'path/to/storage/d/ef/01234567-89ab-cdef-0123-456789abcdef.jpeg'


// Convert the image to the specified format
const newImageId = await storage.convertImage(imageId, 'webp');
// or
const newImageId = await storage.convertImage(imageId, 'webp', {resize: ...});
// '01234567-89ab-cdef-0123-456789abcdef.webp'


// Regenerate image's thumbnails
await storage.resizeImage(imageId);
// or
// Regenerate image's thumbnails, removing existing before
await storage.resizeImage(imageId, {clean: true});
storage.on('resize', ({
	// Image's id.
	id,
	// Array of successfully resized thumbnail names.
	resized,
	// Number of errors arisen during resize.
	errors
}) => {...});
storage.on('resizeProgress', ev => {...}); // The same as `resize` but emitted after each thumbnail
storage.on('resizeError', err => {...});


// Regenerate thumbnails for all images
await storage.resizeAllImages();
// or
// Regenerate thumbnails for all images, removing existing before
await storage.resizeAllImages({clean: true});
storage.on('resizeAll', ({
	// Number of successfully resized images.
	resized,
	// Total number of images to resize.
	total
}) => {...});
storage.on('resizeAllProgress', ({
	// Last successfully resized image id.
	id,
	// Number of successfully resized images.
	resized,
	// Total number of images to resize.
	total
}) => {...});


// Delete the image and its thumbnails
await storage.deleteImage(imageId);
```
¹ [Image geometry](https://imagemagick.org/script/command-line-processing.php#geometry)
