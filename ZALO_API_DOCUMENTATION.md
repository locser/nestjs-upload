# API Documentation

## Tổng quan
Tài liệu này mô tả tất cả các API endpoints có sẵn trong hệ thống, bao gồm cả Zalo Social API và các API nội bộ của ứng dụng NestJS.

---

## 1. ZALO SOCIAL API

### 1.1 Authorization Flow

#### Authorization Endpoint
**URL:** `https://oauth.zaloapp.com/v4/permission`  
**Method:** GET  
**Description:** Endpoint để yêu cầu quyền từ người dùng Zalo

**Parameters:**
- `app_id` (required): ID của ứng dụng Zalo
- `redirect_uri` (required): URL callback sau khi user ủy quyền
- `code_challenge` (required): PKCE code challenge
- `state` (optional): Tham số tùy chỉnh để xác định request

**Example URLs:**
```
// Web Application
https://oauth.zaloapp.com/v4/permission?app_id=<APP_ID>&redirect_uri=<CALLBACK_URL>&code_challenge=<CODE_CHALLENGE>&state=<STATE>

// Mobile App (Android)
https://oauth.zaloapp.com/v4/permission?app_id=<APP_ID>&pkg_name=<PKG_NAME>&sign_key=<SIGN_KEY>&code_challenge=<CODE_CHALLENGE>&state=<STATE>

// Mobile App (iOS)
https://oauth.zaloapp.com/v4/permission?app_id=<APP_ID>&bndl_id=<BNDL_ID>&code_challenge=<CODE_CHALLENGE>&state=<STATE>
```

#### Access Token Endpoint
**URL:** `https://oauth.zaloapp.com/v4/access_token`  
**Method:** POST  
**Content-Type:** `application/x-www-form-urlencoded`  
**Response Type:** JSON

**Parameters:**
- `app_id` (required): ID của ứng dụng Zalo
- `app_secret` (required): Secret key của ứng dụng
- `code` (required): Authorization code nhận được từ callback
- `code_verifier` (required): PKCE code verifier

**Example Request:**
```bash
curl -X POST https://oauth.zaloapp.com/v4/access_token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "app_id=YOUR_APP_ID" \
  --data-urlencode "app_secret=YOUR_APP_SECRET" \
  --data-urlencode "code=AUTHORIZATION_CODE" \
  --data-urlencode "code_verifier=CODE_VERIFIER"
```

**Response:**
```json
{
  "access_token": "user_access_token",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "refresh_token"
}
```

---

## 2. NESTJS APPLICATION APIs

### 2.1 Main Application

#### Health Check
**URL:** `/`  
**Method:** GET  
**Description:** Kiểm tra trạng thái ứng dụng

**Response:**
```
"Hello World!"
```

---

### 2.2 File Upload APIs

#### Upload Single File
**URL:** `/file-upload/upload/file`  
**Method:** POST  
**Content-Type:** `multipart/form-data`  
**Description:** Tải lên một file đơn (chỉ hình ảnh, tối đa 20MB)

**Parameters:**
- `file` (required): File to upload (JPG, JPEG, PNG, GIF)
- `body` (optional): Additional metadata

**Limits:**
- File size: 20MB maximum
- File types: JPG, JPEG, PNG, GIF only
- Files count: 1 file

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "file": {
    "originalname": "example.jpg",
    "filename": "generated_filename.jpg",
    "path": "/uploads/generated_filename.jpg",
    "size": 1024000
  }
}
```

#### Upload Large Files (Chunked)
**URL:** `/file-upload/upload/large-files`  
**Method:** POST  
**Content-Type:** `multipart/form-data`  
**Description:** Tải lên file lớn theo từng chunk

**Parameters:**
- `file` (required): File chunk
- `chunk_index` (required): Số thứ tự của chunk
- `total_chunks` (required): Tổng số chunks
- `upload_id` (required): ID duy nhất cho phiên upload

**Limits:**
- File size: 1000MB maximum
- Files count: 100 files

**Response:**
```json
{
  "success": true,
  "message": "Chunk uploaded successfully",
  "chunk_index": 0,
  "upload_id": "unique_upload_id"
}
```

#### Merge Large File Chunks
**URL:** `/file-upload/upload/large-files/merge`  
**Method:** POST  
**Content-Type:** `application/json`  
**Description:** Hợp nhất các chunks thành file hoàn chỉnh

**Body:**
```json
{
  "upload_id": "unique_upload_id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "File merged successfully",
  "filePath": "/uploads/merged_file.ext"
}
```

#### Upload Multiple Chunks (Advanced)
**URL:** `/file-upload/upload/large-files/2`  
**Method:** POST  
**Content-Type:** `multipart/form-data`  
**Description:** Tải lên nhiều chunks trong một request

**Parameters:**
- `chunks` (required): Array of file chunks (max 100)
- `part_index` (required): Số thứ tự của phần
- `total_parts` (required): Tổng số phần
- `upload_id` (required): ID duy nhất cho phiên upload
- `name_file` (required): Tên file gốc
- `chunk_start_index` (required): Index bắt đầu của chunk

**Response:**
```json
{
  "success": true,
  "message": "Multiple chunks uploaded successfully",
  "part_index": 0,
  "chunks_count": 10
}
```

---

### 2.3 Excel Export APIs

#### Export Database to Excel (Basic)
**URL:** `/excels/export`  
**Method:** GET  
**Description:** Export toàn bộ database table ra file Excel

**Query Parameters:**
- `table` (required): Tên bảng cần export

**Response:**
```
"path/to/exported/file.xlsx"
```

#### Export Excel Version 1 (In-memory)
**URL:** `/excels/xlsx/1`  
**Method:** GET  
**Description:** Export dữ liệu ra Excel và trả về trực tiếp

**Query Parameters:**
- `table` (required): Tên bảng cần export
- `file_name` (required): Tên file xuất ra
- `limit` (required): Số lượng bản ghi tối đa

**Response:** Excel file download hoặc JSON error
```json
{
  "success": false,
  "message": "Không có dữ liệu trong bảng"
}
```

#### Export Excel Version 2 (Batched)
**URL:** `/excels/xlsx/2`  
**Method:** GET  
**Description:** Export với xử lý theo batch 1000 rows

**Query Parameters:**
- `table` (required): Tên bảng cần export
- `file_name` (required): Tên file xuất ra
- `limit` (required): Số lượng bản ghi tối đa

#### Export Excel Version 3 (File-based)
**URL:** `/excels/xlsx/3`  
**Method:** GET  
**Description:** Export và lưu file trên server, trả về đường dẫn

**Query Parameters:**
- `table` (required): Tên bảng cần export
- `file_name` (required): Tên file xuất ra
- `limit` (required): Số lượng bản ghi tối đa

**Response:**
```json
{
  "success": true,
  "message": "Xuất Excel thành công",
  "filePath": "uploads/1234567890_filename.xlsx"
}
```

#### Export Excel Version 4 (Streaming)
**URL:** `/excels/xlsx/4`  
**Method:** GET  
**Description:** Export với streaming để tối ưu memory

**Query Parameters:**
- `table` (required): Tên bảng cần export
- `file_name` (required): Tên file xuất ra
- `limit` (required): Số lượng bản ghi tối đa

#### Export Excel Version 5 (Stream to File)
**URL:** `/excels/xlsx/5`  
**Method:** GET  
**Description:** Export và ghi trực tiếp vào file stream

**Query Parameters:**
- `table` (required): Tên bảng cần export
- `file_name` (required): Tên file xuất ra
- `limit` (required): Số lượng bản ghi tối đa

#### Export Excel with Chunks
**URL:** `/excels/xlsx/stream-chunks`  
**Method:** GET  
**Description:** Export và chia file thành chunks nhỏ

**Query Parameters:**
- `table` (required): Tên bảng cần export
- `file_name` (required): Tên file xuất ra
- `limit` (required): Số lượng bản ghi tối đa

**Response:**
```json
{
  "success": true,
  "message": "Đang xử lý export Excel",
  "folderPath": "uploads/1234567890_filename",
  "downloadUrl": "/excels/download-chunks/1234567890_filename",
  "status": "processing"
}
```

#### Download Exported File
**URL:** `/excels/download/:fileName`  
**Method:** GET  
**Description:** Download file Excel đã export

**Path Parameters:**
- `fileName` (required): Tên file cần download

**Response:** File download hoặc JSON status
```json
{
  "success": false,
  "message": "File đang được tạo, vui lòng thử lại sau"
}
```

---

### 2.4 Error Logging APIs

#### Test Error
**URL:** `/error-logging-module/test-error`  
**Method:** GET  
**Description:** Test endpoint để tạo lỗi cho Discord logging

**Response:** Error sẽ được throw và log vào Discord

#### Test Discord Notification
**URL:** `/error-logging-module/test-discord`  
**Method:** GET  
**Description:** Test gửi thông báo Discord

**Response:**
```json
{
  "message": "Discord test message sent successfully"
}
```

#### Send Test Notification
**URL:** `/error-logging-module/test-notification`  
**Method:** GET  
**Description:** Gửi thông báo test tới Discord

**Response:**
```json
{
  "message": "Notification sent to Discord"
}
```

---

## 3. COMMON RESPONSE FORMATS

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

---

## 4. AUTHENTICATION & AUTHORIZATION

### Headers
- `Content-Type`: Varies by endpoint
- `Authorization`: Bearer token (for protected endpoints)

### Error Codes
- `400`: Bad Request - Invalid parameters
- `401`: Unauthorized - Invalid or missing token
- `404`: Not Found - Resource not found
- `500`: Internal Server Error - Server error

---

## 5. RATE LIMITING & LIMITATIONS

### File Upload Limits
- Single file: 20MB (images only)
- Large files: 1000MB (any type)
- Multiple files: 100 files per request

### Database Export Limits
- Configurable via `limit` parameter
- Automatic batching for large datasets
- Memory optimization for streaming exports

---

## 6. EXAMPLES & USAGE

### Zalo OAuth Flow Example
```javascript
// Step 1: Redirect user to authorization URL
const authUrl = `https://oauth.zaloapp.com/v4/permission?app_id=${APP_ID}&redirect_uri=${CALLBACK_URL}&code_challenge=${CODE_CHALLENGE}&state=${STATE}`;
window.location.href = authUrl;

// Step 2: Handle callback and exchange code for token
const tokenResponse = await fetch('https://oauth.zaloapp.com/v4/access_token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: new URLSearchParams({
    app_id: APP_ID,
    app_secret: APP_SECRET,
    code: authorizationCode,
    code_verifier: CODE_VERIFIER
  })
});
```

### File Upload Example
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('/file-upload/upload/file', {
  method: 'POST',
  body: formData
});
```

### Excel Export Example
```javascript
// Download Excel file directly
window.location.href = `/excels/xlsx/1?table=users&file_name=users_export&limit=10000`;

// Or get file path for server-side processing
const response = await fetch(`/excels/xlsx/3?table=users&file_name=users_export&limit=10000`);
const result = await response.json();
console.log('File saved at:', result.filePath);
```