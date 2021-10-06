import {Context}    from './context';
import ImageStorage from './images';

/**
 * Creates storage interface object.
 * @param path       - Storage's root path.
 * @param thumbnails - Generated thumbnails.
 */
export function createStorage({path, thumbnails = []}: Context['config']): ImageStorage {
	if (!path) throw new Error('Path is required');
	
	const context: Context = {
		config: {
			path,
			thumbnails
		}
	};
	
	return new ImageStorage(context);
}
