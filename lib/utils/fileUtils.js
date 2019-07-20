'use strict';
const fs = require('fs');
const DESTRUCTIVE_CHANGES_FILE_NAME = 'destructiveChanges.xml'

module.exports = class FileUtils {
	constructor(config) {
	  this.config = config;
	}
	writeDestructiveChangesAsync(destructiveChanges) { 
		return new Promise((resolve,reject) => 
			fs.writeFile(this.config.output + '/' + DESTRUCTIVE_CHANGES_FILE_NAME, destructiveChanges, 'utf8', err => err && reject(err) || resolve(this.config.output + '/' + DESTRUCTIVE_CHANGES_FILE_NAME))
		);
	}
};