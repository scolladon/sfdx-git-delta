'use strict';
const fs = require('fs');
const path = require('path')
const DESTRUCTIVE_CHANGES_FILE_NAME = 'destructiveChanges.xml'

module.exports = class FileUtils {
	constructor(config) {
	  this.config = config;
	}
	writeDestructiveChangesAsync(destructiveChanges) { 
		if(!!!destructiveChanges) {
			return Promise.resolve()
		  }
		return new Promise((resolve,reject) => 
			fs.writeFile(this.config.output + '/' + DESTRUCTIVE_CHANGES_FILE_NAME, destructiveChanges, 'utf8', err => err && reject(err) || resolve(this.config.output + '/' + DESTRUCTIVE_CHANGES_FILE_NAME))
		);
	}
	static copyFileSync(src,dst) {
		if(!fs.existsSync(src) || !fs.lstatSync(src).isFile()){
			return;
		}
		const dstFolder = path.parse(dst).dir;
		if (!fs.existsSync(dstFolder)){
			fs.mkdirSync(dstFolder,{ recursive: true })
		}
		fs.copyFileSync(src,dst)
	}
};