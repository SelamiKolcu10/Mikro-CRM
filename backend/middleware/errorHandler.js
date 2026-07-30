/**
 * Central error handling middleware.
 * All errors thrown via next(error) are caught here.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Resource not found — invalid ID format';
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate value for field: ${field}`;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
  }

  const isDev = process.env.NODE_ENV === 'development';

  // Beklenmeyen (500) hatalarda ham err.message istemciye GİTMEZ: Mongoose'un
  // iç mesajları, dosya yolları, sürücü/bağlantı detayları saldırgana altyapı
  // haritası verir. Yukarıda sınıflandırılan hatalar (CastError, duplicate
  // key, ValidationError) zaten 4xx'e indiği için kullanıcıya dönmeye devam
  // eder — gizlenen yalnız gerçekten beklenmeyen olanlar.
  //
  // Sunucu tarafında tam hatayı yine de logluyoruz, yoksa 500'leri ayıklamak
  // imkânsız hale gelir.
  if (statusCode >= 500) {
    console.error('[errorHandler]', err);
    if (!isDev) message = 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(isDev && { stack: err.stack }),
  });
};

module.exports = errorHandler;
