'use strict';
const xmlbuilder = require('xmlbuilder');
const metadata = require('./metadata/v46.json').reduce((p,c)=>metadata[m.directoryName]=m,{});

module.exports = class PackageConstructor {
  constructor(config) {
    this.config = config;
  }
  constructPackage(structuredDiffs) {
    return new Promise((resolve,reject) => {
      const filesContent = {};
      const sorted_packageType = Object.keys(structuredDiffs).sort();
      sorted_packageType.forEach(packageType => {
        const strucDiffPerType = structuredDiffs[packageType];
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
        filesContent[packageType] = xml.end({ pretty: true, indent: '    ', newline: '\n' });
      });
      resolve(filesContent);
    });
  };
};