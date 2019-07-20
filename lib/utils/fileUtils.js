'use strict';
const fs = require('fs');

module.exports = class FileUtils {
	constructor(config) {
	  this.config = config;
	}
	writeAsync(filesContent) { 
		return Promise.all(Object.keys(filesContent).map(key => ({'fileName': key,'content': filesContent[key]}))
		.map(fileContent => new Promise((resolve,reject) => 
			fs.writeFile(this.config.output + '/' + fileContent.fileName, fileContent.content, 'utf8', err => err && reject(err) || resolve(this.config.output + '/' + fileContent.fileName))
		)));
	}
};