import ErrnoException = NodeJS.ErrnoException;
import * as childProcess      from 'child_process';
import * as fs                from 'fs';
import * as os                from 'os';
import * as path              from 'path';
import {promisify}            from 'util';
import {v4 as uuidv4}         from 'uuid';
import {ImageProcessingError} from './errors';
import {checkPath}            from './util';

const execFile = promisify(childProcess.execFile);



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



const MEDIA_TYPES: Record<string, string[]> = {
	'image/webp': ['webp'],
	...Object.fromEntries(fs.readFileSync('/etc/mime.types', 'utf8')
		.split(/\n+/)
		.filter(s => !s.startsWith('#'))
		.map(s => {
			const [type, ...extensions] = s.split(/\s+/);
			return [type, extensions];
		}))
};

export async function convert(srcPath: string, format: string): Promise<Buffer> {
	const tempFilePath: string = path.join(os.tmpdir(), uuidv4());
	try {
		await execFile('convert', [`${srcPath}[0]`, `${format}:${tempFilePath}`], {encoding: 'buffer'});
		return await fs.promises.readFile(tempFilePath);
	} finally {
		await fs.promises.rm(tempFilePath, {force: true});
	}
}

async function getDimensions(file: Buffer | string): Promise<{width: number, height: number}> {
	const isBuffer = Buffer.isBuffer(file);
	const filePath = isBuffer ? '-' : file;
	
	const promise = execFile('identify', ['-format', '%wx%h ', filePath]);
	if (isBuffer) promise.child.stdin!.end(file);
	
	const {stdout, stderr} = await promise;
	const dimensions = /^(\d+)x(\d+)/.exec(stdout);
	if (!dimensions) throw new ImageProcessingError(`Can't determine image dimensions${stderr ? `: ${stderr}` : ''}`);
	
	const [, width, height] = dimensions as unknown as [string, string, string];
	return {
		width:  +width,
		height: +height
	};
}

async function getMediaType(file: Buffer | string): Promise<string> {
	const isBuffer = Buffer.isBuffer(file);
	const filePath = isBuffer ? '-' : file;
	
	const promise = execFile('file', ['-b', '-k', '-n', '-r', '--mime-type', filePath]);
	if (isBuffer) {
		promise.child.stdin!.on('error', (e: ErrnoException) => {
			if (e.code !== 'EPIPE') throw e;
		});
		promise.child.stdin!.end(file);
	}
	
	return (await promise).stdout.trim().split('\n')[0]!;
}

async function getSize(file: Buffer | string): Promise<number> {
	return Buffer.isBuffer(file)
		? file.length
		: (await fs.promises.readFile(file)).length;
}

export async function identify(file: Buffer | string): Promise<ImageMetadata> {
	const [{width, height}, mediaType, size] = await Promise.all([
		getDimensions(file),
		getMediaType( file),
		getSize(      file)
	]);
	
	const ext: string = MEDIA_TYPES[mediaType]?.[0] ?? '';
	
	return {
		format: ext,
		mediaType,
		size,
		width,
		height
	};
}

export async function resize(
	srcPath:                     string,
	destPath:                    string,
	{size, progressive = false}: ResizeOptions
): Promise<void> {
	const {stderr} = await execFile('convert', [
		srcPath,
		'-filter',     'Triangle',
		'-define',     'filter:support=2',
		'-resize',     `${size}x${size}`,
		// '-thumbnail',  String(size),
		'-unsharp',    '0.25x0.25+8+0.065',
		'-dither',     'None',
		'-posterize',  '136',
		'-quality',    '82',
		'-define',     'jpeg:fancy-upsampling=off',
		'-define',     'png:compression-filter=5',
		'-define',     'png:compression-level=9',
		'-define',     'png:compression-strategy=1',
		'-define',     'png:exclude-chunk=all',
		'-interlace',  progressive ? 'Plane' : 'None',
		'-colorspace', 'sRGB',
		'-strip',
		destPath
	]);
	
	if (!await checkPath(destPath)) throw new ImageProcessingError(`Error during resizing: ${stderr}`, srcPath);
}
