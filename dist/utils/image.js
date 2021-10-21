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
Object.defineProperty(exports, "__esModule", { value: true });
exports.resize = exports.identify = exports.convert = void 0;
const childProcess = __importStar(require("child_process"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const util_1 = require("util");
const uuid_1 = require("uuid");
const errors_1 = require("./errors");
const util_2 = require("./util");
const execFile = (0, util_1.promisify)(childProcess.execFile);
const MEDIA_TYPES = {
    'image/webp': ['webp'],
    ...Object.fromEntries(fs.readFileSync('/etc/mime.types', 'utf8')
        .split(/\n+/)
        .filter(s => !s.startsWith('#'))
        .map(s => {
        const [type, ...extensions] = s.split(/\s+/);
        return [type, extensions];
    }))
};
async function convert(srcPath, format) {
    const tempFilePath = path.join(os.tmpdir(), (0, uuid_1.v4)());
    try {
        await execFile('convert', [`${srcPath}[0]`, `${format}:${tempFilePath}`], { encoding: 'buffer' });
        return await fs.promises.readFile(tempFilePath);
    }
    finally {
        await fs.promises.rm(tempFilePath, { force: true });
    }
}
exports.convert = convert;
async function getDimensions(file) {
    const isBuffer = Buffer.isBuffer(file);
    const filePath = isBuffer ? '-' : file;
    const promise = execFile('identify', ['-format', '%wx%h ', filePath]);
    if (isBuffer)
        promise.child.stdin.end(file);
    const { stdout, stderr } = await promise;
    const dimensions = /^(\d+)x(\d+)/.exec(stdout);
    if (!dimensions)
        throw new errors_1.ImageProcessingError(`Can't determine image dimensions${stderr ? `: ${stderr}` : ''}`);
    const [, width, height] = dimensions;
    return {
        width: +width,
        height: +height
    };
}
async function getMediaType(file) {
    const isBuffer = Buffer.isBuffer(file);
    const filePath = isBuffer ? '-' : file;
    const promise = execFile('file', ['-b', '-k', '-n', '-r', '--mime-type', filePath]);
    if (isBuffer) {
        promise.child.stdin.on('error', (e) => {
            if (e.code !== 'EPIPE')
                throw e;
        });
        promise.child.stdin.end(file);
    }
    return (await promise).stdout.trim().split('\n')[0];
}
async function getSize(file) {
    return Buffer.isBuffer(file)
        ? file.length
        : (await fs.promises.readFile(file)).length;
}
async function identify(file) {
    var _a, _b;
    const [{ width, height }, mediaType, size] = await Promise.all([
        getDimensions(file),
        getMediaType(file),
        getSize(file)
    ]);
    const ext = (_b = (_a = MEDIA_TYPES[mediaType]) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : '';
    return {
        format: ext,
        mediaType,
        size,
        width,
        height
    };
}
exports.identify = identify;
async function resize(srcPath, destPath, { size, progressive = false }) {
    const { stderr } = await execFile('convert', [
        srcPath,
        '-filter', 'Triangle',
        '-define', 'filter:support=2',
        '-resize', `${size}x${size}`,
        // '-thumbnail',  String(size),
        '-unsharp', '0.25x0.25+8+0.065',
        '-dither', 'None',
        '-posterize', '136',
        '-quality', '82',
        '-define', 'jpeg:fancy-upsampling=off',
        '-define', 'png:compression-filter=5',
        '-define', 'png:compression-level=9',
        '-define', 'png:compression-strategy=1',
        '-define', 'png:exclude-chunk=all',
        '-interlace', progressive ? 'Plane' : 'None',
        '-colorspace', 'sRGB',
        '-strip',
        destPath
    ]);
    if (!await (0, util_2.checkPath)(destPath))
        throw new errors_1.ImageProcessingError(`Error during resizing: ${stderr}`, srcPath);
}
exports.resize = resize;
//# sourceMappingURL=image.js.map