import type {ImageMetadata, ThumbnailDescription} from './utils/image';

export interface Context {
	config: {
		/**
		 * Storage's root path.
		 */
		path: string;
		/**
		 * Generated thumbnails.
		 */
		thumbnails: ThumbnailDescription[] | ((metadata: ImageMetadata) => ThumbnailDescription[]);
	};
}
