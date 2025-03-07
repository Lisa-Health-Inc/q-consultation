import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import { QBRecord } from 'quickblox'

import { QBCustomObjectId, QCRecord } from '@/models'
import { qbGetCustomObject } from '@/services/quickblox'

const getRecordSchema = {
  tags: ['Appointments', 'Records'],
  summary: 'Get a record for the appointment',
  params: Type.Object({
    id: QBCustomObjectId,
    recordId: QBCustomObjectId,
  }),
  response: {
    200: Type.Ref(QCRecord),
  },
  security: [{ apiKey: [] }, { providerSession: [] }] as Security,
}

const getRecordById: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/:recordId',
    {
      schema: getRecordSchema,
      onRequest: fastify.verify(
        fastify.BearerToken,
        fastify.ProviderSessionToken,
      ),
    },
    async (request, reply) => {
      const { id, recordId } = request.params

      const {
        items: [record],
      } = await qbGetCustomObject<QBRecord>('Record', {
        _id: {
          in: [recordId],
        },
        appointment_id: {
          in: [id],
        },
        limit: 1,
      })

      if (!record) {
        return reply.notFound()
      }

      return record
    },
  )
}

export default getRecordById
