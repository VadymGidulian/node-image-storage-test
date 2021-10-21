/// <reference types="node" />
import { TypedEmitter } from 'tiny-typed-emitter';
import * as imageUtils from './utils/image';
declare const enum EVENT {
    RESIZE = "resize",
    RESIZE_ERROR = "resizeError",
    RESIZE_PROGRESS = "resizeProgress",
    RESIZE_ALL = "resizeAll",
    RESIZE_ALL_PROGRESS = "resizeAllProgress"
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
    [EVENT.RESIZE]: (ev: ResizeEvent) => void;
    [EVENT.RESIZE_ERROR]: (e: Error) => void;
    [EVENT.RESIZE_PROGRESS]: (ev: ResizeEvent) => void;
    [EVENT.RESIZE_ALL]: (ev: ResizeAllEvent) => void;
    [EVENT.RESIZE_ALL_PROGRESS]: (ev: ResizeAllProgressEvent) => void;
}
export interface ThumbnailDescription extends imageUtils.ResizeOptions {
    /**
     * Thumbnail name.
     */
    name: string;
}
declare type Thumbnails = ThumbnailDescription[] | ((metadata: imageUtils.ImageMetadata) => ThumbnailDescription[]);
/**
 * Storage interface object
 */
export default class ImageStorage extends TypedEmitter<ImageStorageEvents> {
    #private;
    constructor({ path, thumbnails }: {
        /**
         * Storage's root path.
         */
        path: string;
        /**
         * Generated thumbnails.
         */
        thumbnails?: Thumbnails;
    });
    /**
     * Saves an image to the storage and creates thumbnails, if necessary.
     * @param buffer - Image's buffer.
     * @param resize - Generate image's thumbnails?
     * @param uid    - Image's id without extension.
     * @return Image's id.
     */
    saveImage(buffer: Buffer, { resize, uid }?: {
        resize?: boolean | 'async';
        uid?: string;
    }): Promise<string>;
    /**
     * Deletes the image and its thumbnails.
     * @param id - Image's id
     */
    deleteImage(id: string): Promise<void>;
    /**
     * Gets image's metadata.
     * @param id - Image's id.
     * @return Image's metadata or `null` if the image does not exist.
     */
    getImageMetadata(id: string): Promise<imageUtils.ImageMetadata | null>;
    /**
     * Gets image's path.
     * @param id        - Image's id.
     * @param thumbnail - Thumbnail name.
     * @param fallback  - Alternative(s) to look for, if the specified thumbnail does not exist. `true` - for original image.
     * @return Image's path or `null` if the image does not exist.
     */
    getImagePath(id: string, thumbnail?: string, { fallback }?: {
        fallback?: true | string | Array<true | string>;
    }): Promise<string | null>;
    /**
     * Converts the image to the specified format.
     * @param id     - Original image's id.
     * @param format - New image format.
     * @param resize - Generate image's thumbnails?
     * @return New image's id or `null` if the source image does not exist.
     */
    convertImage(id: string, format: string, { resize }?: {
        resize?: boolean | 'async';
    }): Promise<string | null>;
    /**
     * Regenerates image's thumbnails.
     * @param id    - Image's id.
     * @param clean - Remove existing thumbnails before.
     */
    resizeImage(id: string, { clean }?: {
        clean?: boolean;
    }): Promise<void>;
    /**
     * Regenerates thumbnails for all images.
     * @param clean - Remove existing thumbnails before.
     */
    resizeAllImages({ clean }?: {
        clean?: boolean;
    }): Promise<void>;
}
export {};
//# sourceMappingURL=image-storage.d.ts.map