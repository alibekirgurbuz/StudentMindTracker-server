// Response utility fonksiyonları
const sendResponse = (res, success, message, data = null, statusCode = 200) => {
  const response = {
    success,
    message,
    ...(data && { data })
  };
  
  res.status(statusCode).json(response);
};

const sendSuccess = (res, message, data = null, statusCode = 200) => {
  sendResponse(res, true, message, data, statusCode);
};

const sendError = (res, message, statusCode = 500, data = null) => {
  sendResponse(res, false, message, data, statusCode);
};

const sendNotFound = (res, message = 'Kayıt bulunamadı') => {
  sendError(res, message, 404);
};

const sendBadRequest = (res, message = 'Geçersiz istek') => {
  sendError(res, message, 400);
};

const sendUnauthorized = (res, message = 'Yetkisiz erişim') => {
  sendError(res, message, 401);
};

const sendForbidden = (res, message = 'Bu işlem için yetkiniz yok') => {
  sendError(res, message, 403);
};

module.exports = {
  sendResponse,
  sendSuccess,
  sendError,
  sendNotFound,
  sendBadRequest,
  sendUnauthorized,
  sendForbidden
};
