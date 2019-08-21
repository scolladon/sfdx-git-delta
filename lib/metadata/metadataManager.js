'use strict'
const describeMetadata = require('./v46.json')

/*const TASK_PATH = '../../gulp-tasks/'

const normalizedPath = require('path').join(__dirname, 'routes')

require('fs')
  .readdirSync(normalizedPath)
  .forEach(function(file) {
    require('./routes/' + file)
  })
*/
module.exports = grouping =>
  describeMetadata.reduce((metadata, describe) => {
    metadata[describe[grouping]] = describe
    return metadata
  }, {})
