# Gunakan base image Node.js versi 20 yang ringan (Alpine)
FROM node:20-alpine

# Tetapkan direktori kerja di dalam kontainer
WORKDIR /usr/src/app

# Salin package.json dan package-lock.json terlebih dahulu untuk optimasi cache
COPY package*.json ./

# Install semua dependensi
RUN npm install

# Salin sisa kode aplikasi ke dalam direktori kerja
COPY . .

# Beri tahu Docker bahwa aplikasi kita berjalan di port 3000
EXPOSE 3000

# Perintah default untuk menjalankan aplikasi saat kontainer dimulai
CMD [ "node", "index.js" ]