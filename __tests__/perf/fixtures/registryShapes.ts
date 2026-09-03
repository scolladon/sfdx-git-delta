// One path shape per branch MetadataRepositoryImpl's getFullyQualifiedName
// actually takes: a plain type (extension lookup only), a content container
// (bundle adapter, stops at its directory), a folder-organised type, a
// nested-content type sharing one flat directory with siblings told apart
// by suffix, a composed type whose children are decomposed under their
// holder, and a holder-scoped composed type whose every file keys on the
// holder itself.
export type Shape =
  | 'plain-type'
  | 'content-container'
  | 'in-folder-type'
  | 'nested-content-type'
  | 'composed-type'
  | 'holder-scoped-type'

export const SHAPES: readonly Shape[] = [
  'plain-type',
  'content-container',
  'in-folder-type',
  'nested-content-type',
  'composed-type',
  'holder-scoped-type',
]

export const buildPath = (shape: Shape, root: string, n: string): string => {
  switch (shape) {
    case 'plain-type':
      return `${root}/classes/MyClass${n}.cls`
    case 'content-container':
      return `${root}/lwc/myComponent${n}/myComponent${n}.js`
    case 'in-folder-type':
      return `${root}/reports/Sales${n}/Sales${n}.report-meta.xml`
    case 'nested-content-type':
      return `${root}/bots/MyBot${n}/v${n}.botVersion`
    case 'composed-type':
      return `${root}/objects/Account${n}/fields/MyField${n}.field-meta.xml`
    case 'holder-scoped-type':
      return `${root}/permissionsets/PS${n}/objectSettings/Account.objectSettings-meta.xml`
  }
}
