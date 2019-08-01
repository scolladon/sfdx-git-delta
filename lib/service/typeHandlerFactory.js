'use strict';
const SubCustomObject = require('./subCustomObjectHandler');
const CustomObject = require('./customObjectHandler');
const InResource = require('./inResourceHandler');
const InFolder = require('./inFolderHandler');
const Standard = require('./standardHandler');
const metadata = require('../metadata/v46')('directoryName');
const path = require('path')

const classes = {
    'businessProcesses' : SubCustomObject,
    'compactLayouts' : SubCustomObject,
    'fields' : SubCustomObject,
    'fieldSets' : SubCustomObject,
    'listViews' : SubCustomObject,
    'recordTypes' : SubCustomObject,
    'sharingReasons' : SubCustomObject,
    'validationRules' : SubCustomObject,
    'webLinks' : SubCustomObject,
    'reportTypes' : SubCustomObject,
    'fields' : SubCustomObject,
    'fields' : SubCustomObject,
    'objects' : CustomObject,
    'documents' : InFolder,
    'reports' : InFolder,
    'dashboards' : InFolder,
    'staticresources' : InResource,
    'aura' : InResource,
    'lwc' : InResource
};

module.exports = class HandlerFactory {
    constructor(work) {
        this.work = work;
    }
    getTypeHander(line){
        const type = line.split(path.sep).reduce((p,v)=> metadata.hasOwnProperty(v) ? v : p  ,'')
        return !!classes[type] ? /*new (classes[type])(type)*/ new Standard(line,type,this.work) : new Standard(line,type,this.work);
    }
};