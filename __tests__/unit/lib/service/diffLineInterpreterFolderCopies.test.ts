'use strict'
import { beforeAll, describe, expect, it } from 'vitest'

import { TreeIndex } from '../../../../src/adapter/treeIndex'
import { createTreeReader } from '../../../../src/adapter/treeReader'
import { TAB } from '../../../../src/constant/cliConstants'
import { MODIFICATION } from '../../../../src/constant/gitConstants'
import type { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import DiffLineInterpreter from '../../../../src/service/diffLineInterpreter'
import type {
  CopyOperation,
  HandlerResult,
} from '../../../../src/types/handlerResult'
import { expandComponentCopies } from '../../../../src/utils/componentCopies'
import { expandTypeDirCompanionCopies } from '../../../../src/utils/typeDirCompanionCopies'
import { getConfig, getContext } from '../../../__utils__/testWork'

const TO = 'to-sha'
const ROOT = 'force-app/main/default'
const DOCUMENTS = `${ROOT}/documents`
const FOLDER = `${DOCUMENTS}/folder`
const EMAIL_FOLDER = `${ROOT}/email/ef`
const REPORT_FOLDER = `${ROOT}/reports/rf`
const DASHBOARD_FOLDER = `${ROOT}/dashboards/df`
const FOLDER_FILES = [
  `${FOLDER}/doc1.png`,
  `${FOLDER}/doc1.document-meta.xml`,
  `${FOLDER}/doc10.png`,
  `${FOLDER}/doc10.document-meta.xml`,
  `${FOLDER}/my_doc1_copy.txt`,
  `${FOLDER}/my_doc1_copy.document-meta.xml`,
  `${FOLDER}/folder.png`,
  `${FOLDER}/folder.document-meta.xml`,
  `${FOLDER}/banner`,
  `${FOLDER}/banner.document-meta.xml`,
]
const FILES = [
  `${DOCUMENTS}/folder.documentFolder-meta.xml`,
  ...FOLDER_FILES,
  `${DOCUMENTS}/folder2.documentFolder-meta.xml`,
  `${DOCUMENTS}/folder2/doc1.png`,
  `${DOCUMENTS}/folder2/doc1.document-meta.xml`,
  `${ROOT}/email/ef.emailFolder-meta.xml`,
  `${EMAIL_FOLDER}/t.email`,
  `${EMAIL_FOLDER}/t.email-meta.xml`,
  `${EMAIL_FOLDER}/t2.email`,
  `${EMAIL_FOLDER}/t2.email-meta.xml`,
  `${ROOT}/reports/rf.reportFolder-meta.xml`,
  `${REPORT_FOLDER}/r.report-meta.xml`,
  `${REPORT_FOLDER}/r2.report-meta.xml`,
  `${REPORT_FOLDER}/sub.reportFolder-meta.xml`,
  `${REPORT_FOLDER}/sub/x.report-meta.xml`,
  `${REPORT_FOLDER}/sub/r.report-meta.xml`,
  `${ROOT}/dashboards/df.dashboardFolder-meta.xml`,
  `${DASHBOARD_FOLDER}/d.dashboard-meta.xml`,
  `${DASHBOARD_FOLDER}/d1.dashboard-meta.xml`,
  `${DASHBOARD_FOLDER}/sub.dashboardFolder-meta.xml`,
  `${DASHBOARD_FOLDER}/sub/d.dashboard-meta.xml`,
]

const ROWS = [
  {
    title: 'a document changed beside look-alike names',
    line: `${FOLDER}/doc1.png`,
    written: [`${FOLDER}/doc1.document-meta.xml`, `${FOLDER}/doc1.png`],
    packaged: ['Document:folder/doc1'],
  },
  {
    title: 'a document descriptor changed beside look-alike names',
    line: `${FOLDER}/doc1.document-meta.xml`,
    written: [`${FOLDER}/doc1.document-meta.xml`, `${FOLDER}/doc1.png`],
    packaged: ['Document:folder/doc1'],
  },
  {
    title: 'a document whose name extends a sibling name',
    line: `${FOLDER}/doc10.png`,
    written: [`${FOLDER}/doc10.document-meta.xml`, `${FOLDER}/doc10.png`],
    packaged: ['Document:folder/doc10'],
  },
  {
    title: 'a document whose name is inside another name',
    line: `${FOLDER}/my_doc1_copy.txt`,
    written: [
      `${FOLDER}/my_doc1_copy.document-meta.xml`,
      `${FOLDER}/my_doc1_copy.txt`,
    ],
    packaged: ['Document:folder/my_doc1_copy'],
  },
  {
    title: 'a document named as its folder',
    line: `${FOLDER}/folder.png`,
    written: [`${FOLDER}/folder.document-meta.xml`, `${FOLDER}/folder.png`],
    packaged: ['Document:folder/folder'],
  },
  {
    title: 'an extensionless document content file',
    line: `${FOLDER}/banner`,
    written: [`${FOLDER}/banner`, `${FOLDER}/banner.document-meta.xml`],
    packaged: ['Document:folder/banner'],
  },
  {
    title: 'the descriptor of an extensionless document',
    line: `${FOLDER}/banner.document-meta.xml`,
    written: [`${FOLDER}/banner`, `${FOLDER}/banner.document-meta.xml`],
    packaged: ['Document:folder/banner'],
  },
  {
    title: 'a document folder descriptor beside a prefix-sibling folder',
    line: `${DOCUMENTS}/folder.documentFolder-meta.xml`,
    written: [`${DOCUMENTS}/folder.documentFolder-meta.xml`, ...FOLDER_FILES],
    packaged: ['Document:folder'],
  },
  {
    title: 'an email template beside a look-alike template',
    line: `${EMAIL_FOLDER}/t.email`,
    written: [`${EMAIL_FOLDER}/t.email`, `${EMAIL_FOLDER}/t.email-meta.xml`],
    packaged: ['EmailTemplate:ef/t'],
  },
  {
    title: 'an email folder descriptor',
    line: `${ROOT}/email/ef.emailFolder-meta.xml`,
    written: [
      `${ROOT}/email/ef.emailFolder-meta.xml`,
      `${EMAIL_FOLDER}/t.email`,
      `${EMAIL_FOLDER}/t.email-meta.xml`,
      `${EMAIL_FOLDER}/t2.email`,
      `${EMAIL_FOLDER}/t2.email-meta.xml`,
    ],
    packaged: ['EmailTemplate:ef'],
  },
  {
    title: 'a report with a same-named report in a nested folder',
    line: `${REPORT_FOLDER}/r.report-meta.xml`,
    written: [`${REPORT_FOLDER}/r.report-meta.xml`],
    packaged: ['Report:rf/r'],
  },
  {
    title: 'a report in a nested folder',
    line: `${REPORT_FOLDER}/sub/x.report-meta.xml`,
    written: [`${REPORT_FOLDER}/sub/x.report-meta.xml`],
    packaged: ['Report:rf/sub/x'],
  },
  {
    title: 'a report folder descriptor',
    line: `${ROOT}/reports/rf.reportFolder-meta.xml`,
    written: [`${ROOT}/reports/rf.reportFolder-meta.xml`],
    packaged: ['ReportFolder:rf'],
  },
  {
    title: 'a dashboard beside a look-alike dashboard',
    line: `${DASHBOARD_FOLDER}/d.dashboard-meta.xml`,
    written: [`${DASHBOARD_FOLDER}/d.dashboard-meta.xml`],
    packaged: ['Dashboard:df/d'],
  },
]

describe('Given in-folder components sharing a folder', () => {
  let metadata: MetadataRepository
  beforeAll(async () => {
    metadata = await getDefinition({})
  })

  const processLine = async (line: string) => {
    const index = new TreeIndex()
    for (const path of FILES) index.add(path)
    const trees = createTreeReader(new Map([[TO, index]]))
    const config = { ...getConfig(), to: TO, generateDelta: true }
    const sut = new DiffLineInterpreter(getContext({ config, metadata, trees }))
    const result = await sut.process([`${MODIFICATION}${TAB}${line}`])
    return { result, trees }
  }

  const writtenPaths = (
    copies: readonly CopyOperation[],
    trees: ReturnType<typeof createTreeReader>
  ) => {
    const known = new Set(FILES)
    const expanded = expandComponentCopies(
      expandTypeDirCompanionCopies(copies, trees),
      trees
    )
    return [...new Set(expanded.map(op => op.path))]
      .filter(path => known.has(path))
      .sort()
  }

  const packaged = (result: HandlerResult) =>
    result.elements.map(({ type, member }) => `${type}:${member}`)

  describe.each(ROWS)(
    'Given $title',
    ({ line, written, packaged: members }) => {
      it('When process runs, Then it writes exactly the component files', async () => {
        // Arrange & Act
        const { result, trees } = await processLine(line)

        // Assert
        expect(writtenPaths(result.copies, trees)).toEqual([...written].sort())
      })

      it('When process runs, Then it packages the same element', async () => {
        // Arrange & Act
        const { result } = await processLine(line)

        // Assert
        expect(packaged(result)).toEqual(members)
      })
    }
  )
})
