"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _ImageStorage_path, _ImageStorage_thumbnails;
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const tiny_typed_emitter_1 = require("tiny-typed-emitter");
const imageUtils = __importStar(require("./utils/image"));
const util_1 = require("./utils/util");
/**
 * Storage interface object
 */
class ImageStorage extends tiny_typed_emitter_1.TypedEmitter {
    constructor({ path, thumbnails = [] }) {
        super();
        _ImageStorage_path.set(this, void 0);
        _ImageStorage_thumbnails.set(this, void 0);
        if (!path)
            throw new Error('Path is required');
        __classPrivateFieldSet(this, _ImageStorage_path, path, "f");
        __classPrivateFieldSet(this, _ImageStorage_thumbnails, thumbnails, "f");
    }
    /**
     * Saves an image to the storage and creates thumbnails, if necessary.
     * @param buffer - Image's buffer.
     * @param resize - Generate image's thumbnails?
     * @param uid    - Image's id without extension.
     * @return Image's id.
     */
    async saveImage(buffer, { resize = true, uid = (0, uuid_1.v4)() } = {}) {
        const metadata = await imageUtils.identify(buffer);
        const fileName = `${uid}.${metadata.format}`;
        const filePath = getImagePath(__classPrivateFieldGet(this, _ImageStorage_path, "f"), fileName);
        const metadataFilePath = getImageMetadataPath(__classPrivateFieldGet(this, _ImageStorage_path, "f"), fileName);
        const { dir: fileDir } = path.parse(filePath);
        await fs.mkdir(fileDir, { recursive: true });
        try {
            await Promise.all([
                fs.writeFile(filePath, buffer),
                fs.writeFile(metadataFilePath, JSON.stringify(metadata), 'utf8')
            ]);
            if (resize) {
                const promise = this.resizeImage(fileName);
                if (resize !== 'async')
                    await promise;
            }
            return fileName;
        }
        catch (e) {
            await Promise.all([filePath, metadataFilePath]
                .map(path => fs.rm(path, { force: true })));
            throw e;
        }
    }
    /**
     * Deletes the image and its thumbnails.
     * @param id - Image's id
     */
    async deleteImage(id) {
        const [name, ext] = parseId(id);
        const dirPath = path.dirname(getImagePath(__classPrivateFieldGet(this, _ImageStorage_path, "f"), id));
        if (!await (0, util_1.checkPath)(dirPath))
            return;
        const fileNames = (await fs.readdir(dirPath))
            .filter(fileName => fileName.startsWith(name) && (fileName.endsWith(ext) || fileName.endsWith(`${ext}.json`)))
            .map(fileName => path.join(dirPath, fileName));
        await Promise.all(fileNames.map(path => fs.rm(path, { force: true })));
    }
    /**
     * Gets image's metadata.
     * @param id - Image's id.
     * @return Image's metadata or `null` if the image does not exist.
     */
    async getImageMetadata(id) {
        const filePath = await (0, util_1.checkPath)(getImageMetadataPath(__classPrivateFieldGet(this, _ImageStorage_path, "f"), id));
        if (!filePath)
            return null;
        return JSON.parse(await fs.readFile(filePath, 'utf8'));
    }
    /**
     * Gets image's path.
     * @param id        - Image's id.
     * @param thumbnail - Thumbnail name.
     * @param fallback  - Alternative(s) to look for, if the specified thumbnail does not exist. `true` - for original image.
     * @return Image's path or `null` if the image does not exist.
     */
    async getImagePath(id, thumbnail, { fallback = [] } = {}) {
        const thumbnailNames = [
            thumbnail,
            ...(!Array.isArray(fallback) ? [fallback] : fallback)
                .map(f => (f === true) ? undefined : f)
        ];
        for (const thumbnailName of thumbnailNames) {
            const filePath = await (0, util_1.checkPath)(getImagePath(__classPrivateFieldGet(this, _ImageStorage_path, "f"), id, thumbnailName));
            if (filePath)
                return filePath;
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
    async convertImage(id, format, { resize = true } = {}) {
        const srcPath = await this.getImagePath(id);
        if (!srcPath)
            return null;
        const buffer = await imageUtils.convert(srcPath, format);
        const [name] = parseId(id);
        return await this.saveImage(buffer, { resize, uid: name });
    }
    /**
     * Regenerates image's thumbnails.
     * @param id    - Image's id.
     * @param clean - Remove existing thumbnails before.
     */
    async resizeImage(id, { clean = false } = {}) {
        const srcPath = await this.getImagePath(id);
        if (!srcPath)
            return;
        if (clean) {
            const [name, ext] = parseId(id);
            const dirPath = path.dirname(srcPath);
            const fileNames = (await fs.readdir(dirPath))
                .filter(fileName => fileName.startsWith(name) && (fileName !== id) && fileName.endsWith(ext))
                .map(fileName => path.join(dirPath, fileName));
            await Promise.all(fileNames.map(path => fs.rm(path, { force: true })));
        }
        const resized = [];
        let errorsCount = 0;
        const thumbnails = Array.isArray(__classPrivateFieldGet(this, _ImageStorage_thumbnails, "f"))
            ? __classPrivateFieldGet(this, _ImageStorage_thumbnails, "f")
            : __classPrivateFieldGet(this, _ImageStorage_thumbnails, "f").call(this, (await this.getImageMetadata(id)));
        for (const thumbnailDescription of thumbnails) {
            try {
                const destPath = getImagePath(__classPrivateFieldGet(this, _ImageStorage_path, "f"), id, thumbnailDescription.name);
                await imageUtils.resize(srcPath, destPath, thumbnailDescription);
                resized.push(thumbnailDescription.name);
            }
            catch (e) {
                errorsCount++;
                this.emit("resizeError" /* RESIZE_ERROR */, e);
            }
            finally {
                this.emit("resizeProgress" /* RESIZE_PROGRESS */, { id, resized, errors: errorsCount });
            }
        }
        this.emit("resize" /* RESIZE */, { id, resized, errors: errorsCount });
    }
    /**
     * Regenerates thumbnails for all images.
     * @param clean - Remove existing thumbnails before.
     */
    async resizeAllImages({ clean = false } = {}) {
        const ids = [];
        for (const hash1 of await fs.readdir(__classPrivateFieldGet(this, _ImageStorage_path, "f"))) {
            const hash1DirPath = path.join(__classPrivateFieldGet(this, _ImageStorage_path, "f"), hash1);
            for (const hash2 of await fs.readdir(hash1DirPath)) {
                const hash2DirPath = path.join(hash1DirPath, hash2);
                const fileNames = (await fs.readdir(hash2DirPath))
                    .filter(fileName => /^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}\.\w+$/.test(fileName) && !fileName.endsWith('.json'));
                ids.push(...fileNames);
            }
        }
        let resized = 0;
        for (const id of ids) {
            try {
                await this.resizeImage(id, { clean });
                resized++;
            }
            finally {
                this.emit("resizeAllProgress" /* RESIZE_ALL_PROGRESS */, { id, resized, total: ids.length });
            }
        }
        this.emit("resizeAll" /* RESIZE_ALL */, { resized, total: ids.length });
    }
}
exports.default = ImageStorage;
_ImageStorage_path = new WeakMap(), _ImageStorage_thumbnails = new WeakMap();
;
function getHash(id) {
    const [name] = parseId(id);
    return [
        name.slice(-3, -2),
        name.slice(-2)
    ];
}
function getImageMetadataPath(root, id) {
    const hash = getHash(id);
    const fileName = `${id}.json`;
    return path.join(root, ...hash, fileName);
}
function getImagePath(root, id, thumbnail) {
    const [name, ext] = parseId(id);
    const hash = getHash(id);
    const fileName = [name, thumbnail, ext].filter(Boolean).join('.');
    return path.join(root, ...hash, fileName);
}
function parseId(id) {
    return id.split('.');
}
//# sourceMappingURL=image-storage.js.map