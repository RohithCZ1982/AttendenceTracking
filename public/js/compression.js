const PhotoCompressor = {
  MAX_WIDTH: 640,
  MAX_HEIGHT: 480,
  QUALITY: 0.6,
  MAX_FILE_SIZE: 200 * 1024, // 200KB target

  async compress(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const result = this._resizeAndCompress(img);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  },

  _resizeAndCompress(img) {
    let { width, height } = img;

    if (width > this.MAX_WIDTH || height > this.MAX_HEIGHT) {
      const ratio = Math.min(this.MAX_WIDTH / width, this.MAX_HEIGHT / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    let quality = this.QUALITY;
    let result = canvas.toDataURL('image/jpeg', quality);

    // Iteratively reduce quality if still too large
    while (result.length > this.MAX_FILE_SIZE && quality > 0.1) {
      quality -= 0.1;
      result = canvas.toDataURL('image/jpeg', quality);
    }

    const originalSize = img.src.length;
    const compressedSize = result.length;
    const savings = Math.round((1 - compressedSize / originalSize) * 100);

    console.log(
      `Photo compressed: ${this._formatSize(originalSize)} -> ${this._formatSize(compressedSize)} (${savings}% reduction, quality: ${quality.toFixed(1)})`
    );

    return result;
  },

  _formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
};
