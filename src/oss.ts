import * as fs from 'fs';
import * as multer from 'multer';
import * as path from 'path';

/**
 * Đường dẫn thư mục lưu trữ tệp tải lên
 * Mặc định là thư mục 'uploads/' trong thư mục gốc của dự án
 */
export const URL_LOCALE = 'uploads/';

/**
 * Cấu hình lưu trữ tệp trên đĩa sử dụng multer
 * Bao gồm cấu hình thư mục đích và quy tắc đặt tên tệp
 */
const storage = multer.diskStorage({
  /**
   * Hàm xác định thư mục đích để lưu tệp tải lên
   * @param req - Đối tượng yêu cầu HTTP
   * @param file - Thông tin về tệp đang được tải lên
   * @param cb - Hàm callback để trả về kết quả
   */
  destination: function (req, file, cb) {
    // Kiểm tra xem thư mục đã tồn tại chưa trước khi tạo
    if (!fs.existsSync(URL_LOCALE)) {
      try {
        // Tạo thư mục với tùy chọn recursive để tạo cả thư mục cha nếu cần
        fs.mkdirSync(URL_LOCALE, { recursive: true });
      } catch (e) {
        console.log('Lỗi khi tạo thư mục:', e);
      }
    }

    // Kiểm tra nếu là tải lên phần của tệp lớn
    if (
      req.body &&
      req.body.name_file &&
      req.body.chunk_index !== undefined &&
      req.body.upload_id
    ) {
      // Tạo thư mục cho các phần của tệp lớn với upload_id để tránh trùng lặp
      const chunkDir = path.join(
        URL_LOCALE,
        `${req.body.name_file}_${req.body.upload_id}_chunks`,
      );
      if (!fs.existsSync(chunkDir)) {
        try {
          fs.mkdirSync(chunkDir, { recursive: true });
        } catch (e) {
          console.log('Lỗi khi tạo thư mục cho phần tệp:', e);
        }
      }
      // Gọi callback với thư mục đích cho phần tệp
      return cb(null, chunkDir);
    }

    // Gọi callback với thư mục đích mặc định
    cb(null, URL_LOCALE);
  },

  /**
   * Hàm xác định tên tệp khi lưu trữ
   * @param req - Đối tượng yêu cầu HTTP
   * @param file - Thông tin về tệp đang được tải lên
   * @param cb - Hàm callback để trả về kết quả
   */
  filename: function (req, file, cb) {
    // Kiểm tra nếu là tải lên phần của tệp lớn
    if (req.body && req.body.chunk_index !== undefined) {
      // Đặt tên cho phần tệp theo chỉ số
      return cb(null, `chunk_${req.body.chunk_index}`);
    }

    // Tạo hậu tố duy nhất cho tên tệp để tránh trùng lặp
    const uniqueSuffix =
      Date.now() +
      '-' +
      Math.round(Math.random() * 1e9) +
      '-' +
      file.originalname;

    // Gọi callback với tên tệp đã được tạo
    cb(null, file.fieldname + '-' + uniqueSuffix);
  },
});

/**
 * Đối tượng upload đã được cấu hình với storage
 * Sử dụng để xử lý tệp tải lên trong các controller
 */
const upload = multer({ storage: storage });

export { storage, upload };
