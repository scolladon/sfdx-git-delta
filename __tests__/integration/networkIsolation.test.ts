'use strict'
import { getCurrentApiVersion } from '@salesforce/source-deploy-retrieve'
import { describe, expect, it } from 'vitest'

// This bucket's config routes every proxy-honouring client through a proxy
// nothing listens on. The live API version lookup is the one network call sgd
// makes, so it is the probe: if it can reach appexchange, a test that forgot
// its mock can too, and would pass online and fail offline.
describe('Given the integration bucket environment', () => {
  describe('When the live API version lookup runs unmocked', () => {
    it('Then the unreachable proxy refuses it, so no test in this bucket can depend on the network', async () => {
      // Arrange
      const sut = getCurrentApiVersion

      // Act
      const error = await sut().catch((thrown: unknown) => thrown)

      // Assert — the address pins who refused it: an offline machine fails
      // with a DNS error instead, which would also reject and prove nothing.
      expect((error as Error).cause).toHaveProperty(
        'message',
        'connect ECONNREFUSED 127.0.0.1:9'
      )
    })
  })
})
