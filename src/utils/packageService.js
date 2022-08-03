'use strict'

class PackageService {
  fillPackageWithParameter(params) {
    if (!params.package.has(params.type)) {
      params.package.set(params.type, new Set())
    }
    params.package.get(params.type).add(params.elementName)
  }
}

module.exports = PackageService
