const { rand, randItem, uuid } = require('../util')

const gopherOptions = [
  ':gopher:',
  ':sadgopher:',
  ':jubrilgopher:',
  ':party-gopher:',
  ':caleb-but-gopher:',
  ':super-party-gopher:'
]

const grassOptions = [
  ':golf:',
]

const reactionOptions = [
  'lego_goldcoin',
  'custard',
  'goose-dance',
  'cow',
  'alien',
  'adorpheus',
  'golf',
  'squirrel',
  'laptopfire',
  'rat',
  'boom',
  'cityscape',
  'snootslide2',
  'four_leaf_clover',
  'cherries',
  'dango',
  'sushi'
]

function generateButtonBlocks(gameID, buttonOptions, rows) {
  let blocks = []

  let row = 0
  let inProgressRow = {
    type: 'actions',
    block_id: `${gameID}_whack_options_row_${row}`,
    elements: []
  }
  let buttonsPerRow = buttonOptions.length / rows
  for (let b = 0; b < buttonOptions.length; b++) {
    inProgressRow.elements.push({
      type: 'button',
      text: {
        type: 'plain_text',
        text: buttonOptions[b].gopher ? randItem(gopherOptions) : randItem(grassOptions),
        emoji: true
      },
      value: buttonOptions[b].gopher ? 'gopher' : 'grass',
      action_id: buttonOptions[b].valueb
    })

    // if buttonsPerRow is 4, then this triggers on every 4th item
    if ((b+1) % buttonsPerRow == 0) {
      blocks.push(inProgressRow)
      row++
      inProgressRow = {
        type: 'actions',
        block_id: `whack_options_row_${row}`,
        elements: []
      }
    }
  }

  return blocks
}

function generateGameBoard(gameID, totalButtons, totalRows, gopherIndex, lastWinnerID, lastWinnerTime) {
  const buttonOptions = Array(totalButtons).fill().map((_, i) => {
    let isGopher = (i == gopherIndex)

    return {
      actionId: `option_${i}`,
      gopher: isGopher
    }
  })

  const generatedBlocks = generateButtonBlocks(gameID, buttonOptions, totalRows)

  const lastWinnerText = lastWinnerID ?
    `<@${lastWinnerID}> was the last winner in ${humanizeDuration(lastWinnerTime)}` :
    'i am a silly bot and have no memory of the last winner'

  return {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "WHACK THAT MOLE",
          emoji: true
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: lastWinnerText
          }
        ]
      },
    ].concat(generatedBlocks)
  }
}

class Game {
  constructor(channelID, totalButtons = 48, totalRows = 8, lastWinnerID = null, lastWinnerTime = null) {
    if (!channelID) {
      throw 'channelID is required'
    }
    this.channelID = channelID
    this.gameID = uuid()

    this.totalButtons = totalButtons
    this.totalRows = totalRows
    this.gopherIndex = rand(0, totalButtons)

    this.lastWinnerID = lastWinnerID
    this.lastWinnerTime = lastWinnerTime

    this.gameStartTime = null
  }

  tick() {
    this.gopherIndex = rand(0, this.totalButtons)
  }

  render() {
  }

  async startNewGame(app) {
    this.gopherIndex = rand(0, this.totalButtons)

    this.whacked = false
    this.gameStartTime = new Date()

    const board = generateGameBoard(this.gameID, this.totalButtons, this.totalRows, this.gopherIndex, this.lastWinner, this.lastWinnerTime)

    const initialPostMsg = await app.client.chat.postMessage({
      channel: this.channelID,
      ...board
    })

    await app.client.reactions.add({
      channel: initialPostMsg.channel,
      name: randItem(reactionOptions),
      timestamp: initialPostMsg.ts
    })

    setInterval(() => {
      if (this.whacked) {
        return true
      }

      this.gopherIndex = rand(0, this.totalButtons)
      const newBoard = generateGameBoard(this.totalButtons, this.totalRows, this.gopherIndex)

      app.client.chat.update({
        channel: this.channelID,
        ts: initialPostMsg.ts,
        ...newBoard
      })
    }, 1000)
  }

  async registerBlockCallbacks(app) {
    const rowIDs = Array(this.totalButtons).fill().map((_, i) => {
      return `${this.gameID}_whack_options_row_${i}`
    })

    rowIDs.forEach(rowID => {
      // register callback
      app.action({ block_id: rowID }, async ({ body, ack }) => {
        await ack()

        await this.handleWhack(app, body)
      })
    })
  }

  async handleWhack(app, body) {
    if (this.whacked) {
      return
    }

    console.log(body)
    debugger

    // we need to make sure there is 1 and only 1 action given to us. i'm not
    // sure why there would be multiple, i've never had this happen, but this is
    // just in case
    if (body.actions.length != 1) {
      return
    }

    let msg = body.message
    let action = body.actions[0]

    app.client.chat.postMessage({
      channel: body.channel.id,
      thread_ts: msg.ts,
      text: `WHACK by ${body.user.name}`
    })

    if (action.value != 'gopher') {

      try {
        await app.client.reactions.add({
          channel: body.channel.id,
          name: randItem(reactionOptions),
          timestamp: msg.ts
        })
      } catch {
        // don't do anything, if this errors it's probably because we've
        // already reacted with the emoji. and that's ok. this is nonessential
        // functionality anyways.
      }

      return
    }

    this.whacked = true
    //this.lastWinner = body.user.id
    //this.lastWinnerTime = new Date() - gameStartTime

    msg.blocks[0].text = {
      type: "plain_text",
      text: `WHACK A MOLE - WHACKED`,
      emoji: true
    }

    msg.blocks[1].elements[0].text = `<@${body.user.id}> WON in ${humanizeDuration(new Date() - this.gameStartTime)}`

    await app.client.chat.update({
      channel: body.channel.id,
      ...msg
    })
  }
}

exports.Game = Game
