const {
  rand, randItem,
  uuid,
  humanizeDuration,
  sleep,
  intersperse
} = require('../util')

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

const initialReactions = [
  'alphabet-white-w',
  'a',
  'c',
  'alphabet-white-k'
]

const randomReactionOptions = [
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
        block_id: `${gameID}_whack_options_row_${row}`,
        elements: []
      }
    }
  }

  return blocks
}

function generateGameBoard(gameID, totalButtons, totalRows, gopherIndex, gameStartTime, lastWinnerID, lastWinnerDuration) {
  const buttonOptions = Array(totalButtons).fill().map((_, i) => {
    let isGopher = (i == gopherIndex)

    return {
      actionId: `option_${i}`,
      gopher: isGopher
    }
  })

  const generatedBlocks = generateButtonBlocks(gameID, buttonOptions, totalRows)

  const gameDuration = humanizeDuration(gameStartTime - new Date())

  const lastWinnerText = lastWinnerID ?
    `current game running for: ${gameDuration}, <@${lastWinnerID}> was the last winner in ${humanizeDuration(lastWinnerDuration)}` :
    `current game running for: ${gameDuration}`

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
  constructor(channelID, updateInterval = 1000, updateIncrement = 0, totalButtons = 48, totalRows = 8, lastWinnerID = null, lastWinnerDuration = null) {
    if (!channelID) {
      throw 'channelID is required'
    }
    this.channelID = channelID
    this.gameID = uuid()

    this.totalButtons = totalButtons
    this.totalRows = totalRows

    this.updateInterval = updateInterval
    this.updateIncrement = updateIncrement

    this.lastWinnerID = lastWinnerID
    this.lastWinnerDuration = lastWinnerDuration

    this.gameOver = false
    this.gameStartTime = null
    this.whackedTime = null
    this.whackerID = null
    this.gopherIndex = 0

    this.reactionIndex = 0

    this.messageTS // will be set to the timestamp of the post
  }

  tick() {
    if (this.whackedTime) {
      this.gameOver= true
    }

    this.gopherIndex = rand(0, this.totalButtons)
  }

  render() {
    return generateGameBoard(this.gameID, this.totalButtons, this.totalRows, this.gopherIndex, this.gameStartTime, this.lastWinnerID, this.lastWinnerDuration)
  }

  async handleWhack(app, body) {
    if (this.gameOver) {
      return
    }

    // we need to make sure there is 1 and only 1 action given to us. i'm not
    // sure why there would be multiple, i've never had this happen, but this is
    // just in case
    if (body.actions.length != 1) {
      return
    }

    let msg = body.message
    let action = body.actions[0]; // need this semicolon

    // anonymous function to get the user info from slack (so we can display
    // their display name, instead of the incorrect "name" field that slack
    // gives us in the callback
    (async () => {
      const { profile: userInfo } = await app.client.users.profile.get({
        user: body.user.id
      })

      // intersperse the display_name with empty unicode spaces to prevent
      // @mentions for users to trigger
      let displayNameWithEmptySpaces = intersperse(userInfo.display_name, '‎')

      app.client.chat.postMessage({
        channel: body.channel.id,
        thread_ts: msg.ts,
        text: `WHACK by ${displayNameWithEmptySpaces}`
      })
    })()


    if (action.value != 'gopher') {

      try {
        await this.postReaction(app)
      } catch {
        // don't do anything, if this errors it's probably because we've
        // already reacted with the emoji. and that's ok. this is nonessential
        // functionality anyways.
      }

      return
    }

    this.whackedTime = new Date()
    this.whackerID = body.user.id

    msg.blocks[0].text = {
      type: "plain_text",
      text: `WHACK A MOLE - WHACKED`,
      emoji: true
    }

    msg.blocks[1].elements[0].text = `<@${this.whackerID}> WON in ${humanizeDuration(this.whackedTime - this.gameStartTime)}`

    await app.client.chat.update({
      channel: body.channel.id,
      ...msg
    })

    // queue one final update in case one of the game board updates we sent to
    // slack lagged out, so the final board state we write to slack is correct
    setTimeout(() => {
      app.client.chat.update({
        channel: this.channelID,
        ...msg
      })
    }, 5000) // 5 seconds after game ends
  }

  registerWhackCallbacks(app) {
    const rowIDs = Array(this.totalRows).fill().map((_, i) => {
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

  async postReaction(app) {
    if (!this.messageTS) {
      throw 'this.messageTS must be set'
    }

    this.reactionIndex = this.reactionIndex || 0

    if (this.reactionIndex < initialReactions.length) {
      const reaction = initialReactions[this.reactionIndex]

      await app.client.reactions.add({
        channel: this.channelID,
        timestamp: this.messageTS,
        name: reaction
      })

      this.reactionIndex++
    } else {
      await app.client.reactions.add({
        channel: this.channelID,
        timestamp: this.messageTS,
        name: randItem(randomReactionOptions)
      })
    }
  }

  async startNewGame(app) {
    // setup
    this.gameStartTime = new Date()

    // game loop
    this.tick()
    const initialBoard = this.render()

    // initial post
    const initialPostMsg = await app.client.chat.postMessage({
      channel: this.channelID,
      ...initialBoard
    })

    this.messageTS = initialPostMsg.ts

    this.postReaction(app)

    let newBoard

    while (!this.gameOver) {
      await sleep(this.updateInterval)
      this.updateInterval += this.updateIncrement

      this.tick()
      if (this.gameOver) {
        break
      }

      newBoard = this.render()

      app.client.chat.update({
        channel: this.channelID,
        ts: this.messageTS,
        ...newBoard
      })
    }

    return [ this.whackerID, (this.whackedTime - this.gameStartTime) ]
  }
}

exports.Game = Game
