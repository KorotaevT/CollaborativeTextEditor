const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://back-end:8080',
      changeOrigin: true,
    })
  );

  app.use(
    '/ws',
    createProxyMiddleware({
      target: 'http://back-end:8080',
      changeOrigin: true,
      ws: true,
    })
  );
};