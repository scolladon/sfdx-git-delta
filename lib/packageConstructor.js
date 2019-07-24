'use strict';
const xmlbuilder = require('xmlbuilder');
const metadata = require('./metadata/v46.json').reduce((p,c)=>{p[c.directoryName]=c; return p},{});

module.exports = class PackageConstructor {
  constructor(config) {
    this.config = config;
  }
  constructPackage(strucDiffPerType) {
    if(!!!strucDiffPerType) {
      return Promise.resolve()
    }
    return new Promise((resolve,reject) => {
        const xml = xmlbuilder.create('Package')
                    .att('xmlns', 'http://soap.sforce.com/2006/04/metadata')
                    .dec('1.0', 'UTF-8');
        Object.keys(strucDiffPerType)
        .filter(type=>metadata.hasOwnProperty(type))
        .forEach(metadataType=>{
            const type = xml.ele('types');
            strucDiffPerType[metadataType].forEach(member=>{
            type.ele('members').t(member)
            })
            xml.ele('version')
            type.ele('name').t(metadata[metadataType].xmlName);
        })
        xml.ele('version')
        .t(this.config.apiVersion);
        resolve(xml.end({ pretty: true, indent: '    ', newline: '\n' }));
    });
  };
};