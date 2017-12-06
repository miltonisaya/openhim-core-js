import moment from 'moment'
import { config } from './config'
import { ChannelModel, TransactionModel } from './model'
import * as logger from 'winston'

export function setupAgenda (agenda) {
  agenda.define('transaction body culling', async (job, done) => {
    try {
      await cullBodies()
      done()
    } catch (err) {
      done(err)
    }
  })
  agenda.every(`${config.cullBodies.pollPeriodMins} minutes`, `transaction body culling`)
}

export async function cullBodies () {
  const channels = await ChannelModel.find({ maxBodyAgeDays: { $gt: 0 } })
  await Promise.all(channels.map(channel => clearTransactions(channel)))
}

async function clearTransactions (channel) {
  const { maxBodyAgeDays, lastBodyCleared } = channel
  const maxAge = moment().subtract(maxBodyAgeDays, 'd').toDate()
  const query = {
    channelID: channel._id,
    'request.timestamp': {
      $lte: maxAge
    }
  }

  if (lastBodyCleared != null) {
    query['request.timestamp'].$gte = lastBodyCleared
  }

  channel.lastBodyCleared = Date.now()
  channel.updatedBy = 'Cron'
  await channel.save()
  const updateResp = await TransactionModel.updateMany(query, { $unset: {'request.body':'', 'response.body':''} })
  logger.info(`Updated `)
}
