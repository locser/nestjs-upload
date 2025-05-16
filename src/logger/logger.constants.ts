/**
 * Các hằng số và enum cho logger
 * @description Định nghĩa các hằng số và enum sử dụng trong hệ thống logger
 */

/**
 * Enum định nghĩa các loại nguồn log
 * @description Phân biệt giữa log hệ thống và log ứng dụng
 */
export enum LogSource {
  SYSTEM = 'system',
  APPLICATION = 'application',
}

/**
 * Enum định nghĩa các mức độ log
 * @description Các mức độ log từ thấp đến cao
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Hằng số định nghĩa định dạng thời gian cho log
 * @description Định dạng thời gian hiển thị trong log
 */
export const LOG_DATE_FORMAT = 'DD/MM/YYYY HH:mm:ss';

/**
 * Hằng số định nghĩa thư mục lưu trữ log
 * @description Đường dẫn thư mục lưu trữ file log
 */
export const LOG_FOLDER = 'logs';

/**
 * Hằng số định nghĩa tên file log cho hệ thống
 * @description Tên file log cho hệ thống
 */
export const SYSTEM_LOG_FILENAME = 'system.log';

/**
 * Hằng số định nghĩa tên file log cho ứng dụng
 * @description Tên file log cho ứng dụng
 */
export const APPLICATION_LOG_FILENAME = 'application.log';

/**
 * Hằng số định nghĩa tên file log cho lỗi
 * @description Tên file log cho lỗi
 */
export const ERROR_LOG_FILENAME = 'error.log';
