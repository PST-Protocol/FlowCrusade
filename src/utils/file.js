export function stripExtension(filename = '') {
  return filename.replace(/\.[^.]+$/, '');
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read the uploaded file.'));
    reader.readAsDataURL(file);
  });

}
