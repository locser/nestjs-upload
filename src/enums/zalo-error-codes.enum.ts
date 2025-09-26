/**
 * Enum chứa tất cả mã lỗi của Zalo API
 * Được sử dụng để xử lý lỗi một cách nhất quán trong ứng dụng
 */
export enum ZaloErrorCode {
  // Lỗi tham số
  INVALID_PARAMETER = 100,
  
  // Lỗi liên quan đến User ID
  INVALID_USER_ID = 110,
  CANNOT_RESOLVE_USER_ID = 111,
  APP_NOT_LINKED_TO_OA = 112,
  
  // Lỗi quyền truy cập
  USER_NOT_VISIBLE = 210,
  FRIEND_REQUESTS_PERMISSION_REQUIRED = 289,
  INVALID_SESSION_KEY = 452,
  
  // Lỗi ứng dụng
  REQUEST_SENDING_DISABLED = 2004,
  SYNTAX_ERROR = 2500,
  
  // Lỗi chung
  CALL_FAIL = 10000,
  METHOD_NOT_SUPPORTED = 10001,
  UNKNOWN_EXCEPTION = 10002,
  ITEM_NOT_EXISTS = 10003,
  APP_ID_DISABLED_OR_BANNED = 11004,
  
  // Lỗi quota và giới hạn
  APP_QUOTA_LIMITED = 12000,
  FRIENDS_LIST_LIMIT_EXCEEDED = 12001, // Maximum: 50
  DAILY_QUOTA_LIMITED = 12002,
  WEEKLY_QUOTA_LIMITED = 12003,
  MONTHLY_QUOTA_LIMITED = 12004,
  USER_INACTIVE_30_DAYS = 12006,
  DO_NOT_DISTURB_USER = 12007,
  USER_MESSAGE_QUOTA_REACHED = 12008, // 1 message per 3 days
  SENDER_RECIPIENT_NOT_FRIENDS = 12009,
  DAILY_QUOTA_PER_USER_LIMITED = 12010,
  FRIEND_NOT_USING_APP = 12011,
  FRIEND_USING_APP = 12012,
}

/**
 * Mapping mã lỗi với mô tả chi tiết
 */
export const ZaloErrorMessages: Record<ZaloErrorCode, string> = {
  [ZaloErrorCode.INVALID_PARAMETER]: 'Invalid parameter',
  [ZaloErrorCode.INVALID_USER_ID]: 'Invalid user id',
  [ZaloErrorCode.CANNOT_RESOLVE_USER_ID]: "Can't resolve to a valid user ID",
  [ZaloErrorCode.APP_NOT_LINKED_TO_OA]: "Your app don't link with any Official Account",
  [ZaloErrorCode.USER_NOT_VISIBLE]: 'User not visible',
  [ZaloErrorCode.FRIEND_REQUESTS_PERMISSION_REQUIRED]: 'Accessing friend requests requires the extended permission read_requests',
  [ZaloErrorCode.INVALID_SESSION_KEY]: 'Session key invalid. This could be because the session key has an incorrect format, or because the user has revoked this session',
  [ZaloErrorCode.REQUEST_SENDING_DISABLED]: 'Sending of requests has been temporarily disabled for this application',
  [ZaloErrorCode.SYNTAX_ERROR]: 'Syntax error',
  [ZaloErrorCode.CALL_FAIL]: 'Call fail',
  [ZaloErrorCode.METHOD_NOT_SUPPORTED]: 'Method is not support for this api',
  [ZaloErrorCode.UNKNOWN_EXCEPTION]: 'Unknown exception',
  [ZaloErrorCode.ITEM_NOT_EXISTS]: 'Item not exists',
  [ZaloErrorCode.APP_ID_DISABLED_OR_BANNED]: 'App Id in use is disabled or banned',
  [ZaloErrorCode.APP_QUOTA_LIMITED]: 'Quota for your app is limited',
  [ZaloErrorCode.FRIENDS_LIST_LIMIT_EXCEEDED]: 'Limit of friends list is too large. Maximum: 50',
  [ZaloErrorCode.DAILY_QUOTA_LIMITED]: 'Quota daily for your app is limited',
  [ZaloErrorCode.WEEKLY_QUOTA_LIMITED]: 'Quota weekly for your app is limited',
  [ZaloErrorCode.MONTHLY_QUOTA_LIMITED]: 'Quota monthly for your app is limited',
  [ZaloErrorCode.USER_INACTIVE_30_DAYS]: 'User has not played game for 30 days ago',
  [ZaloErrorCode.DO_NOT_DISTURB_USER]: "Do not disturb user. User hasn't talked to friend for 30 days ago",
  [ZaloErrorCode.USER_MESSAGE_QUOTA_REACHED]: 'Recipient was reached quota message receive (1 message per 3 days)',
  [ZaloErrorCode.SENDER_RECIPIENT_NOT_FRIENDS]: 'Sender and Recipient is not friend',
  [ZaloErrorCode.DAILY_QUOTA_PER_USER_LIMITED]: 'Quota daily per user for your app is limited',
  [ZaloErrorCode.FRIEND_NOT_USING_APP]: 'Your friend is not using app',
  [ZaloErrorCode.FRIEND_USING_APP]: 'Your friend is using app',
};

/**
 * Hàm tiện ích để lấy thông báo lỗi từ mã lỗi
 * @param errorCode Mã lỗi Zalo
 * @returns Thông báo lỗi tương ứng
 */
export function getZaloErrorMessage(errorCode: number): string {
  const message = ZaloErrorMessages[errorCode as ZaloErrorCode];
  return message || `Unknown error code: ${errorCode}`;
}

/**
 * Hàm kiểm tra xem mã lỗi có phải là lỗi quota không
 * @param errorCode Mã lỗi Zalo
 * @returns true nếu là lỗi quota
 */
export function isQuotaError(errorCode: number): boolean {
  const quotaErrors = [
    ZaloErrorCode.APP_QUOTA_LIMITED,
    ZaloErrorCode.FRIENDS_LIST_LIMIT_EXCEEDED,
    ZaloErrorCode.DAILY_QUOTA_LIMITED,
    ZaloErrorCode.WEEKLY_QUOTA_LIMITED,
    ZaloErrorCode.MONTHLY_QUOTA_LIMITED,
    ZaloErrorCode.USER_MESSAGE_QUOTA_REACHED,
    ZaloErrorCode.DAILY_QUOTA_PER_USER_LIMITED,
  ];
  
  return quotaErrors.includes(errorCode as ZaloErrorCode);
}

/**
 * Hàm kiểm tra xem mã lỗi có phải là lỗi session không
 * @param errorCode Mã lỗi Zalo
 * @returns true nếu là lỗi session
 */
export function isSessionError(errorCode: number): boolean {
  return errorCode === ZaloErrorCode.INVALID_SESSION_KEY;
}

/**
 * Hàm kiểm tra xem mã lỗi có phải là lỗi user không
 * @param errorCode Mã lỗi Zalo
 * @returns true nếu là lỗi user
 */
export function isUserError(errorCode: number): boolean {
  const userErrors = [
    ZaloErrorCode.INVALID_USER_ID,
    ZaloErrorCode.CANNOT_RESOLVE_USER_ID,
    ZaloErrorCode.USER_NOT_VISIBLE,
    ZaloErrorCode.USER_INACTIVE_30_DAYS,
    ZaloErrorCode.DO_NOT_DISTURB_USER,
    ZaloErrorCode.FRIEND_NOT_USING_APP,
    ZaloErrorCode.FRIEND_USING_APP,
  ];
  
  return userErrors.includes(errorCode as ZaloErrorCode);
}