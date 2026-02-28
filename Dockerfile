
# Sử dụng Node.js bản nhẹ (Alpine Linux)
FROM node:18-alpine

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Copy file package để cài đặt dependencies trước (tối ưu cache layer)
COPY package*.json ./

# Cài đặt các thư viện (bao gồm cả mysql2 nếu bạn đã thêm vào package.json)
RUN npm install

# Copy toàn bộ mã nguồn vào container
COPY . .

# Mở port 3001
EXPOSE 3001

# Lệnh chạy server
CMD ["npm", "start"]
