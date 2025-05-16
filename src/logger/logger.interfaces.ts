/**
 * Các interface cho logger
 * @description Định nghĩa các interface sử dụng trong hệ thống logger
 */
import { LogLevel, LogSource } from './logger.constants';

/**
 * Interface cho thông tin log
 * @description Định nghĩa cấu trúc thông tin log
 */
export interface LogInfo {
  /**
   * Nguồn log (hệ thống hoặc ứng dụng)
   */
  source: LogSource;
  
  /**
   * Mức độ log
   */
  level: LogLevel;
  
  /**
   * Thông điệp log
   */
  message: string;
  
  /**
   * Context của log (tên class, module, v.v.)
   */
  context?: string;
  
  /**
   * Dữ liệu bổ sung
   */
  data?: any;
  
  /**
   * Thời gian log
   */
  timestamp?: Date;
  
  /**
   * Thông tin lỗi (nếu có)
   */
  error?: Error;
}

/**
 * Interface cho cấu hình logger
 * @description Định nghĩa cấu trúc cấu hình logger
 */
export interface LoggerConfig {
  /**
   * Mức độ log tối thiểu
   */
  level: LogLevel;
  
  /**
   * Có ghi log ra console không
   */
  console: boolean;
  
  /**
   * Có ghi log ra file không
   */
  file: boolean;
  
  /**
   * Thư mục lưu trữ file log
   */
  folder?: string;
  
  /**
   * Định dạng thời gian
   */
  dateFormat?: string;
  
  /**
   * Kích thước tối đa của file log (bytes)
   */
  maxFileSize?: number;
  
  /**
   * Số lượng file log tối đa
   */
  maxFiles?: number;
}
