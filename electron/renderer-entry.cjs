const path = require('node:path')

const getRendererEntry = ({ app, devServerUrl, isDev }) => {
  if (isDev) {
    return { type: 'url', value: devServerUrl }
  }

  return {
    type: 'file',
    value: path.join(app.getAppPath(), 'dist', 'index.html'),
  }
}

module.exports = { getRendererEntry }
