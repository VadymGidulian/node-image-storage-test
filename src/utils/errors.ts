export class ImageStorageError extends Error {
	
	cause?: Error;
	
	constructor(message: string, cause?: Error) {
		super(message);
		
		Error.captureStackTrace?.(this, ImageStorageError);
		
		this.name = this.constructor.name;
		if (cause) this.cause = cause;
	}
	
}

export class ImageProcessingError extends ImageStorageError {
	
	path?: string;
	
	constructor(message: string, path?: string, cause?: Error) {
		super(message, cause);
		
		Error.captureStackTrace?.(this, ImageProcessingError);
		
		this.name = this.constructor.name;
		if (path) this.path = path;
	}
	
}
