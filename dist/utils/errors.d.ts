export declare class ImageStorageError extends Error {
    cause?: Error;
    constructor(message: string, cause?: Error);
}
export declare class ImageProcessingError extends ImageStorageError {
    path?: string;
    constructor(message: string, path?: string, cause?: Error);
}
//# sourceMappingURL=errors.d.ts.map