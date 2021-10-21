/// <reference types="node" />
export interface ImageMetadata {
    /**
     * Detected image's format.
     *
     * Ex.: `jpeg`, `png`, etc.
     */
    format: string;
    /**
     * Detected image's media type (MIME type).
     *
     * Ex.: `image/jpeg`, `image/png`, etc.
     */
    mediaType: string;
    /**
     * Image's size in bytes.
     */
    size: number;
    /**
     * Image's width in pixels.
     */
    width: number;
    /**
     * Image's height in pixels.
     */
    height: number;
}
export interface ResizeOptions {
    /**
     * Image geometry.
     *
     * {@link https://imagemagick.org/script/command-line-processing.php#geometry}
     */
    size: number | string;
    /**
     * Is progressive image?
     */
    progressive?: boolean;
}
export declare function convert(srcPath: string, format: string): Promise<Buffer>;
export declare function identify(file: Buffer | string): Promise<ImageMetadata>;
export declare function resize(srcPath: string, destPath: string, { size, progressive }: ResizeOptions): Promise<void>;
//# sourceMappingURL=image.d.ts.map