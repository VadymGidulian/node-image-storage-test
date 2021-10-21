"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageProcessingError = exports.ImageStorageError = void 0;
class ImageStorageError extends Error {
    constructor(message, cause) {
        var _a;
        super(message);
        (_a = Error.captureStackTrace) === null || _a === void 0 ? void 0 : _a.call(Error, this, ImageStorageError);
        this.name = this.constructor.name;
        if (cause)
            this.cause = cause;
    }
}
exports.ImageStorageError = ImageStorageError;
class ImageProcessingError extends ImageStorageError {
    constructor(message, path, cause) {
        var _a;
        super(message, cause);
        (_a = Error.captureStackTrace) === null || _a === void 0 ? void 0 : _a.call(Error, this, ImageProcessingError);
        this.name = this.constructor.name;
        if (path)
            this.path = path;
    }
}
exports.ImageProcessingError = ImageProcessingError;
//# sourceMappingURL=errors.js.map